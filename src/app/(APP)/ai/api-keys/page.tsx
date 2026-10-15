import type { Metadata } from "next"
import { RiKey2Line } from "react-icons/ri"
import { MockBadge } from "@/components/compute/MockBadge"
import { CollapsibleNote } from "@/components/compute/CollapsibleNote"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "API Keys",
  description: "创建和管理 Coolha API Key",
}

const SECURITY_NOTES = [
  "密钥仅在创建时完整展示一次，服务端只保存安全哈希与前缀。",
  "创建前需完成钱包签名验证，钱包地址本身不作为 API 密钥。",
  "支持设置名称、可调用模型范围与单日/单月消费上限。",
  "上游供应商密钥只保存在服务端环境变量中，不进入客户端。",
]

export default function ApiKeysPage() {
  return (
    <section className="mt-6 space-y-4">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <RiKey2Line className="size-5" />
          </div>
          <MockBadge />
        </div>
        <h3 className="mt-4 font-semibold">密钥管理将在 Phase 2 开放</h3>
        <div className="mt-4">
          <Button disabled className="rounded-xl">
            创建密钥（即将开放）
          </Button>
        </div>
      </div>

      <CollapsibleNote title="本页说明">
        <p>本页全部内容为示例数据：密钥列表、调用量与限额均为占位展示，统一网关与 Key 签发尚未开放。</p>
        <p>
          API Key 体系依赖服务端密钥签发与钱包签名验证，属于 Phase 2
          范围。在此之前不提供创建入口，以避免出现无法验证的密钥。
        </p>
        <ul className="space-y-2">
          {SECURITY_NOTES.map((note) => (
            <li key={note} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              {note}
            </li>
          ))}
        </ul>
      </CollapsibleNote>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">名称</th>
              <th className="px-4 py-3 font-medium">前缀</th>
              <th className="px-4 py-3 font-medium">创建时间</th>
              <th className="px-4 py-3 font-medium">最近使用</th>
              <th className="px-4 py-3 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                暂无 API Key。Phase 2 开放后，创建记录将在此展示。
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
