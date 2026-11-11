/**
 * 推理上游 HTTP 状态的对外说法。
 * 不重试、不把 401/429/5xx 改写成成功，也不编造排队时间。
 */

export interface UpstreamFailure {
  code: "UPSTREAM_UNAUTHORIZED" | "UPSTREAM_RATE_LIMITED" | "UPSTREAM_UNAVAILABLE"
  message: string
}

export function classifyUpstreamStatus(status: number): UpstreamFailure | null {
  if (status === 401 || status === 403) {
    return {
      code: "UPSTREAM_UNAUTHORIZED",
      message: "推理网关拒绝了当前凭据或权限",
    }
  }
  if (status === 429) {
    return {
      code: "UPSTREAM_RATE_LIMITED",
      message: "推理网关限流，请稍后重试",
    }
  }
  if (status >= 500 && status <= 599) {
    return {
      code: "UPSTREAM_UNAVAILABLE",
      message: "推理网关暂时不可用",
    }
  }
  return null
}
