import { redirect } from "next/navigation"

/** 服务发现已下线：首页直接进入智能对话（侧边栏第一项）。 */
export default function HomePage() {
  redirect("/chat")
}
