import type { RWAAssetType, RWAFilter, RWALiquidityType, RWAProtocolId, RWARiskLevel, RWAProtocol } from '@/lib/rwa/types'

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function Chip(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        props.active
          ? 'border-primary/30 bg-primary/12 text-foreground shadow-sm'
          : 'border-border bg-background text-muted-foreground hover:border-primary/20 hover:bg-card hover:text-foreground'
      } whitespace-nowrap`}
    >
      {props.label}
    </button>
  )
}

function Group(props: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border/70 bg-background/80 p-3 ${props.className ?? ''}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{props.title}</p>
      <div className="mt-2 flex flex-wrap gap-2">{props.children}</div>
    </div>
  )
}

export function FilterBar(props: {
  filter: RWAFilter
  protocols: RWAProtocol[]
  onChange: (next: RWAFilter) => void
}) {
  const { filter } = props
  const activeCount =
    filter.riskLevels.length +
    filter.assetTypes.length +
    filter.liquidityTypes.length +
    filter.liquidity.length +
    filter.protocols.length +
    (filter.apyMin !== undefined ? 1 : 0) +
    (filter.apyMax !== undefined ? 1 : 0)

  const setRange = (key: 'apyMin' | 'apyMax', value: string) => {
    const n = value.trim() === '' ? undefined : Number(value)
    props.onChange({ ...filter, [key]: Number.isFinite(n as number) ? (n as number) : undefined })
  }

  const toggleRisk = (value: RWARiskLevel) => props.onChange({ ...filter, riskLevels: toggle(filter.riskLevels, value) })
  const toggleType = (value: RWAAssetType) => props.onChange({ ...filter, assetTypes: toggle(filter.assetTypes, value) })
  const toggleLiquidityType = (value: RWALiquidityType) =>
    props.onChange({ ...filter, liquidityTypes: toggle(filter.liquidityTypes, value) })
  const toggleLiquidity = (value: 'high' | 'low') => props.onChange({ ...filter, liquidity: toggle(filter.liquidity, value) })
  const toggleProtocol = (value: RWAProtocolId) => props.onChange({ ...filter, protocols: toggle(filter.protocols, value) })

  const reset = () =>
    props.onChange({
      apyMin: undefined,
      apyMax: undefined,
      riskLevels: [],
      assetTypes: [],
      liquidityTypes: [],
      liquidity: [],
      protocols: [],
    })

  return (
    <section className="rounded-[24px] border border-border/70 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">筛选工具栏</h2>
          <p className="mt-1 text-xs text-muted-foreground">围绕风险、期限、流动性和协议做快速收敛。</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
            已启用 {activeCount} 项
          </span>
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/20 hover:text-foreground"
          >
            清空筛选
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1.1fr_0.9fr_1fr]">
        <Group title="收益率范围（APY）">
          <div className="grid w-full grid-cols-2 gap-2">
            <input
              value={filter.apyMin ?? ''}
              onChange={(e) => setRange('apyMin', e.target.value)}
              inputMode="decimal"
              placeholder="最小"
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary/25"
            />
            <input
              value={filter.apyMax ?? ''}
              onChange={(e) => setRange('apyMax', e.target.value)}
              inputMode="decimal"
              placeholder="最大"
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary/25"
            />
          </div>
        </Group>

        <Group title="风险等级">
          <Chip active={filter.riskLevels.includes('low')} label="低" onClick={() => toggleRisk('low')} />
          <Chip active={filter.riskLevels.includes('medium')} label="中" onClick={() => toggleRisk('medium')} />
          <Chip active={filter.riskLevels.includes('high')} label="高" onClick={() => toggleRisk('high')} />
        </Group>

        <Group title="资产类型">
          <Chip active={filter.assetTypes.includes('bond')} label="债券" onClick={() => toggleType('bond')} />
          <Chip active={filter.assetTypes.includes('credit')} label="信贷" onClick={() => toggleType('credit')} />
          <Chip active={filter.assetTypes.includes('real_estate')} label="房地产" onClick={() => toggleType('real_estate')} />
        </Group>

        <Group title="流动性">
          <Chip active={filter.liquidityTypes.includes('liquid')} label="可赎回" onClick={() => toggleLiquidityType('liquid')} />
          <Chip active={filter.liquidityTypes.includes('locked')} label="锁仓" onClick={() => toggleLiquidityType('locked')} />
          <Chip active={filter.liquidity.includes('high')} label="High" onClick={() => toggleLiquidity('high')} />
          <Chip active={filter.liquidity.includes('low')} label="Low" onClick={() => toggleLiquidity('low')} />
        </Group>

        <Group title="协议" className="xl:col-span-2">
          {props.protocols.map((protocol) => (
            <Chip
              key={protocol.id}
              active={filter.protocols.includes(protocol.id)}
              label={protocol.name}
              onClick={() => toggleProtocol(protocol.id)}
            />
          ))}
        </Group>
      </div>
    </section>
  )
}
