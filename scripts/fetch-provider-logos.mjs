/**
 * 下载供应商 Logo 到 public/logos/providers/。
 *
 * 优先取 Vercel AI Gateway 官方展示用的 PNG（与 vercel.com/ai-gateway/models 同源），
 * 缺失时回退 models.dev（AI SDK 官方模型注册表）的 SVG。
 * 资源落到本地仓库，避免运行时热链第三方 CDN。
 *
 * 用法：node scripts/fetch-provider-logos.mjs
 */

import { mkdir, writeFile, stat } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const OUT_DIR = resolve(ROOT, "public/logos/providers")

const VERCEL_BLOB =
  "https://7nyt0uhk7sse4zvn.public.blob.vercel-storage.com/docs-assets/static/docs/ai-gateway/logos"
const MODELS_DEV = "https://models.dev/logos"

/** owned_by → Vercel blob 文件名（null 表示该源没有，直接用 models.dev） */
const VERCEL_LOGO_FILES = {
  alibaba: "alibaba%20cloud.png",
  amazon: "amazon%20bedrock.png",
  anthropic: "anthropic.png",
  "arcee-ai": "arcee-ai-256.png",
  bfl: "blackforestlabs.png",
  bytedance: "bytedance.png",
  callstack: "callstack.png",
  cohere: "cohere.png",
  convaiinnovations: null,
  deepseek: "deepseek.png",
  fireworks: "fireworks.png",
  "fish-audio": "fish-audio.png",
  google: "google.png",
  heygen: "heygen.png",
  inception: "inception.png",
  inclusionai: null,
  "inference-net": "inferencenet.png",
  interfaze: "interfaze.png",
  klingai: "klingai.png",
  liquid: "liquid.png",
  meituan: "meituan.png",
  meta: "meta.png",
  microsoft: "mai.png",
  minimax: "minimax.png",
  mistral: "mistral.png",
  mixedbread: "mixedbread.png",
  moonshotai: "moonshotai.png",
  morph: "morph.png",
  nvidia: "nvidia.png",
  openai: "openai.png",
  perplexity: "perplexity.png",
  poolside: "poolside.png",
  prodia: "prodia.png",
  quiverai: "quiverai.png",
  recraft: "recraft.png",
  sakana: "sakana.png",
  scaledown: "scaledown.png",
  spacexai: "spacexai.png",
  stealth: "stealth.png",
  stepfun: "stepfun.png",
  tencent: "tencent.png",
  thinkingmachines: "thinkingmachines.png",
  topaz: "topaz.png",
  "typesafe-ai": "typesafe.png",
  voyage: "voyage.png",
  xiaomi: "xiaomi.png",
  zai: "zai-256.png",
}

/** models.dev 的占位图大小（字节）：等于该值时视为「无真实 logo」 */
const MODELS_DEV_PLACEHOLDER_BYTES = 1421

async function download(url, timeoutMs = 15_000) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: "image/*" },
  })
  if (!response.ok) return null
  const buffer = Buffer.from(await response.arrayBuffer())
  return { buffer, contentType: response.headers.get("content-type") ?? "" }
}

function isSvgLike(contentType, buffer) {
  if (contentType.includes("svg")) return true
  const head = buffer.subarray(0, 200).toString("utf8").trimStart().toLowerCase()
  return head.startsWith("<svg") || head.startsWith("<?xml")
}

async function fetchOne(providerId) {
  const vercelFile = VERCEL_LOGO_FILES[providerId]
  const candidates = []

  if (vercelFile) {
    candidates.push({
      url: `${VERCEL_BLOB}/${vercelFile}`,
      ext: vercelFile.endsWith(".svg") ? "svg" : "png",
      source: "vercel",
    })
  }
  candidates.push({ url: `${MODELS_DEV}/${providerId}.svg`, ext: "svg", source: "models.dev" })

  for (const candidate of candidates) {
    const result = await download(candidate.url).catch(() => null)
    if (!result) continue

    // models.dev 对未知 provider 返回同尺寸占位图，需要排除
    if (
      candidate.source === "models.dev" &&
      result.buffer.byteLength === MODELS_DEV_PLACEHOLDER_BYTES
    ) {
      continue
    }

    const ext = isSvgLike(result.contentType, result.buffer) ? "svg" : candidate.ext
    const target = resolve(OUT_DIR, `${providerId}.${ext}`)
    await writeFile(target, result.buffer)
    return { providerId, source: candidate.source, ext, bytes: result.buffer.byteLength }
  }

  return { providerId, source: null, ext: null, bytes: 0 }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const ids = Object.keys(VERCEL_LOGO_FILES)
  const results = []

  // 串行下载，避免对 CDN 造成突发压力
  for (const id of ids) {
    results.push(await fetchOne(id))
  }

  const ok = results.filter((item) => item.source)
  const missing = results.filter((item) => !item.source)

  console.log(`\n已下载 ${ok.length}/${ids.length} 个供应商 Logo → public/logos/providers/`)
  for (const item of ok) {
    console.log(`  ✓ ${item.providerId.padEnd(18)} ${item.source.padEnd(11)} ${item.ext} ${item.bytes}B`)
  }
  if (missing.length > 0) {
    console.log(`\n无官方 Logo（UI 回退首字母）：${missing.map((item) => item.providerId).join(", ")}`)
  }

  const manifest = Object.fromEntries(
    ok.map((item) => [item.providerId, `/logos/providers/${item.providerId}.${item.ext}`]),
  )
  await writeFile(
    resolve(OUT_DIR, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  )
  const manifestStat = await stat(resolve(OUT_DIR, "manifest.json"))
  console.log(`\nmanifest.json 已写入（${manifestStat.size}B，${Object.keys(manifest).length} 条）`)

  // 同步生成可直接 import 的 TS 清单，避免运行时读盘 / 依赖 resolveJsonModule
  const generated = `// 由 scripts/fetch-provider-logos.mjs 自动生成，请勿手改。
// owned_by → 本地 Logo 路径；未列出的供应商由 UI 回退到首字母标识。

export const PROVIDER_LOGO_PATHS: Record<string, string> = ${JSON.stringify(manifest, null, 2)}
`
  const generatedPath = resolve(ROOT, "src/lib/ai-gateway/provider-logos.generated.ts")
  await writeFile(generatedPath, generated, "utf8")
  console.log(`已生成 src/lib/ai-gateway/provider-logos.generated.ts`)
}

main().catch((error) => {
  console.error("下载 Logo 失败:", error)
  process.exit(1)
})
