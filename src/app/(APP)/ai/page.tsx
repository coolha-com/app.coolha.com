import { redirect } from "next/navigation"

/** 算力市场入口直接进入 Chat 对话工作台 */
export default function Page() {
  redirect("/chat")
}
