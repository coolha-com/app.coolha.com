import {
  RiBrainLine,
  RiBroadcastLine,
  RiChat3Line,
  RiCodeSSlashLine,
  RiDatabase2Line,
  RiEyeLine,
  RiFileLine,
  RiFileTextLine,
  RiFlashlightLine,
  RiGiftLine,
  RiGlobalLine,
  RiImageLine,
  RiMicLine,
  RiMovieLine,
  RiShapeLine,
  RiBracesLine,
  RiToolsLine,
  RiVideoLine,
} from "react-icons/ri"
import type { IconType } from "react-icons"
import type { ComputeCapability, ComputeModel, ComputeModelType } from "@/lib/compute/types"

/** 本地筛选维度（ComputeCapability）→ 图标，用于筛选下拉 */
export const CAPABILITY_FILTER_ICONS: Record<ComputeCapability, IconType> = {
  streaming: RiBroadcastLine,
  vision: RiEyeLine,
  tools: RiToolsLine,
  "json-mode": RiBracesLine,
  "function-calling": RiCodeSSlashLine,
}

/** 模型类型 → 图标（筛选下拉与列表 chip 共用） */
export const MODEL_TYPE_ICONS: Record<ComputeModelType, IconType> = {
  chat: RiChat3Line,
  reasoning: RiBrainLine,
  code: RiCodeSSlashLine,
  vision: RiEyeLine,
  embedding: RiShapeLine,
  image: RiImageLine,
  video: RiMovieLine,
  audio: RiMicLine,
  reranking: RiDatabase2Line,
  realtime: RiBroadcastLine,
  evaluation: RiFileTextLine,
}

/**
 * 能力标签 → 图标 + 中文名。
 * 标签取自 AI Gateway 上游 tags 字段（与 vercel.com/ai-gateway/models 同源），
 * 演示目录没有 tags 时由本地 capabilities 反推。
 */

export interface CapabilityMeta {
  label: string
  icon: IconType
  /** 悬浮说明 */
  hint: string
}

export const CAPABILITY_META: Record<string, CapabilityMeta> = {
  reasoning: { label: "推理", icon: RiBrainLine, hint: "支持推理 / 思维链" },
  "tool-use": { label: "工具", icon: RiToolsLine, hint: "支持工具调用 / Function Calling" },
  vision: { label: "视觉", icon: RiEyeLine, hint: "支持图片输入" },
  "structured-output": {
    label: "结构化",
    icon: RiBracesLine,
    hint: "支持 JSON Schema 约束输出",
  },
  "web-search": { label: "联网", icon: RiGlobalLine, hint: "内置联网搜索" },
  "file-input": { label: "文件", icon: RiFileLine, hint: "支持文件 / PDF 输入" },
  "audio-input": { label: "语音输入", icon: RiMicLine, hint: "支持音频输入" },
  "video-input": { label: "视频输入", icon: RiVideoLine, hint: "支持视频输入" },
  "image-generation": { label: "图像生成", icon: RiImageLine, hint: "生成图片" },
  "video-generation": { label: "视频生成", icon: RiMovieLine, hint: "生成视频" },
  "implicit-caching": { label: "隐式缓存", icon: RiDatabase2Line, hint: "自动缓存计费折扣" },
  "explicit-caching": { label: "显式缓存", icon: RiDatabase2Line, hint: "可手动写入缓存" },
  "websocket-realtime": { label: "实时", icon: RiBroadcastLine, hint: "WebSocket 实时会话" },
  "websocket-transcription": {
    label: "实时转写",
    icon: RiFileTextLine,
    hint: "WebSocket 实时语音转写",
  },
  fast: { label: "低延迟", icon: RiFlashlightLine, hint: "低延迟供应通道" },
  free: { label: "免费", icon: RiGiftLine, hint: "上游标注为免费额度模型" },
}

/** 展示优先级：先显示最能影响选型的标签 */
const CAPABILITY_ORDER = [
  "free",
  "reasoning",
  "tool-use",
  "vision",
  "structured-output",
  "web-search",
  "file-input",
  "audio-input",
  "video-input",
  "image-generation",
  "video-generation",
  "fast",
  "implicit-caching",
  "explicit-caching",
  "websocket-realtime",
  "websocket-transcription",
]

/** 取模型应展示的能力标签（已排序、已过滤未知标签） */
export function modelCapabilityTags(model: ComputeModel): string[] {
  const source =
    model.tags && model.tags.length > 0
      ? model.tags
      : (() => {
          // 演示目录没有上游 tags，由本地 capabilities 反推
          const fallback: string[] = []
          if (model.capabilities.includes("vision")) fallback.push("vision")
          if (model.capabilities.includes("tools")) fallback.push("tool-use")
          if (model.capabilities.includes("json-mode")) fallback.push("structured-output")
          return fallback
        })()

  const known = source.filter((tag) => CAPABILITY_META[tag])
  return [...new Set(known)].sort(
    (a, b) => CAPABILITY_ORDER.indexOf(a) - CAPABILITY_ORDER.indexOf(b),
  )
}
