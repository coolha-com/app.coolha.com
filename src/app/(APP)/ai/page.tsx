import { redirect } from "next/navigation"

/**
 * 算力市场入口。
 *
 * 原先是演示壳页（内容来自已删除的 `aifi-data.ts` 假数据），现已下线。
 * 保留这个路由是为了不打断侧边栏「智能市场」入口
 * ——Sidebar 里 `/chat` 与 `/ai` 共用同一条高亮规则，删掉路由会让高亮状态错乱。
 *
 * 默认落地页 = `/ai/tools`（Web3 工具）：与 ComputeSubNav 首个 tab 一致，
 * 点侧边栏「智能市场」先看到工具，而不是模型广场。
 */
export default function Page() {
  redirect("/ai/tools")
}
