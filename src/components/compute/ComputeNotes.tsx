import { CollapsibleNote } from "@/components/compute/CollapsibleNote"

/**
 * 模块级说明：统一收纳在模块页面最底部，默认收起。
 * 界面只保留交互元素（导航、筛选、卡片、表格、对话）；所有口径与合规说明集中在此。
 */
export function ComputeNotes() {
  return (
    <CollapsibleNote className="mt-8" title="说明与数据口径">
      <p>
        <strong>数据来源与状态：</strong>
        模型目录、价格与规格来自 Vercel AI Gateway 公开模型目录（供应商报告口径，每小时同步）；
        Playground 为真实推理；用量记录为真实调用数据。API Key、额度与账单模块仍为演示数据，
        相关卡片带有「示例数据」标识。
      </p>
      <p>
        <strong>目录口径：</strong>
        价格与上下文为上游目录值，延迟不做展示（平台未实测）。实时调取请访问{" "}
        <code className="font-mono">/api/v1/models</code>。
      </p>
      <p>
        <strong>产品边界：</strong>
        第一版聚焦验证供需与交易闭环（模型聚合、统一 API、价格比较、在线测试、用量统计）。
        不自建 GPU 集群、不训练模型、不发行代币。所有调用均经过服务端网关，浏览器不接触上游密钥。
      </p>
      <p>
        <strong>合规与隐私：</strong>
        根据适用的法律、监管和合规要求，部分国家或地区暂不提供访问或相关服务（见「访问受限」页）。
        调用日志默认不保存完整提示词与模型回复，仅记录计费与排错所需元数据。
      </p>
    </CollapsibleNote>
  )
}