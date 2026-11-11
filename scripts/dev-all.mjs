/**
 * 本地并行启动 Next.js 与 eve Agent Runtime（零依赖）。
 *
 * 链路（桥接点在 next.config.ts 的 rewrites）：
 *   browser → :3000/eve/v1/* → /api/eve/v1/* 受控代理 → :4274 eve Runtime
 *
 * 为什么要两个进程：eve@1.0.0-rc.8 的 withEve() dev host 在 Windows 上把
 * 绝对路径拼成 "./C:/..."，会产生 UNRESOLVED_IMPORT 并带崩 next dev；
 * 所以 eve 走独立 Runtime，由 Next 侧 rewrite + 受控代理转发。rc.9 未修该问题。
 *
 * 用法：
 *   npm run dev:all              用现有 .output 产物同时起两个服务
 *   npm run dev:all:rebuild      先重建 eve 产物，再启动（改了 agent/ 后用）
 *
 * 行为：
 *   - 端口已占用就跳过对应进程，绝不误杀你正在看的服务
 *   - 显式注入 COOLHA_EVE_LOCAL=1 / EVE_INTERNAL_SECRET（eve 进程不读 .env.local）
 *   - 去掉 NODE_OPTIONS（safe-delete shim 会导致 EPERM）
 *   - 自动挑选 Node >= 24（eve engines 要求）；任一子进程退出则一起收摊
 *   - 透传 INFERENCE_* 推理网关配置。eve 是独立 Nitro 进程，**不读 .env.local**，
 *     所以这些变量必须从 shell 环境显式继承；Next 侧则由 .env*.local 自行加载。
 */

