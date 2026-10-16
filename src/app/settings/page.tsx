"use client"

import { CloudHistorySettings } from "@/components/compute/CloudHistorySettings"

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-medium">设置</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          数据与隐私相关的控制项。模型连接与 API Key 只保存在你的浏览器，不在此处管理。
        </p>
      </div>
      <CloudHistorySettings />
    </div>
  )
}
