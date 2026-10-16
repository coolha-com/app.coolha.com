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
        Chat 中免费模型通道为真实推理，用量记录为真实调用数据；其他模块的卡片带有「示例数据」标识。
      </p>
      <p>
        <strong>目录口径：</strong>
        价格与上下文为上游目录值，延迟不做展示（平台未实测）。实时调取请访问{" "}
        <code className="font-mono">/api/v1/models</code>。
      </p>
      <p>
        <strong>产品边界：</strong>
        Coolha 提供的是 AI 对话工作台与软件能力（模型切换、多连接管理、云端历史、检索、导出），
        不转售模型算力或 API Key。免费模型的推理由 Coolha 赞助并计入每日配额；其他模型请接入你自己的服务使用，
        推理费用由你自己的 Key 承担。
      </p>
      <p>
        <strong>合规与隐私：</strong>
        根据适用的法律、监管和合规要求，部分国家或地区暂不提供访问或相关服务（见「访问受限」页）。
        你自己的 API Key 只保存在浏览器，从不上传服务器；云端仅保存对话正文，不保存密钥，
        可在「设置」中一键清空。
      </p>
    </CollapsibleNote>
  )
}