import "server-only"

import { createPublicClient, http, type Address, type Hex } from "viem"
import { base, mainnet } from "viem/chains"

import { alchemyRpcUrl } from "@/lib/alchemy/client"

/**
 * SIWE 签名验签 —— 支持 EOA / ERC-1271 / ERC-6492。
 *
 * 为什么不能只用 `siwe.verify()`：它内部只做 `ecrecover`，只认 EOA。
 * 而 Reown AppKit 的 **Smart Account 对 embedded wallet（邮箱 / 社交登录）默认开启**，
 * 签出来的是 ERC-1271（合约账户）或 ERC-6492（尚未部署的合约账户）签名。
 * 结果是：所有用 Google / 邮箱登录的用户 100% 验签失败，只有连外部钱包的 EOA 能进。
 *
 * 这里改用 viem 的 `publicClient.verifyMessage`，它按顺序处理三种情况：
 *   1. 签名是 ERC-6492 包装 → 用 deployless validator 模拟部署后校验（不要求账户已部署）
 *   2. 地址是合约 → 调 `isValidSignature`（ERC-1271）
 *   3. 其余 → ecrecover 比对（EOA）
 *
 * 因此只有第 2、3 步之后才需要 RPC；EOA 路径不依赖网络。
 */

/** 验签结果。`unavailable` 与 `invalid` 必须分开：前者是环境问题，不该让用户以为签名错了。 */
export type SignatureVerifyResult =
  | { status: "valid" }
  | { status: "invalid"; reason: string }
  | { status: "unavailable"; reason: string }

/** 目前只为这两条链配置了服务端 RPC；其余链只能验 EOA。 */
const CHAINS = {
  1: mainnet,
  8453: base,
} as const

type SupportedChainId = keyof typeof CHAINS

function isSupportedChainId(chainId: number): chainId is SupportedChainId {
  return chainId === 1 || chainId === 8453
}

function rpcUrlFor(chainId: SupportedChainId): string | null {
  return alchemyRpcUrl(chainId === 1 ? "ethereum" : "base")
}

/**
 * 校验一个 SIWE 消息上的签名。
 *
 * @param message 完整的 EIP-4361 消息原文
 * @param signature 钱包返回的签名（可能是 65 字节 EOA 签名，也可能是 1271 / 6492 编码）
 * @param chainId 消息里声明的链，用于选择 RPC
 */
export async function verifySiweSignature(params: {
  address: string
  message: string
  signature: string
  chainId: number
}): Promise<SignatureVerifyResult> {
  const { address, message, signature, chainId } = params

  // EOA 路径不需要 RPC。先用一个「不带 transport 也能算」的客户端跑一遍，
  // 只要签名是最朴素的 EOA 签名且地址匹配，这里就能直接判定成功。
  const eoaOnly = await verifyWithoutRpc(address, message, signature).catch(() => null)
  if (eoaOnly === true) {
    return { status: "valid" }
  }

  // 走到这里说明要么是合约账户签名，要么签名本身有问题。
  // 合约账户（1271 / 6492）必须上链校验，需要对应链的 RPC。
  //
  // 兼容性回退：Reown 的 Smart Account 地址在 Pimlico 支持的链上是一致的
  // （同一 factory + salt），所以用户在测试网登录时，可以在主网验同一个地址。
  // 这里先按消息声明的链验，该链没有 RPC 时再依次退到 Ethereum / Base。
  const candidates: SupportedChainId[] = isSupportedChainId(chainId)
    ? [chainId]
    : [1, 8453]

  let lastUnavailable: string | null = null
  for (const candidate of candidates) {
    const url = rpcUrlFor(candidate)
    if (!url) {
      lastUnavailable = "服务端未配置该链的 RPC，无法验证智能账户签名"
      continue
    }

    try {
      const client = createPublicClient({
        chain: CHAINS[candidate],
        transport: http(url, { timeout: 12_000, retryCount: 1 }),
      })
      const valid = await client.verifyMessage({
        address: address as Address,
        message,
        signature: signature as Hex,
      })
      if (valid) return { status: "valid" }
      // 链上明确判定无效 → 不再换链重试，直接定论
      return { status: "invalid", reason: "签名与地址不匹配" }
    } catch (error) {
      // 区分「网络/上游故障」与「签名确实无效」：前者不能告诉用户「你签名错了」
      const text = error instanceof Error ? error.message : String(error)
      if (/timeout|fetch failed|ECONNREFUSED|rate limit|429|5\d\d/i.test(text)) {
        lastUnavailable = "验证签名时上游 RPC 不可用，请稍后重试"
        continue
      }
      return { status: "invalid", reason: "签名校验未通过" }
    }
  }

  return {
    status: "unavailable",
    reason: lastUnavailable ?? `暂不支持在 chainId=${chainId} 上验证智能账户签名（ERC-1271/6492）`,
  }
}

/**
 * 纯本地 EOA 验签（无 RPC）。
 * 用 viem 的 `recoverMessageAddress` 而不是 `siwe.verify`，避免把 nonce/domain 的
 * 业务校验和密码学校验耦合在一起 —— 那部分由调用方单独做，错误码才能区分。
 */
async function verifyWithoutRpc(address: string, message: string, signature: string): Promise<boolean> {
  const { recoverMessageAddress } = await import("viem")
  const recovered = await recoverMessageAddress({
    message,
    signature: signature as Hex,
  })
  return recovered.toLowerCase() === address.toLowerCase()
}
