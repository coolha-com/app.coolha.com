import "server-only"

import { WaffoPancake } from "@waffo/pancake-ts"

/**
 * Waffo Pancake（Merchant of Record）接入层。
 *
 * 定位：coolha 卖的是 **Agent 执行与交付服务**，不是算力也不是 token 额度。
 * 法币收款全部由 Waffo 作 MoR 承载（银行卡 / Apple Pay / Google Pay），
 * 我们只负责「发起收银台 → 收到已签名回调 → 核销订单」，不碰持卡数据。
 *
 * 三个环境变量是硬门槛（Dashboard → API 与开发 → Create an API Key）：
 *   - WAFFO_MERCHANT_ID  商户 ID（MER_…），**不是** storeId
 *   - WAFFO_PRIVATE_KEY   RSA 私钥；SDK 会自动归一化 PEM / PKCS#1 / 裸 base64
 *   - WAFFO_STORE_ID      店铺 ID（STO_…），运行时值
 * 另外三个是业务配置：
 *   - WAFFO_ENVIRONMENT   test | prod，决定用哪把 webhook 公钥验签
 *   - WAFFO_PRODUCT_ID    一次性 Agent 服务商品（Dashboard 的 one-time product）
 *   - WAFFO_CURRENCY      结算币种，默认 USD
 *
 * ⚠️ 私钥只在本文件的服务端读取，绝不能进 NEXT_PUBLIC_* 或任何客户端组件。
 */

/** Waffo 的两种运行环境：test = 沙箱（不产生真实扣款），prod = 正式收款 */
export type WaffoEnvironment = "test" | "prod"

/** 配置类错误：与环境变量/密钥有关，路由应当返回 5xx 而不是 5xx 之外的怪状态 */
export class WaffoConfigError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "WaffoConfigError"
    this.code = code
  }
}

export interface WaffoConfig {
  merchantId: string
  privateKey: string
  storeId: string
  environment: WaffoEnvironment
  /** 一次性 Agent 服务商品 ID */
  productId: string
  /** 结算币种（ISO 4217） */
  currency: string
}

/**
 * 一次性 Agent 服务商品（Dashboard 建的 one-time product，$19/次）。
 * 可用 WAFFO_PRODUCT_ID 覆盖；换商品只改环境变量，不动代码。
 */
const DEFAULT_PRODUCT_ID = "PROD_4yvNFDfR3pynj7PmAooWSG"
const DEFAULT_CURRENCY = "USD"

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new WaffoConfigError("WAFFO_NOT_CONFIGURED", `缺少环境变量 ${name}`)
  }
  return value.trim()
}

function readEnv(name: string, fallback: string): string {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : fallback
}

/** 读取并校验 Waffo 配置；缺变量就抛 WaffoConfigError（不返回半个可用的配置） */
export function getWaffoConfig(): WaffoConfig {
  const environment = readEnv("WAFFO_ENVIRONMENT", "test").toLowerCase()
  if (environment !== "test" && environment !== "prod") {
    throw new WaffoConfigError(
      "WAFFO_BAD_ENVIRONMENT",
      `WAFFO_ENVIRONMENT 只能是 test 或 prod，收到「${environment}」`,
    )
  }

  return {
    merchantId: requireEnv("WAFFO_MERCHANT_ID"),
    // 私钥保持原样交给 SDK：它能识别 PEM、PKCS#1、字面 \n 与裸 base64
    privateKey: requireEnv("WAFFO_PRIVATE_KEY"),
    storeId: requireEnv("WAFFO_STORE_ID"),
    environment,
    productId: readEnv("WAFFO_PRODUCT_ID", DEFAULT_PRODUCT_ID),
    currency: readEnv("WAFFO_CURRENCY", DEFAULT_CURRENCY),
  }
}

/**
 * Waffo 客户端单例。
 *
 * 构造函数在私钥非法时会立刻抛异常，所以这里做懒加载 + 缓存：
 * 配置没就绪时不影响整个应用启动，只有真正调用支付接口才会失败。
 */
let cachedClient: WaffoPancake | null = null
let cachedPrivateKey: string | null = null

export function getWaffoClient(): WaffoPancake {
  const config = getWaffoConfig()
  if (cachedClient && cachedPrivateKey === config.privateKey) {
    return cachedClient
  }

  try {
    cachedClient = new WaffoPancake({
      merchantId: config.merchantId,
      privateKey: config.privateKey,
      // API Key 请求的 test/prod 由网关按 key 自行判定；
      // 这里显式声明只影响 customer session 与验签选钥，行为一致不冲突。
      environment: config.environment,
    })
  } catch (error) {
    throw new WaffoConfigError(
      "WAFFO_INVALID_CREDENTIALS",
      `Waffo 凭据不可用：${error instanceof Error ? error.message : String(error)}`,
    )
  }

  cachedPrivateKey = config.privateKey
  return cachedClient
}

/**
 * Webhook 验签参数。
 *
 * ⚠️ 这里**故意不返回 environment**，让 SDK 自动回退：
 * 不传 environment 时 SDK 先试 prod 公钥、失败再试 test 公钥（实测 SDK 源码）。
 * 这样**同一个 URL 可以同时接收沙箱与正式投递**，不必为两个环境来回改 webhook 地址。
 *
 * 取钥顺序（SDK 内置）：options.publicKey → config.webhookPublicKey →
 * `WAFFO_WEBHOOK_{TEST|PROD}_PUBLIC_KEY` → `WAFFO_WEBHOOK_PUBLIC_KEY` → SDK 内置公钥。
 * 所以两个环境的公钥**都要配齐**（env 里是单行 PEM，换行写成字面 `\n`），
 * 否则回退的那把会落到 SDK 内置公钥上；平台轮换过 key 时内置公钥已失效 → 验签必挂。
 */
export function getWaffoWebhookVerifyOptions(): { environment?: WaffoEnvironment } {
  return {}
}

/**
 * 是否测试模式：前端用它显示「不会产生真实扣款」的提示。
 *
 * 读不到配置时**按测试模式处理**——宁可多提示一次，也不谎称能真实扣款。
 */
export function isWaffoTestMode(): boolean {
  try {
    return getWaffoConfig().environment === "test"
  } catch {
    return true
  }
}
