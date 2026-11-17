"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

/**
 * Creem 测试结账按钮。
 *
 * 只用于支付通道的技术验证：点击后调 /api/creem/checkout 拿到 checkout_url 再跳转。
 * 服务端强制 creem_test_ key，不会碰到真实收款；付款成功由 webhook 发服务授权。
 */
export function CreemTestCheckoutButton() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/creem/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = (await res.json()) as {
        checkoutUrl?: string
        error?: { code?: string; message?: string }
      }
      if (!res.ok || !data.checkoutUrl) {
        setError(data.error?.message ?? "无法创建结账会话")
        return
      }
      window.location.assign(data.checkoutUrl)
    } catch {
      setError("网络错误，请稍后重试")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={start} disabled={pending} size="sm">
        {pending ? "正在创建…" : "打开 Creem 测试结账"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
