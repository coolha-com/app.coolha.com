import { CollapsibleNote } from "@/components/compute/CollapsibleNote"

/**
 * 模块级说明：统一收纳在模块页面最底部，默认收起。
 * 界面只保留交互元素（导航、筛选、卡片、表格、对话）；所有口径与合规说明集中在此。
 *
 * 口径（AaaS）：Coolha 只交付 Agent 执行与平台服务，模型由平台统一提供，
 * 不按 token 分档计价，也不接收用户自带密钥。
 */
export function ComputeNotes() {
  return (
    <CollapsibleNote className="mt-8" title="说明与数据口径">
      <p>
        <strong>数据来源与状态：</strong>
        推理网关尚未接入，模型广场当前为 Phase 1 示例布局数据：名称、价格、规格均不代表
        任何真实供应商报价，也不可用于推理。接入带目录接口的网关后才会展示真实目录。
      </p>
      <p>
        <strong>目录口径：</strong>
        价格与上下文为上游目录值，延迟不做展示（平台未实测）。实时调取请访问{" "}
        <code className="font-mono">/api/v1/models</code>。
      </p>
      <p>
        <strong>产品边界：</strong>
        Coolha 是 AaaS（Agent as a Service）：交付的是 Agent 执行与平台服务能力，
        模型与执行环境由平台统一提供，按 Agent 服务计费。不按 token 分档计价，
        不转售模型算力，也不接入自带密钥。
      </p>
      <p>
        <strong>合规与隐私：</strong>
        根据适用的法律、监管和合规要求，部分国家或地区暂不提供访问或相关服务（见「访问受限」页）。
        平台不接收或保存任何第三方模型密钥；用量与任务记录按登录主体隔离。
      </p>
    </CollapsibleNote>
  )
}
