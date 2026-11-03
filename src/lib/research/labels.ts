import type { RiskLevel } from "./types"

/**
 * 风险级别的中文标签。
 *
 * ⚠️ 单独成文件的原因：这个映射被**客户端组件**（`ResearchCockpit.tsx`）使用，
 * 而 `engine.ts` 依赖服务端的数据源客户端（Alchemy / Sourcify / DefiLlama）。
 * 两者混在一个文件里，会把服务端取数代码拖进浏览器包 —— 现在 `sources.ts` 已经
 * 走 `server-only` 的共享客户端，混用会直接触发构建期报错。
 *
 * 标签本身是纯展示映射，不含任何取数逻辑，放在这里是安全的。
 */
export const RISK_LABEL: Record<RiskLevel, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
  critical: "极高风险",
}
