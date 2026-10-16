-- 009: 模型目录同步失败的退避窗口
--
-- 背景：上游 401/429/5xx 时，getModelCatalog 会走 catch 分支保留陈旧快照，
-- 但 synced_at 不会推进 → 快照永远「不新鲜」→ 每次页面渲染都重新认领锁、
-- 重新打上游、重新打一条 console.error。既是日志噪音，也是无谓的上游调用。
--
-- 方案：记录失败时刻 failed_at，客户端在退避窗口内直接复用陈旧快照，
-- 不回源、不重复报错。成功同步时清空。

ALTER TABLE model_catalog_sync
  ADD COLUMN IF NOT EXISTS failed_at timestamptz;

COMMENT ON COLUMN model_catalog_sync.failed_at IS
  '最近一次回源失败的时刻；退避窗口内不再重试，避免每次渲染都打上游';