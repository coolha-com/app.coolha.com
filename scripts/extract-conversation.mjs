// 用法：
//   node scripts/extract-conversation.mjs "<jsonl路径>" [输出.md]
//
// 例：
//   node scripts/extract-conversation.mjs "C:\Users\Qin Jiangban\.workbuddy\projects\c-AAAAAA-Code-coolha-com-app.coolha.com\3348ae2d-3295-4626-ae5f-95e4569941da.jsonl" conversation-export.md
//
// 说明：WorkBuddy 对话存为 JSONL（每行一条 JSON）。本脚本把其中的
// 用户/助手/系统/工具消息抽取成可读 Markdown。schema 未知字段会兜底输出原始 JSON。

import fs from "node:fs"
import path from "node:path"

const src = process.argv[2]
const out = process.argv[3] || path.join(process.cwd(), "conversation-export.md")

if (!src) {
  console.error("用法: node extract-conversation.mjs <jsonl路径> [输出.md]")
  process.exit(1)
}

if (!fs.existsSync(src)) {
  console.error("找不到源文件:", src)
  process.exit(1)
}

const raw = fs.readFileSync(src, "utf8")
const lines = raw.split("\n").filter((l) => l.trim().length > 0)

const md = []
md.push("# WorkBuddy 对话导出")
md.push("")
md.push(`> 源文件: ${src}`)
md.push(`> 记录条数: ${lines.length}`)
md.push("")

let exported = 0
for (const line of lines) {
  let obj
  try {
    obj = JSON.parse(line)
  } catch {
    continue
  }
  const role = obj.role || obj?.message?.role || obj?.type || "unknown"
  const label = {
    user: "## 👤 用户",
    assistant: "## 🤖 助手",
    system: "## ⚙️ 系统",
    tool: "## 🔧 工具",
    unknown: "## ❓ 其他",
  }[role] || "## ❓ 其他"

  const text = extractText(obj)
  if (!text) continue

  const ts = obj.timestamp || obj.created_at || obj.time
  md.push(label + (ts ? `  _(${ts})_` : ""))
  md.push("")
  md.push(text)
  md.push("")
  exported += 1
}

fs.writeFileSync(out, md.join("\n"), "utf8")
console.log(`已导出 ${exported} 条可读记录 -> ${out}`)

function extractText(obj) {
  // 直出字符串
  if (typeof obj.content === "string") return obj.content
  if (typeof obj.message?.content === "string") return obj.message.content
  if (typeof obj.text === "string") return obj.text
  // content 是数组（多模态 / 分块），拼出其中的 text
  if (Array.isArray(obj.content)) return joinParts(obj.content)
  if (Array.isArray(obj.message?.content)) return joinParts(obj.message.content)
  // 兜底：对象就序列化，避免整条丢失
  if (obj.content && typeof obj.content === "object") {
    try {
      return "```json\n" + JSON.stringify(obj.content, null, 2) + "\n```"
    } catch {
      return ""
    }
  }
  return ""
}

function joinParts(parts) {
  return parts
    .map((p) => {
      if (typeof p === "string") return p
      if (p?.text) return p.text
      if (p?.type === "tool_use" || p?.type === "tool_call")
        return `🔧 调用工具: ${p.name || p?.function?.name || ""}\n${stringify(p.input ?? p?.function?.arguments)}`
      if (p?.type === "tool_result") return `🔧 工具结果:\n${stringify(p.content)}`
      return ""
    })
    .filter(Boolean)
    .join("\n\n")
}

function stringify(v) {
  if (v == null) return ""
  if (typeof v === "string") return v
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}
