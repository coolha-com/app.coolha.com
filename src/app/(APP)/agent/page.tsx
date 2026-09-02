import { RiRobot2Line, RiShieldCheckLine } from "react-icons/ri"
import { Button } from "@/components/ui/button"
import { agentServices } from "@/lib/aifi-data"

export default function AgentPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-normal">Agent Service Marketplace</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Discover agents that provide real services. Each agent should expose an on-chain identity, service scope, payment method, and verifiable reputation history.
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
              <Row label="Service" value={agent.service} />
              <Row label="Settlement" value={agent.settlement} />
              <Row label="Identity" value={agent.identity} />
              <Row label="Trust" value={agent.trust} />
            </dl>

            <div className="mt-6 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              <div className="mb-1 flex items-center gap-2 font-medium text-foreground"><RiShieldCheckLine /> Service verification</div>
              Agents are service providers, not RWA assets or AI model compute inventory.
            </div>

            <Button className="mt-5 w-full" disabled>
              Service checkout coming soon
            </Button>
          </article>
        ))}
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
