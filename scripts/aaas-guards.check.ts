/**
 * 访问模式、模型白名单、上游状态分类。不连网，不读密钥。
 *   node --experimental-strip-types scripts/aaas-guards.check.ts
 */
import assert from "node:assert/strict"
import { decideAgentAccess } from "../src/lib/agents/access-mode.ts"
import { resolveInferenceModel } from "../src/lib/inference/config.ts"
import { classifyUpstreamStatus } from "../src/lib/inference/upstream.ts"
import { adaptEveParts } from "../src/components/agents/eve-message-adapt.ts"

function checkAccess() {
  const closed = decideAgentAccess({})
  assert.equal(closed.open, false)
  assert.equal(closed.mode, "closed")

  const local = decideAgentAccess({
    AGENT_ACCESS_MODE: "local_open",
    NODE_ENV: "development",
  })
  assert.equal(local.open, true)
  assert.equal(local.mode, "local_open")

  const localOnVercel = decideAgentAccess({
    AGENT_ACCESS_MODE: "local_open",
    NODE_ENV: "development",
    VERCEL: "1",
    VERCEL_ENV: "development",
  })
  assert.equal(localOnVercel.open, false)
  assert.equal(localOnVercel.refused, "local_open_refused")

  const nextStart = decideAgentAccess({
    AGENT_ACCESS_MODE: "local_open",
    NODE_ENV: "production",
    COOLHA_EVE_LOCAL: "1",
  })
  assert.equal(nextStart.open, true)

  const preview = decideAgentAccess({
    AGENT_ACCESS_MODE: "preview_open",
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "agent",
  })
  assert.equal(preview.open, true)

  const cursorPreview = decideAgentAccess({
    AGENT_ACCESS_MODE: "preview_open",
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "cursor/aaas-phase1-openrouter-647b",
  })
  assert.equal(cursorPreview.open, true)

  const otherPreview = decideAgentAccess({
    AGENT_ACCESS_MODE: "preview_open",
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "feature/random",
  })
  assert.equal(otherPreview.open, false)
  assert.equal(otherPreview.refused, "preview_open_refused")

  const production = decideAgentAccess({
    AGENT_ACCESS_MODE: "preview_open",
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_REF: "agent",
  })
  assert.equal(production.open, false)
  assert.equal(production.mode, "closed")
  assert.equal(production.refused, "production_locked")

  const headerCannotOpen = decideAgentAccess({
    VERCEL_ENV: "production",
    AGENT_ACCESS_MODE: "local_open",
  })
  assert.equal(headerCannotOpen.open, false)
}

function checkModels() {
  process.env.INFERENCE_BASE_URL = "https://openrouter.ai/api/v1"
  process.env.INFERENCE_API_KEY = "present-for-unit-test"
  process.env.INFERENCE_MODELS = "deepseek/deepseek-v4.1-flash-1017"
  process.env.INFERENCE_DEFAULT_MODEL = "deepseek/deepseek-v4.1-flash-1017"

  const allowed = resolveInferenceModel("deepseek/deepseek-v4.1-flash-1017")
  assert.equal(allowed.ok, true)
  if (allowed.ok) assert.equal(allowed.modelId, "deepseek/deepseek-v4.1-flash-1017")

  const rejected = resolveInferenceModel("openai/gpt-4o")
  assert.equal(rejected.ok, false)
  if (!rejected.ok) assert.equal(rejected.reason, "not_allowed")

  const fallback = resolveInferenceModel(null)
  assert.equal(fallback.ok, true)
  if (fallback.ok) assert.equal(fallback.modelId, "deepseek/deepseek-v4.1-flash-1017")

  delete process.env.INFERENCE_API_KEY
  const missing = resolveInferenceModel("deepseek/deepseek-v4.1-flash-1017")
  assert.equal(missing.ok, false)
  if (!missing.ok) assert.equal(missing.reason, "not_configured")
}

function checkUpstream() {
  assert.equal(classifyUpstreamStatus(401)?.code, "UPSTREAM_UNAUTHORIZED")
  assert.equal(classifyUpstreamStatus(403)?.code, "UPSTREAM_UNAUTHORIZED")
  assert.equal(classifyUpstreamStatus(429)?.code, "UPSTREAM_RATE_LIMITED")
  assert.equal(classifyUpstreamStatus(500)?.code, "UPSTREAM_UNAVAILABLE")
  assert.equal(classifyUpstreamStatus(503)?.code, "UPSTREAM_UNAVAILABLE")
  assert.equal(classifyUpstreamStatus(200), null)
  assert.equal(classifyUpstreamStatus(400), null)
}

function checkParts() {
  const parts = adaptEveParts([
    { type: "text", text: "你好" },
    { type: "reasoning", text: "想一下" },
    { type: "tool", name: "lookup", state: "done", output: { ok: true } },
    { type: "file", filename: "note.txt" },
    { type: "data", data: { score: 1 } },
    { type: "widget" },
  ])
  assert.deepEqual(
    parts.map((part) => part.kind),
    ["text", "reasoning", "tool", "file", "structured", "unknown"],
  )
}

checkAccess()
checkModels()
checkUpstream()
checkParts()
console.log("AAAS_GUARDS: ALL_PASS")
