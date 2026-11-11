/**
 * 诊断 Waffo webhook 验签公钥：
 * 1) env 文件里存的值经过 SDK 归一化后能否解析
 * 2) 与 SDK 内置 TEST/PROD 公钥是否同一把
 * 3) 找出 env 值里非法字符的位置
 */
import fs from "node:fs"
import crypto from "node:crypto"

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

/** 与 SDK normalizePublicKey 完全一致的归一化 */
function normalizePublicKey(raw) {
  let pem = raw.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim()
  const hasSpki = pem.includes("-----BEGIN PUBLIC KEY-----")
  const hasPkcs1 = pem.includes("-----BEGIN RSA PUBLIC KEY-----")
  if (hasSpki || hasPkcs1) {
    const base64 = pem
      .replace(/-----BEGIN (?:RSA )?PUBLIC KEY-----/g, "")
      .replace(/-----END (?:RSA )?PUBLIC KEY-----/g, "")
      .replace(/\s+/g, "")
    const header = hasPkcs1
      ? "-----BEGIN RSA PUBLIC KEY-----"
      : "-----BEGIN PUBLIC KEY-----"
    const footer = hasPkcs1
      ? "-----END RSA PUBLIC KEY-----"
      : "-----END PUBLIC KEY-----"
    return `${header}\n${base64.match(/.{1,64}/g).join("\n")}\n${footer}`
  }
  const base64 = pem.replace(/\s+/g, "")
  if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) {
    const bad = []
    for (let i = 0; i < base64.length; i++) {
      const ch = base64[i]
      if (!/[A-Za-z0-9+/=]/.test(ch)) bad.push({ i, ch, code: ch.charCodeAt(0) })
    }
    throw new Error(
      "非 base64 字符: " +
        bad
          .slice(0, 12)
          .map((b) => `位置${b.i}=${JSON.stringify(b.ch)}(0x${b.code.toString(16)})`)
          .join(", "),
    )
  }
  return `-----BEGIN PUBLIC KEY-----\n${base64.match(/.{1,64}/g).join("\n")}\n-----END PUBLIC KEY-----`
}

function der(pem) {
  return crypto.createPublicKey(pem).export({ type: "spki", format: "der" }).toString("base64")
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
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (k === key) return v
  }
  return null
}

const sdkTest = grabFromSdk("TEST_PUBLIC_KEY")
const sdkProd = grabFromSdk("PROD_PUBLIC_KEY")

console.log("=== SDK 内置公钥 ===")
for (const [name, pem] of [
  ["TEST", sdkTest],
  ["PROD", sdkProd],
]) {
  try {
    console.log(`  ${name}: ✓ 可解析, base64 ${der(pem).length} 字符`)
  } catch (e) {
    console.log(`  ${name}: ✗ ${e.message}`)
  }
}

console.log()
console.log("=== 各 env 文件里的 webhook 验签公钥 ===")
for (const file of [
  ".env.local",
  ".env.development.local",
  ".env.preview.local",
  ".env.production.local",
  ".env.local.example",
]) {
  if (!fs.existsSync(file)) {
    console.log(`  ${file}: (文件不存在)`)
    continue
  }
  console.log(`  ${file}:`)
  for (const [envName, keyName] of [
    ["TEST", "WAFFO_WEBHOOK_TEST_PUBLIC_KEY"],
    ["PROD", "WAFFO_WEBHOOK_PROD_PUBLIC_KEY"],
  ]) {
    const raw = readEnv(file, keyName)
    if (!raw) {
      console.log(`     ${envName}: (未设置)`)
      continue
    }
    const hasHeader = raw.includes("-----BEGIN")
    const hasLiteralNewline = raw.includes("\\n")
    const hasRealNewline = raw.includes("\n")
    let status
    let derVal = null
    try {
      const pem = normalizePublicKey(raw)
      derVal = der(pem)
      status = `✓ 可解析, der ${derVal.length} 字符`
    } catch (e) {
      status = `✗ ${e.message}`
    }
    console.log(
      `     ${envName}: 长度 ${raw.length} | PEM头 ${hasHeader} | 字面\\n ${hasLiteralNewline} | 真实换行 ${hasRealNewline}`,
    )
    console.log(`        ${status}`)
    if (derVal) {
      const expect = envName === "TEST" ? sdkTest : sdkProd
      console.log(
        `        与 SDK 内置 ${envName} 相同? ${derVal === der(expect)}`,
      )
    }
  }
}

console.log()
console.log("=== SDK 内置 TEST vs PROD 是否同一把 ===")
try {
  console.log(`  ${der(sdkTest) === der(sdkProd) ? "同一把" : "不同两把"}`)
} catch {
  console.log("  无法比较")
}
