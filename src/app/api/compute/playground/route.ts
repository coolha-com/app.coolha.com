import { jsonError } from "@/lib/agents/http"

/**
 * Playground 旧推理通道：已下线。
 *
 * 2026-11-11：Vercel AI Gateway 团队被永久停用（疑似滥用，无申诉通道）。
 * 本路由原本依赖其目录价格做「零数据保留 / 不训练」硬门禁与成本核算，
 * 新网关没有这些元数据，继续计算就会编造价格与评分，违反「绝不返回占位数值」。
 *
 * 智能对话单一通道是 /chat 的 Agent 执行（eve Runtime → 统一推理网关
 * INFERENCE_BASE_URL）。本路由保留仅为不让旧书签 404，并如实返回下线状态。
 * 后续接入带目录接口的网关时，可在此重新实现真实推理。
 */
export const runtime = "nodejs"

export async function POST() {
  return jsonError(
    410,
    "PLAYGROUND_RETIRED",
    "该模型对话通道已下线。请在智能对话里向 Agent 派发任务（统一推理网关接入后可用）。",
  )
}

export async function GET() {
  return Response.json(
    {
      status: "retired",
      code: "PLAYGROUND_RETIRED",
      message: "该模型对话通道已下线，请使用 /chat 的 Agent 通道。",
      inferenceConfigured: Boolean(process.env.INFERENCE_BASE_URL && process.env.INFERENCE_API_KEY),
    },
    { status: 410 },
  )
}
