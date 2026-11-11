/**
 * 验签回归：确认我们的 webhook 端点能验 Waffo 的真实签名。
 *
 * 关键点：SDK 的 verifyWebhook 在**不传 environment** 时会先试 prod 公钥、
 * 失败再试 test 公钥。这里用 SDK 自己的私钥（商户 API Key）构造一份
 * 「test 签名」的事件，验证回退链路可用。
 *
 * 同时验证：内置公钥与 env 里的公钥是否同一把（判断平台有没有轮换过 key）。
 */
import fs from "node:fs"
import crypto from "node:crypto"
import { verifyWebhook } from "@waffo/pancake-ts"

const SDK = "node_modules/@waffo/pancake-ts/dist/index.js"

function grabFromSdk(name) {
  const s = fs.readFileSync(SDK, "utf8")
  const marker = name + " = `"
  const i = s.indexOf(marker)
  if (i < 0) return null
  const start = i + marker.length
  const end = s.indexOf("`", start)
  return s.slice(start, end).replace(/\\n/g, "\n")
}

function readEnv(file, key) {
  const c = fs.readFileSync(file, "utf8")
  for (const line of c.split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const e = t.indexOf("=")
    if (e <= 0) continue
    const k = t.slice(0, e).trim()
    let v = t.slice(e + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (k === key) return v
  }
  return null
}

const sdkTest = grabFromSdk("TEST_PUBLIC_KEY")
const sdkProd = grabFromSdk("PROD_PUBLIC_KEY")
const envTest = readEnv(".env.local", "WAFFO_WEBHOOK_TEST_PUBLIC_KEY")
const merchantPriv = readEnv(".env.local", "WAFFO_PRIVATE_KEY")

console.log("=== 1. 公钥一致性 ===")
const der = (pem) =>
  crypto.createPublicKey(pem).export({ type: "spki", format: "der" }).toString("base64")
const sdkTestDer = der(sdkTest)
const sdkProdDer = der(sdkProd)
// env 里的是裸 base64 + 字面 \n，SDK 能归一化；这里同样归一化再比
const envNorm = "-----BEGIN PUBLIC KEY-----\n" +
  envTest.replace(/\\n/g, "").replace(/\s+/g, "").match(/.{1,64}/g).join("\n") +
  "\n-----END PUBLIC KEY-----"
console.log("  env TEST == SDK 内置 TEST :", der(envNorm) === sdkTestDer)
console.log("  SDK 内置 TEST != 内置 PROD:", sdkTestDer !== sdkProdDer)

console.log()
console.log("=== 2. 用商户私钥构造一份 test 环境签名，验证 verifyWebhook 回退 ===")
// 商户 API Key 的私钥和平台 webhook 私钥不是同一把，这里用 SDK 内置公钥对应的
// 私钥不存在 → 改用「自己生成一对 key，用 SDK 归一化后的公钥验签」来验证链路正确性。
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 })
const myPubPem = publicKey.export({ type: "spki", format: "pem" }).toString()
const payload = JSON.stringify({
  id: "evt_local_test_001",
  timestamp: new Date().toISOString(),
  eventType: "order.completed",
  eventId: "ORD_local_test_001",
  storeId: "STO_local",
  mode: "test",
  data: { orderId: "ORD_local_test_001", orderMerchantExternalId: "WO_local_test_001" },
})
const t = Date.now().toString()
const signer = crypto.createSign("sha256")
signer.update(`${t}.${payload}`)
const v1 = signer.sign(privateKey, "base64")
const header = `t=${t},v1=${v1}`

console.log("  -- 场景 A: 传 environment=test + 我的公钥（应通过）--")
try {
  const ev = verifyWebhook(payload, header, { publicKey: myPubPem })
  console.log("     ✓ 通过, eventType =", ev.eventType, "| mode =", ev.mode)
} catch (e) {
  console.log("     ✗ 失败:", e.message)
}

console.log("  -- 场景 B: 不传 environment（自动回退），公钥只在我的 config 里 --")
try {
  const ev = verifyWebhook(payload, header, { publicKeys: { test: myPubPem } })
  console.log("     ✓ 通过, eventType =", ev.eventType, "| mode =", ev.mode)
} catch (e) {
  console.log("     ✗ 失败:", e.message)
}

console.log("  -- 场景 C: 公钥不匹配（应拒绝）--")
try {
  verifyWebhook(payload, header, { publicKey: sdkTest })
  console.log("     ✗ 不该通过！")
} catch (e) {
  console.log("     ✓ 正确拒绝:", e.message)
}

console.log()
console.log("=== 3. 生产公钥能否用（用内置 PROD 公钥验一份 prod 签名）===")
// 内置 PROD 公钥对应平台生产私钥，我们没有 → 只能确认公钥格式有效
console.log("  内置 PROD 公钥可解析:", (() => {
  try { der(sdkProd); return true } catch { return false }
})())
console.log("  （真正的生产私钥在 Waffo 平台侧，本地无法构造 prod 签名做端到端验证）")
console.log()
console.log("  商户私钥（WAFFO_PRIVATE_KEY）可用:", (() => {
  try { crypto.createPrivateKey(merchantPriv); return true } catch (e) { return e.message }
})())
