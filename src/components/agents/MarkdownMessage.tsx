"use client"

import { memo, useState, type ReactNode } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { RiCheckLine, RiDownloadLine, RiFileCopyLine } from "react-icons/ri"
// AI SDK UI 同款高亮主题（AI Elements 的 MessageResponse 也基于此）
import "highlight.js/styles/github-dark.css"

/**
 * 把 hljs 的 hast 节点递归转成纯文本，供代码块「复制」按钮使用。
 * rehype-highlight 会把 token 拆成 span 子节点，直接 String(children) 会丢掉高亮结构。
 */
function nodeText(node: unknown): string {
  const n = node as
    | { type?: string; value?: string; children?: unknown[] }
    | undefined
  if (!n) return ""
  if (n.type === "text") return n.value ?? ""
  if (Array.isArray(n.children)) return n.children.map(nodeText).join("")
  return ""
}

function CodeBlock({
  raw,
  lang,
  children,
}: {
  raw: string
  lang: string
  children: ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(raw)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 剪贴板不可用时静默失败，不阻断阅读 */
    }
  }
  return (
    <div className="code-block group/code relative my-3 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="text-[11px] font-medium tracking-wide text-zinc-400">
          {lang || "code"}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
          aria-label="复制代码"
        >
          {copied ? (
            <RiCheckLine className="size-3.5" />
          ) : (
            <RiFileCopyLine className="size-3.5" />
          )}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-[13px] leading-5">
        {children}
      </pre>
    </div>
  )
}

const components: Components = {
  // 移除 react-markdown 默认的 <pre> 包裹，改由 CodeBlock 自己提供
  pre: ({ children }) => <>{children}</>,
  code(props) {
    const { className, children, node, ...rest } = props as {
      className?: string
      children?: ReactNode
      node?: unknown
      [key: string]: unknown
    }
    const match = /language-(\w+)/.exec(className ?? "")
    if (match) {
      const raw = nodeText(node).replace(/\n$/, "")
      return (
        <CodeBlock raw={raw} lang={match[1]}>
          <code className={`${className} hljs`} {...rest}>
            {children}
          </code>
        </CodeBlock>
      )
    }
    return (
      <code className="inline-code" {...rest}>
        {children}
      </code>
    )
  },
  a: ({ children, ...props }) => (
    <a target="_blank" rel="noreferrer noopener" {...props}>
      {children}
    </a>
  ),
}

/**
 * 助手消息渲染器（AI SDK UI 风格）：
 * markdown 正文 + 代码块语法高亮 + 代码块复制按钮 + 消息级「复制全文 / 下载 .md」。
 * 用户消息仍走纯文本气泡，不在此渲染。
 */
export const MarkdownMessage = memo(function MarkdownMessage({
  content,
}: {
  content: string
}) {
  const [copied, setCopied] = useState(false)

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 忽略 */
    }
  }

  const download = () => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `coolha-response-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.md`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="md-wrap group/md relative">
      <div className="md-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </div>
      <div className="mt-2 flex justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover/md:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={copyAll}
          className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <RiCheckLine className="size-3.5" />
          ) : (
            <RiFileCopyLine className="size-3.5" />
          )}
          {copied ? "已复制" : "复制"}
        </button>
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RiDownloadLine className="size-3.5" />
          下载
        </button>
      </div>
    </div>
  )
})
