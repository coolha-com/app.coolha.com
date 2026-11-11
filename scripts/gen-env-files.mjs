import fs from "node:fs"
import { resolve } from "node:path"

const ROOT = resolve(process.cwd())

function parse(p) {
  const m = {}
  for (const line of fs.readFileSync(resolve(ROOT, p), "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const e = t.indexOf("=")
    if (e <= 0) continue
    let v = t.slice(e + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    m[t.slice(0, e).trim()] = v
  }
  return m
}

const base = parse(".env.local")
const dev = parse(".env.development.local")

const BAR = "═".repeat(66)
const RULE = "─".repeat(60)

function header(title, dbNote, payNote, purpose) {
  return [
    `# ${BAR}`,
    `# ${title}`,
    `#   数据库：${dbNote}  ·  收款：${payNote}`,
    `#   用途：${purpose}`,
    `# ${BAR}`,
    "",
  ]
}

function block(title) {
  return [`# ${RULE}`, `# ${title}`, `# ${RULE}`, ""]
}

/**
 * @param {object} o
 * @param {string} o.title 文件标题
 * @param {string} o.dbNote
 * @param {string} o.payNote
 * @param {string} o.purpose
 * @param {object} o.db   数据库三件套
 * @param {"test"|"prod"} o.environment
 * @param {string} o.privateKey
 * @param {string} o.productId
 * @param {string} o.testPublicKey
 * @param {string} o.prodPublicKey
 * @param {string|null} o.eveLocal
 * @param {string|null} o.eveOrigin
 * @param {string|null} o.eveSecret
 * @param {boolean} o.blank 模板文件：所有敏感值留空
 */
function render(o) {
  const v = (x) => (o.blank ? "" : (x ?? ""))
  const lines = []
  lines.push(...header(o.title, o.dbNote, o.payNote, o.purpose))

  if (o.eveLocal !== null) {
    lines.push(...block("本地专用（不同步到 Vercel）"))
    lines.push("# `next start` 也是 NODE_ENV=production；没有它，/eve/v1/* 不会 rewrite 到本机 Runtime。")
    lines.push("COOLHA_EVE_LOCAL=" + o.eveLocal)
    lines.push("")
  }

  lines.push(...block("统一推理网关（OpenAI 兼容 · OpenRouter）"))
  lines.push("# 换厂商只改这几行，代码不动。白名单外的模型会被服务端拒掉。")
  lines.push("INFERENCE_BASE_URL=" + v(o.blank ? "https://openrouter.ai/api/v1" : base.INFERENCE_BASE_URL))
  lines.push("INFERENCE_API_KEY=" + v(base.INFERENCE_API_KEY))
  lines.push("INFERENCE_GATEWAY_NAME=OpenRouter")
  lines.push("INFERENCE_MODELS=" + v(base.INFERENCE_MODELS))
  lines.push("INFERENCE_DEFAULT_MODEL=" + v(base.INFERENCE_DEFAULT_MODEL))
  lines.push("INFERENCE_CONTEXT_WINDOW=" + v(base.INFERENCE_CONTEXT_WINDOW))
  lines.push("")

  lines.push(...block("Agent 运行时（eve Runtime）"))
  lines.push("# 云端必须显式配：缺任一项，/api/eve/v1/* 返回 503（fail-closed）。")
  lines.push("# 本地由 npm run dev:all 自动注入这两个值。")
  lines.push("EVE_RUNTIME_ORIGIN=" + (o.eveOrigin ?? ""))
  lines.push("EVE_INTERNAL_SECRET=" + (o.eveSecret ?? ""))
  lines.push("")

  lines.push(...block("收款（Waffo · Merchant of Record）"))
  lines.push("# 一次购买 = 一份服务授权：19 U/次 · 30 天有效 · token 价值上限 10 USD。")
  lines.push("# 商户 / 店铺 / 商品：DASHBOARD → API 与开发 · 产品")
  lines.push("WAFFO_MERCHANT_ID=" + v(base.WAFFO_MERCHANT_ID))
  lines.push("# RSA 私钥：只在本机/服务端读取，绝不能进客户端")
  lines.push("WAFFO_PRIVATE_KEY=" + v(o.privateKey))
  lines.push("WAFFO_STORE_ID=" + v(base.WAFFO_STORE_ID))
  lines.push("# test = 沙箱（不产生真实扣款）；prod = 真实收款")
  lines.push("WAFFO_ENVIRONMENT=" + o.environment)
  lines.push("WAFFO_PRODUCT_ID=" + v(o.productId))
  lines.push("WAFFO_CURRENCY=USD")
  lines.push("# Webhook 验签公钥：必须单行（多行会被 .env 解析器截断，验签 100% 失败）")
  lines.push("# DASHBOARD → 设置 → Webhooks → RSA Public Key")
  lines.push("WAFFO_WEBHOOK_TEST_PUBLIC_KEY=" + v(o.testPublicKey))
  lines.push("WAFFO_WEBHOOK_PROD_PUBLIC_KEY=" + v(o.prodPublicKey))
  lines.push("")

  lines.push(...block("数据库（Neon Postgres）"))
  lines.push("# 直连迁移用 *_UNPOOLED（PgBouncer 事务模式下会话级操作不可靠）")
  lines.push("DATABASE_URL=" + v(o.db.DATABASE_URL))
  lines.push("DATABASE_URL_UNPOOLED=" + v(o.db.DATABASE_URL_UNPOOLED))
  lines.push("")

  lines.push(...block("认证（Neon Managed Auth）"))
  lines.push("# 与数据库同分支：换库必须同步换这个地址")
  lines.push("NEON_AUTH_BASE_URL=" + v(o.db.NEON_AUTH_BASE_URL))
  lines.push("NEON_AUTH_COOKIE_SECRET=" + v(base.NEON_AUTH_COOKIE_SECRET))
  lines.push("")

  lines.push(...block("第三方与平台开关"))
  lines.push("# Alchemy（只读链上数据）")
  lines.push("ALCHEMY_ID=" + v(base.ALCHEMY_ID))
  lines.push("ALCHEMY_KEY=" + v(base.ALCHEMY_KEY))
  lines.push("ALCHEMY_WEBHOOK_SIGNING_KEY=" + v(base.ALCHEMY_WEBHOOK_SIGNING_KEY))
  lines.push("")
  lines.push("# Reown（AppKit / wagmi）")
  lines.push("REOWN_ID=" + v(base.REOWN_ID))
  lines.push("NEXT_PUBLIC_REOWN_ID=" + v(base.REOWN_ID))
  lines.push("")
  lines.push("# 钱包一键签名登录：连钱包 → 自动弹签名 → 签完即登录")
  lines.push("NEXT_PUBLIC_SIWE_ONECLICK=1")
  lines.push("")
  lines.push("# 定时任务鉴权")
  lines.push("CRON_SECRET=" + v(base.CRON_SECRET))
  lines.append
  lines.push("")
  lines.push("# 订阅收款地址")
  lines.push("SUBSCRIPTION_TREASURY_ADDRESS=" + v(base.SUBSCRIPTION_TREASURY_ADDRESS))
  lines.push("")
  lines.push("# 免费模型（赞助额度）开关")
  lines.push("FREE_MODELS_ENABLED=1")
  lines.push("")

  return lines.join("\n")
}

const devDb = {
  DATABASE_URL: dev.DATABASE_URL,
  DATABASE_URL_UNPOOLED: dev.DATABASE_URL_UNPOOLED,
  NEON_AUTH_BASE_URL: dev.NEON_AUTH_BASE_URL,
}
const prodDb = {
  DATABASE_URL: base.DATABASE_URL,
  DATABASE_URL_UNPOOLED: base.DATABASE_URL_UNPOOLED,
  NEON_AUTH_BASE_URL: base.NEON_AUTH_BASE_URL,
}

const TEST_KEY = base.WAFFO_PRIVATE_KEY
const TEST_PRODUCT = base.WAFFO_PRODUCT_ID
const TEST_PUB = base.WAFFO_WEBHOOK_TEST_PUBLIC_KEY

// 本地：dev 分支库 + Waffo test
fs.writeFileSync(
  resolve(ROOT, ".env.local"),
  render({
    title: ".env.local — 本地开发（开发 / 测试环境）",
    dbNote: "dev 分支 ep-gentle-rain",
    payNote: "Waffo test 沙箱",
    purpose: "npm run dev / npm run dev:all 用的基线。",
    db: devDb,
    environment: "test",
    privateKey: TEST_KEY,
    productId: TEST_PRODUCT,
    testPublicKey: TEST_PUB,
    prodPublicKey: "",
    eveLocal: "1",
    eveOrigin: "",
    eveSecret: "",
  }),
)

// 开发：与本地同源（Next 在 dev 下优先读它）
fs.writeFileSync(
  resolve(ROOT, ".env.development.local"),
  render({
    title: ".env.development.local — Vercel「Development」环境镜像",
    dbNote: "dev 分支 ep-gentle-rain",
    payNote: "Waffo test 沙箱",
    purpose: "next dev 时优先级高于 .env.local。",
    db: devDb,
    environment: "test",
    privateKey: TEST_KEY,
    productId: TEST_PRODUCT,
    testPublicKey: TEST_PUB,
    prodPublicKey: "",
    eveLocal: "1",
    eveOrigin: "",
    eveSecret: "",
  }),
)

// 预览：dev 分支库 + Waffo test
fs.writeFileSync(
  resolve(ROOT, ".env.preview.local"),
  render({
    title: ".env.preview.local — Vercel「Preview」环境镜像",
    dbNote: "dev 分支 ep-gentle-rain",
    payNote: "Waffo test 沙箱",
    purpose: "预览部署用的变量（Next 不加载本文件，仅作对照）。",
    db: devDb,
    environment: "test",
    privateKey: TEST_KEY,
    productId: TEST_PRODUCT,
    testPublicKey: TEST_PUB,
    prodPublicKey: "",
    eveLocal: null,
    eveOrigin: "",
    eveSecret: "",
  }),
)

// 生产：main 分支库 + Waffo prod（凭据待补，不塞测试私钥）
fs.writeFileSync(
  resolve(ROOT, ".env.production.local"),
  render({
    title: ".env.production.local — Vercel「Production」环境镜像",
    dbNote: "main 分支 ep-tiny-wildflower",
    payNote: "Waffo prod 真实收款",
    purpose: "生产部署用的变量（Next 不加载本文件，仅作对照）。",
    db: prodDb,
    environment: "prod",
    privateKey: "",
    productId: "",
    testPublicKey: "",
    prodPublicKey: "",
    eveLocal: null,
    eveOrigin: "",
    eveSecret: "",
  }),
)

// 模板：全部敏感值留空
fs.writeFileSync(
  resolve(ROOT, ".env.local.example"),
  render({
    title: ".env.local.example — 变量模板（照着填）",
    dbNote: "dev 分支",
    payNote: "Waffo test 沙箱",
    purpose: "新环境从这里拷。密钥一律留空，不要提交真值。",
    db: { DATABASE_URL: "", DATABASE_URL_UNPOOLED: "", NEON_AUTH_BASE_URL: "" },
    environment: "test",
    privateKey: "",
    productId: "",
    testPublicKey: "",
    prodPublicKey: "",
    eveLocal: "1",
    eveOrigin: "",
    eveSecret: "",
    blank: true,
  }),
)

console.log("已生成 5 个 env 文件")
