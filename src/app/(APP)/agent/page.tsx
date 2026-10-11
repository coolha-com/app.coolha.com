import { RiRobot2Line, RiShieldCheckLine } from "react-icons/ri"
import { Button } from "@/components/ui/button"
import { agentServices } from "@/lib/aifi-data"

export default function AgentPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-normal">智能体市场</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          用于订阅履约、稳定币对账、权益发放、库存检查与客服审核的智能体服务。接入真实服务后在此展示。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {agentServices.map((agent) => (
          <article key={agent.name} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <RiRobot2Line className="size-6" />
              </div>
              <div>
                <h2 className="font-semibold">{agent.name}</h2>
                <p className="text-sm text-muted-foreground">{agent.category} · {agent.provider}</p>
              </div>
            </div>

            <dl className="mt-6 space-y-3 text-sm">
              <Row label="服务" value={agent.service} />
              <Row label="结算" value={agent.settlement} />
              <Row label="身份" value={agent.identity} />
              <Row label="信任" value={agent.trust} />
            </dl>

            <div className="mt-6 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              <div className="mb-1 flex items-center gap-2 font-medium text-foreground"><RiShieldCheckLine /> 服务验证</div>
              智能体是付费订单的运营服务提供方，不托管用户资金。
            </div>

            <Button className="mt-5 w-full" disabled>
              智能体结算即将上线
            </Button>
          </article>
        ))}
        {agentServices.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-5 text-sm leading-6 text-muted-foreground lg:col-span-3">
            暂无已接入的真实智能体服务。接入后将在此展示。
          </div>
        ) : null}
      </div>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b pb-3 last:border-b-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}
