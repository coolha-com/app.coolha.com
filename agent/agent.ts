import { defineAgent } from "eve";
import { defineDynamic } from "eve/models";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Coolha 的第一个 Hosted Agent：RWA Research。
 *
 * 推理通道：只连**一个** OpenAI 兼容网关（INFERENCE_BASE_URL + INFERENCE_API_KEY）。
 * Vercel AI Gateway 团队于 2026-11-11 被永久停用（疑似滥用，无申诉通道），
 * 全站已移除该依赖。换模型厂商只改环境变量，不改本文件。
 *
 * 模型切换链路：前端选 modelId → Next 代理按 INFERENCE_MODELS 白名单校验 →
 * x-coolha-eve-model → 本文件 defineDynamic 每轮读取 → provider(modelId)。
 * 不接受任意字符串，更不接受用户自带密钥。
 *
 * 合规口径：付费只卖 Agent 执行与平台服务，不按 token 收费；
 * 模型费由平台承担，不与订单档位挂钩。
 *
 * ② 工具白名单（三层硬边界，不靠 prompt）：
 * - `defaultTools: false`：编译期删除 eve "eve:defaults" 的 6 个 framework-default
 *   工具（bash / read_file / write_file / edit_file / web_fetch / web_search），
 *   连模型都拿不到工具定义；也防 eve 未来新增默认工具。
 * - `tool: false`：关掉 root-only 的内置 `agent` 委托工具。
 * - `agent/tools/*.ts` 的 disableTool()：逐工具再次兜底。
 * - `approval`：运行期白名单，只放行这里登记且真实接入的执行点。当前为空
 *   = 拒绝一切被覆盖的调用；接 Alchemy 读链 / DefiLlama 时把运行时名加进来。
 *
 * ⚠️ 威胁模型残留：eve 保留命名空间的 catalog 工具（尤其有 skills 目录带来的
 * `eve__skill`，以及 deferred / connection / task 控制工具）无法被
 * defaultTools 或 disableTool() 删除，approval 也不覆盖它们。要做到「绝对零工具」
 * 需连 skills / deferred / connections / tasks 一起清空；当前接受这一残留，
 * 因为它们都是框架内部能力，不是宿主命令或文件访问。
 */

const GATEWAY_NAME = process.env.INFERENCE_GATEWAY_NAME ?? "coolha-inference";
const BASE_URL = process.env.INFERENCE_BASE_URL ?? "";
const API_KEY = process.env.INFERENCE_API_KEY ?? "";
const CONTEXT_WINDOW = Number(process.env.INFERENCE_CONTEXT_WINDOW ?? 128_000);

const ALLOWED_MODELS = (process.env.INFERENCE_MODELS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const DEFAULT_MODEL = process.env.INFERENCE_DEFAULT_MODEL ?? "";

/**
 * 单一 OpenAI 兼容端点。baseURL 为空时构造不会抛错，
 * 但任何真实调用都会失败 —— 网关未接入时如实失败，不伪造成功。
 */
const provider = createOpenAICompatible({
  name: GATEWAY_NAME,
  baseURL: BASE_URL,
  apiKey: API_KEY,
  includeUsage: true,
});

function resolveModel(requested: unknown): string {
  if (typeof requested === "string" && ALLOWED_MODELS.includes(requested)) {
    return requested;
  }
  if (DEFAULT_MODEL && ALLOWED_MODELS.includes(DEFAULT_MODEL)) return DEFAULT_MODEL;
  return ALLOWED_MODELS[0] ?? "";
}

const ALLOWED_TOOLS = new Set<string>([
  // 只登记 agent/tools/ 里显式实现且真实接入的执行点；当前为零。
]);

export default defineAgent({
  // eve 在每次模型调用前求值；follow-up 会刷新 auth.current，所以每轮切换都能生效。
  // 返回 model 实例而非 Gateway 模型 ID 字符串，因此完全不经过 Vercel AI Gateway。
  model: defineDynamic((ctx) => {
    const requested = ctx.session.auth.current?.attributes.model;
    const modelId = resolveModel(requested);
    if (!modelId) {
      throw new Error(
        "INFERENCE_NOT_CONFIGURED：推理网关未接入，请配置 INFERENCE_BASE_URL / INFERENCE_API_KEY / INFERENCE_MODELS",
      );
    }
    return {
      model: provider(modelId),
      // 自定义网关没有 AI Gateway 目录元数据，必须显式给出上下文窗口，
      // 否则 eve 会去查 Vercel 目录并在找不到模型时终止本轮。
      modelContextWindowTokens: CONTEXT_WINDOW,
    };
  }),
  defaultTools: false,
  tool: false,
  approval: ({ toolName }) => (ALLOWED_TOOLS.has(toolName) ? undefined : "denied"),
});
