-- 016：退出 Waffo（只在 Neon dev 上执行，禁止 --prod）
--
-- 014_waffo_orders.sql 是已经执行过的历史迁移，保留不改。
-- 本文件只删除 Waffo 专属表。不触碰：
--   agent_service_grants、agent_usage_ledger、chat_sessions、subscription_orders。
--
-- 两张表之间没有外键；其他业务表也不引用它们。
-- webhook 事件表先删，订单表后删。

DROP TABLE IF EXISTS waffo_webhook_events;
DROP TABLE IF EXISTS waffo_orders;
