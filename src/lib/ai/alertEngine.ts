import { getAssetProfile } from "@/lib/ai/aiService"

export type AlertType = "risk_change" | "yield_change" | "abnormal_event"
export type AlertSeverity = "low" | "medium" | "high"

export type AssetAlert = {
  id: string
  assetId: string
  assetName: string
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  delta: string
  timestamp: string
}

const alertTemplates: Record<
  AlertType,
  Array<{
    severity: AlertSeverity
    title: string
    delta: string
    message: (assetName: string) => string
  }>
> = {
  risk_change: [
    {
      severity: "medium",
      title: "风险分上调",
      delta: "+6 pts",
      message: (assetName) => `${assetName} 的底层现金流波动扩大，AI 建议重新评估仓位上限。`,
    },
    {
      severity: "high",
      title: "结构稳定性下降",
      delta: "+11 pts",
      message: (assetName) => `${assetName} 的抵押覆盖率预警触发，建议检查准备金与清算阈值。`,
    },
  ],
  yield_change: [
    {
      severity: "low",
      title: "收益提升",
      delta: "+0.8%",
      message: (assetName) => `${assetName} 的分配收益上修，主要来自底层票息回收改善。`,
    },
    {
      severity: "medium",
      title: "收益回落",
      delta: "-1.1%",
      message: (assetName) => `${assetName} 的预期收益下降，可能与赎回需求上升有关。`,
    },
  ],
  abnormal_event: [
    {
      severity: "high",
      title: "异常大额转账",
      delta: "Whale",
      message: (assetName) => `${assetName} 关联地址出现异常大额转移，建议立即复核链上资金去向。`,
    },
    {
      severity: "medium",
      title: "清算观察名单",
      delta: "Watch",
      message: (assetName) => `${assetName} 进入清算观察名单，系统已提升推送频率。`,
    },
  ],
}

let alertCursor = 0

export function subscribeAsset(current: string[], assetId: string): string[] {
  if (current.includes(assetId)) return current
  return [...current, assetId]
}

export function unsubscribeAsset(current: string[], assetId: string): string[] {
  return current.filter((id) => id !== assetId)
}

export function generateMockAlert(subscribedAssetIds: string[]): AssetAlert | null {
  if (!subscribedAssetIds.length) return null

  const assetId = subscribedAssetIds[alertCursor % subscribedAssetIds.length]
  const types = Object.keys(alertTemplates) as AlertType[]
  const type = types[alertCursor % types.length]
  const variants = alertTemplates[type]
  const variant = variants[alertCursor % variants.length]
  const asset = getAssetProfile(assetId)

  alertCursor += 1

  return {
    id: `${asset.id}-${Date.now()}-${alertCursor}`,
    assetId: asset.id,
    assetName: asset.name,
    type,
    severity: variant.severity,
    title: variant.title,
    message: variant.message(asset.name),
    delta: variant.delta,
    timestamp: new Date().toISOString(),
  }
}

export function seedMockAlerts(subscribedAssetIds: string[], count = 3): AssetAlert[] {
  const items: AssetAlert[] = []

  for (let index = 0; index < count; index += 1) {
    const next = generateMockAlert(subscribedAssetIds)
    if (next) items.push(next)
  }

  return items
}
