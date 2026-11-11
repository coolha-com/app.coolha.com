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

  lines.push(...block("Agent 访问模式（不收款）"))
  lines.push("# local_open 只在本机生效；preview_open 只在 Vercel Preview 的 agent / cursor 分支生效。")
  lines.push("# 生产环境即使写了开放模式也会被服务端拒绝。不要把 COOLHA_EVE_LOCAL 同步到 Vercel。")
  lines.push("AGENT_ACCESS_MODE=" + (o.accessMode ?? ""))
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

// 本地：dev 分支库。当前不收款。
fs.writeFileSync(
  resolve(ROOT, ".env.local"),
  render({
    title: ".env.local — 本地开发（开发 / 测试环境）",
    dbNote: "dev 分支 ep-gentle-rain",
    payNote: "当前不收款",
    purpose: "npm run dev / npm run dev:all 用的基线。",
    db: devDb,
    accessMode: "local_open",
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
    payNote: "当前不收款",
    purpose: "next dev 时优先级高于 .env.local。",
    db: devDb,
    accessMode: "local_open",
    eveLocal: "1",
    eveOrigin: "",
    eveSecret: "",
  }),
)

// 预览：dev 分支库。访问模式由 Vercel 分支变量决定，不写进这个镜像。
fs.writeFileSync(
  resolve(ROOT, ".env.preview.local"),
  render({
    title: ".env.preview.local — Vercel「Preview」环境镜像",
    dbNote: "dev 分支 ep-gentle-rain",
    payNote: "当前不收款",
    purpose: "预览部署用的变量（Next 不加载本文件，仅作对照）。",
    db: devDb,
    accessMode: "",
    eveLocal: null,
    eveOrigin: "",
    eveSecret: "",
  }),
)

// .env.production.local —— **只放生产环境用的变量**。
// 开发测试用的变量一律在 .env.development.local，不要往这个文件里塞。
// 当前还没有生产环境，所以这里的值全空。
fs.writeFileSync(
  resolve(ROOT, ".env.production.local"),
  [
    "# ══════════════════════════════════════════════════════════════════",
    "# .env.production.local — 只放**生产环境**用的变量",
    "#   当前还没有生产环境：收款与数据库都在开发测试环境。",
    "#   开发测试用的变量在 .env.development.local，不要往这里复制。",
    "# ══════════════════════════════════════════════════════════════════",
    "",
    "# ────────────────────────────────────────────────────────────",
    "# 生产环境专属变量（当前全部留空）",
    "# ────────────────────────────────────────────────────────────",
    "",
    "# 生产不开放未经授权的 Agent 执行。不要在这里写 local_open / preview_open。",
    "AGENT_ACCESS_MODE=",
    "",
    "# ────────────────────────────────────────────────────────────",
    "# 生产数据库（Neon Postgres · main 分支）",
    "#   与开发测试库（dev 分支）完全隔离，换库必须同步换 NEON_AUTH_BASE_URL。",
    "# ────────────────────────────────────────────────────────────",
    "DATABASE_URL=",
    "DATABASE_URL_UNPOOLED=",
    "NEON_AUTH_BASE_URL=",
    "",
  ].join("\n"),
)

// 模板：全部敏感值留空
fs.writeFileSync(
  resolve(ROOT, ".env.local.example"),
  render({
    title: ".env.local.example — 变量模板（照着填）",
    dbNote: "dev 分支",
    payNote: "当前不收款",
    purpose: "新环境从这里拷。密钥一律留空，不要提交真值。",
    db: { DATABASE_URL: "", DATABASE_URL_UNPOOLED: "", NEON_AUTH_BASE_URL: "" },
    accessMode: "local_open",
    eveLocal: "1",
    eveOrigin: "",
    eveSecret: "",
    blank: true,
  }),
)
console.log("已生成 5 个 env 文件")
