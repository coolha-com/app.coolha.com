// SIWE 端到端验证脚本（临时）：nonce → 签名 → 验签 → 会话 → 登出 → 重放攻击测试
// 使用 Hardhat/Anvil 公开测试账户 #0（无真实资产）
import { SiweMessage } from "siwe"
import { privateKeyToAccount } from "viem/accounts"

const BASE = "http://localhost:3000"
const PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
const account = privateKeyToAccount(PK)
const DOMAIN = "localhost:3000"

let cookie = ""
function captureCookie(res) {
  const setCookie = res.headers.get("set-cookie")
  if (setCookie) cookie = setCookie.split(";")[0]
}

async function main() {
  // 0. 地址一致性
  console.log("test account:", account.address)

  // 1. 取 nonce
  const nonceRes = await fetch(`${BASE}/api/wallet-auth/nonce?address=${account.address}&domain=${DOMAIN}`)
  const { nonce } = await nonceRes.json()
  console.log("1. nonce issued:", nonce.slice(0, 8) + "...")

  // 2. 构造 SIWE 消息并签名
  const message = new SiweMessage({
    domain: DOMAIN,
    address: account.address,
    statement: "Sign in to Coolha",
    uri: `http://${DOMAIN}`,
    version: "1",
    chainId: 1,
    nonce,
  })
  const prepared = message.toMessage()
  const signature = await account.signMessage({ message: prepared })
  console.log("2. signed, signature:", signature.slice(0, 18) + "...")

  // 3. 验签 + 建会话
  const verifyRes = await fetch(`${BASE}/api/wallet-auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prepared, signature }),
  })
  captureCookie(verifyRes)
  const verifyJson = await verifyRes.json()
  console.log("3. verify:", verifyRes.status, JSON.stringify(verifyJson))

  // 4. 会话恢复
  const sessionRes = await fetch(`${BASE}/api/wallet-auth/session`, { headers: { cookie } })
  const sessionJson = await sessionRes.json()
  console.log("4. session:", JSON.stringify(sessionJson))

  // 5. 重放攻击（同一签名再提交）→ 应被拒
  const replayRes = await fetch(`${BASE}/api/wallet-auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prepared, signature }),
  })
  const replayJson = await replayRes.json()
  console.log("5. replay rejected:", replayRes.status, JSON.stringify(replayJson))

  // 6. 登出
  const signoutRes = await fetch(`${BASE}/api/wallet-auth/signout`, {
    method: "POST",
    headers: { cookie },
  })
  console.log("6. signout:", signoutRes.status)

  // 7. 登出后会话应为空
  const afterRes = await fetch(`${BASE}/api/wallet-auth/session`, { headers: { cookie } })
  const afterJson = await afterRes.json()
  console.log("7. session after signout:", JSON.stringify(afterJson))

  // 8. 伪造签名测试（错误签名）→ 应 401
  const nonce2 = await (await fetch(`${BASE}/api/wallet-auth/nonce?address=${account.address}&domain=${DOMAIN}`)).json()
  const msg2 = new SiweMessage({
    domain: DOMAIN, address: account.address, statement: "Sign in to Coolha",
    uri: `http://${DOMAIN}`, version: "1", chainId: 1, nonce: nonce2.nonce,
  }).toMessage()
  const badRes = await fetch(`${BASE}/api/wallet-auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: msg2, signature: "0x" + "11".repeat(65) }),
  })
  const badJson = await badRes.json()
  console.log("8. bad signature rejected:", badRes.status, JSON.stringify(badJson))

  const pass =
    verifyRes.status === 200 &&
    sessionJson.address === account.address.toLowerCase() &&
    replayRes.status === 400 &&
    signoutRes.status === 200 &&
    afterJson.address === null &&
    badRes.status === 401
  console.log(pass ? "E2E_RESULT: ALL_PASS" : "E2E_RESULT: FAIL")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error("E2E_ERROR:", e.message)
  process.exit(1)
})