import net from "node:net"
import { spawn, spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const NEXT_PORT = 3000
const EVE_PORT = 4274
const LOCAL_SECRET = "coolha-local-eve-proxy" // 与 route.ts / channels/eve.ts 的 DEV_SECRET 一致

const eveBin = path.join(root, "node_modules/eve/bin/eve.js")
const nextBin = path.join(root, "node_modules/next/dist/bin/next")
const eveEntry = path.join(root, ".output/server/index.mjs")

function resolveRuntime() {
  const major = Number(process.versions.node.split(".")[0])
  if (major >= 24) return process.execPath
  // Windows 本机常见：shell 默认 22，C:\Program Files\nodejs 是 24
  if (process.platform === "win32") {
    const candidate = "C:/Program Files/nodejs/node.exe"
    if (existsSync(candidate)) return candidate
  }
  console.error(
    "eve 要求 Node >= 24，当前是 " + process.version +
    "。请先 `export PATH=\"/c/Program Files/nodejs:$PATH\"` 再重跑。",
  )
  process.exit(1)
}

function portInUse(port) {
  return new Promise(resolve => {
    const sock = net.createConnection({ host: "127.0.0.1", port })
    sock.setTimeout(700)
    sock.once("connect", () => { sock.destroy(); resolve(true) })
    sock.once("error", () => resolve(false))
    sock.once("timeout", () => { sock.destroy(); resolve(false) })
  })
}

/**
 * 从 env 文件里提取 INFERENCE_* 配置注入子进程。
 * Next 自己会加载 .env*.local，但 eve 是独立 Nitro 进程不会读；
 * 所以两边都以「基线 .env.local → 开发覆盖 .env.development.local」顺序解析，
 * 与 Next 的优先级一致。只取 INFERENCE_ 前缀，绝不打印值（含密钥）。
 */
function loadInferenceEnv() {
  const result = {}
  for (const name of [".env.local", ".env.development.local"]) {
    const file = path.join(root, name)
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*(INFERENCE_[A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!match) continue
      const value = match[2].replace(/^["']|["']$/g, "").trim()
      if (value) result[match[1]] = value
    }
  }
  return result
}

const runtime = resolveRuntime()
const env = { ...process.env }
delete env.NODE_OPTIONS
env.COOLHA_EVE_LOCAL = "1"
if (!env.EVE_INTERNAL_SECRET) env.EVE_INTERNAL_SECRET = LOCAL_SECRET

const inferenceEnv = loadInferenceEnv()
Object.assign(env, inferenceEnv)
const configured = Boolean(inferenceEnv.INFERENCE_BASE_URL && inferenceEnv.INFERENCE_API_KEY && inferenceEnv.INFERENCE_MODELS)
console.log(
  configured
    ? "[dev] 统一推理网关已配置（INFERENCE_* 已注入两个进程）"
    : "[dev] 推理网关未接入（未检测到完整 INFERENCE_*）；Agent 派单会如实返回 INFERENCE_NOT_CONFIGURED",
)

const forceBuild = process.argv.includes("--build")

for (const [name, file] of [["eve CLI", eveBin], ["next CLI", nextBin]]) {
  if (!existsSync(file)) {
    console.error(`缺少 ${name}：${file}，请先 npm install。`)
    process.exit(1)
  }
}

async function buildEve() {
  console.log("[eve] 构建 Runtime 产物 (.output)…")
  const result = spawnSync(runtime, [eveBin, "build"], {
    cwd: root,
    env,
    stdio: "inherit",
  })
  if (result.status !== 0) {
    console.error("[eve] build 失败。若报 .output 被占用，请先停掉正在运行的 eve start 再试。")
    process.exit(result.status ?? 1)
  }
}

const [eveUp, nextUp] = await Promise.all([
  portInUse(EVE_PORT),
  portInUse(NEXT_PORT),
])

if (eveUp && nextUp && !forceBuild) {
  console.log(`两个服务已在运行：Next :${NEXT_PORT}、eve Runtime :${EVE_PORT}。直接打开 http://localhost:${NEXT_PORT}/chat`)
  process.exit(0)
}

if (forceBuild || !existsSync(eveEntry)) await buildEve()

const children = []

/**
 * 启动一个服务进程。
 *
 * Windows 上 node 的 spawn 会让子进程脱离父进程的生命周期：父进程被强杀
 * （SIGKILL / 任务管理器）时，子进程会变成孤儿继续占用端口。
 * 这里用 `spawn` 的默认（同进程组）行为 + 末尾的「父进程存活守护」兜底：
 * 守护轮询父进程 PID，一旦父进程消失就主动 taskkill 掉整棵子进程树。
 */
function start(tag, args) {
  const child = spawn(runtime, args, {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  })
  let buffer = ""
  const write = chunk => {
    buffer += chunk.toString()
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ""
    for (const line of lines) console.log(`[${tag}] ${line}`)
  }
  child.stdout.on("data", write)
  child.stderr.on("data", write)
  children.push({ child, tag })
  return child
}

if (!eveUp) {
  start("eve", [eveBin, "start", "--host", "127.0.0.1", "--port", String(EVE_PORT)])
} else {
  console.log(`[eve] :${EVE_PORT} 已在运行，跳过启动`)
}
if (!nextUp) {
  start("next", [nextBin, "dev", "--webpack", "-p", String(NEXT_PORT)])
} else {
  console.log(`[next] :${NEXT_PORT} 已在运行，跳过启动`)
}

console.log("[dev] 就绪后打开 http://localhost:" + NEXT_PORT + "/chat（Ctrl+C 同时停止）")

let shuttingDown = false
/**
 * Windows 上 child.kill() 只终止直接子进程，而 `eve start` / `next dev` 还会
 * 再派生子进程（next 的编译 worker、nitro 的 server），结果就是父进程退出后
 * 端口仍被占用。taskkill /T /F 按进程树杀干净。
 */
function killTree(child) {
  if (!child.pid || child.killed) return
  if (process.platform === "win32") {
    try {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" })
      return
    } catch {
      // 落到下面的通用 kill
    }
  }
  try {
    child.kill("SIGTERM")
  } catch {
    // 已退出
  }
}

function shutdown(code) {
  if (shuttingDown) return
  shuttingDown = true
  for (const { child } of children) killTree(child)
  // 给子进程一点时间释放端口，再退出
  setTimeout(() => process.exit(code), 300)
}

process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))
for (const { child, tag } of children) {
  child.on("exit", code => {
    if (shuttingDown) return
    console.log(`[${tag}] 进程退出 (code=${code})，停止其余服务`)
    shutdown(code ?? 1)
  })
}

/**
 * 父进程存活守护（Windows 必需）。
 *
 * 父进程被 SIGKILL / 任务管理器强杀时，process.on("exit") 不会触发，
 * 子进程会变孤儿继续占着 :3000 / :4274。
 *
 * 守护逻辑必须放在**独立的子进程**里：若留在本进程，父进程被杀时守护代码
 * 同样会消失，无法回收自己。这里 spawn 一个 node 子进程做哨兵，
 * 它每 2 秒确认父进程是否还活着，一旦消失就 taskkill 掉整棵子进程树后自杀。
 */
if (process.platform === "win32" && children.length > 0) {
  const parentPid = process.pid
  const targets = children.map((item) => item.child.pid).filter(Boolean)
  const script = `
    const { spawnSync } = require("node:child_process");
    const parentPid = ${parentPid};
    const targets = ${JSON.stringify(targets)};
    // 注意：不要 unref()，否则哨兵自身没有活跃句柄会立刻退出，守护就失效了。
    setInterval(() => {
      let alive = true;
      try { process.kill(parentPid, 0); } catch { alive = false; }
      if (alive) return;
      for (const pid of targets) {
        try { spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" }); } catch {}
      }
      process.exit(0);
    }, 2000);
  `
  try {
    const guard = spawn(runtime, ["-e", script], { stdio: "ignore", windowsHide: true })
    // 哨兵是本进程的子进程；本进程正常退出时它会因父进程消失而自杀。
    // 不放进 children：哨兵先退出属于正常（父进程没了），不能触发 shutdown。
    guard.on("exit", () => {})
  } catch {
    console.log("[dev] 无法启动父进程守护哨兵，Ctrl+C 停止仍可用")
  }
}
