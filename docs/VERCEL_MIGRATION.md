# Vercel 账户迁移手册（2026-10-31）

> 背景：`app.coolha.com` 已在新 Vercel 账户/团队下重新部署，数据库改为空库重跑。  
> 本文覆盖：**本地如何接上新项目 → 新库跑迁移 → 域名切换 → 删除旧资源**。  
> ⚠️ 顺序不能颠倒：先让新环境跑通并接管域名，再删旧资源，否则站点会中断。

---

## 0. 迁移前诊断（本次实测）

| 项                         | 现状                                                     |
| ------------------------- | ------------------------------------------------------ |
| 本地 `.vercel/project.json` | **不存在**（只剩 `repo.json`）→ 本地未绑定任何 Vercel 项目，push 不会自动部署 |
| CLI 登录账户                  | `qinjiangban`（旧账户）                                     |
| 访问旧项目                     | **`Not authorized`** → 当前凭证已无权限，删不了旧项目                 |
| 可见团队                      | 仅 `coolha`（hobby）                                      |
| 旧项目 ID                    | `prj_2Zd9dENYklxBIQeAyKS6UMRUcLAH`                     |
| 旧 org ID                  | `team_VkTq5xAGcUlZyzYZkEcqIj1y`                        |
| 本地 `DATABASE_URL`         | 仍指向**旧** Neon：`ep-broad-math-b361ynsa-pooler...`       |
| git 远端                    | `github.com/coolha-com/app.coolha.com`（分支 `ai`，工作区干净）  |
| `pg_dump`                 | **未安装** → 本地无法直接备份数据库                                  |

**当前阻塞点**：本地 CLI 没有新账户权限，也删不了旧项目。所有云端操作都需要先 `vercel login`。

---

## 1. 本地接入新项目（你登录后执行）

```bash
cd C:/AAAAAA-Code/coolha-com/app.coolha.com

# 1) 备份现有本地 env（env pull 会覆盖）
cp .env.local .env.local.bak

# 2) 登录新账户（浏览器授权）
npx vercel login

# 3) 确认身份与团队
npx vercel whoami
npx vercel teams ls

# 4) 绑定到新项目（交互式选择新团队 → app.coolha.com）
npx vercel link

# 5) 拉取新项目的环境变量
npx vercel env pull .env.local
```

绑定成功后 `.vercel/project.json` 会出现新项目的 `projectId` / `orgId`，此后 `git push` 才会触发新项目部署（若新项目已接 GitHub 集成）。

**验证**：

```bash
cat .vercel/project.json          # 应有新的 projectId / orgId
npx vercel project ls             # 不再报 Not authorized
```

---

## 2. 新库跑迁移（空库重跑）

前提：`.env.local` 的 `DATABASE_URL` 已指向**新** Neon 实例（`env pull` 后应自动是新值）。

先确认指向新库，避免误跑在旧库上：

```bash
grep -m1 "^DATABASE_URL=" .env.local | sed -E 's|.*@([^/]+)/.*|host: \1|'
# 主机应与旧实例 ep-broad-math-b361ynsa 不同
```

按顺序执行 9 个迁移：

```bash
for f in db/migrations/00*.sql; do
  echo "=== $f ==="
  node scripts/apply-migration.mjs "$f" || break
done
```

注意事项（来自项目既有约束）：

- `apply-migration.mjs` **无迁移历史表**，靠 `IF NOT EXISTS` 保证幂等，重复执行安全。
- 其 SQL 解析器是朴素的：**值不要带引号、不支持行内注释**，改动 SQL 时需遵守。
- 迁移清单：`001_wallet_auth` / `002_wallet_session_chain_id` / `003_ai_gateway_usage` / `004_model_catalog` / `005_entitlements_and_quota` / `006_identity_users` / `007_subscription_orders` / `008_chat_history` / `009_catalog_sync_backoff`。

迁移后触发模型目录同步：

```bash
curl -s "https://<新项目域名>/api/v1/models?refresh=1" | head -c 300
curl -s "https://<新项目域名>/api/health"          # 应返回 ok，modelCount > 0
```

---

## 3. 新项目必须配齐的环境变量

`env pull` 只能拉取**新项目已存在**的变量。若新项目是全新创建，需先把下面这些补上（值从 `.env.local.bak` 或旧项目取）：

| 分组         | 变量                                                       |
| ---------- | -------------------------------------------------------- |
| 数据库        | `DATABASE_URL`、`DATABASE_URL_UNPOOLED`                   |
| Neon Auth  | `NEON_AUTH_BASE_URL`、`NEON_AUTH_COOKIE_SECRET`           |
| Alchemy    | `ALCHEMY_KEY`、`ALCHEMY_ID`、`ALCHEMY_WEBHOOK_SIGNING_KEY` |
| AI Gateway | `AI_GATEWAY_API_KEY`、`FREE_MODELS_ENABLED`               |
| 钱包 / Web3  | `REOWN_ID`                                               |
| 订阅收款       | `SUBSCRIPTION_TREASURY_ADDRESS`、`CRON_SECRET`            |

写入方式（避免 BOM 事故，必须走 `--value`，不要用管道）：

```bash
npx vercel env add NAME production,preview,development --force --yes --type config --value "值"
```

> 项目铁律：**任何凭证值都不得写进会入库的文件**（含 docs/、memory/）。本手册只列变量名。

---

## 4. 域名切换（关键顺序，别跳步）

`app.coolha.com` 目前绑定在旧项目上。Vercel **不允许同一域名同时绑两个项目**，所以必须"先摘后挂"：

1. 新项目先跑通预览域名（`xxx.vercel.app`），确认页面/健康检查/登录都正常。
2. 旧项目（需旧账户权限）→ Settings → Domains → 移除 `app.coolha.com`。
3. 新项目 → Settings → Domains → 添加 `app.coolha.com`，按提示配 DNS。
4. 等待 DNS 生效，验证：
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://app.coolha.com/
   curl -s https://app.coolha.com/api/health
   ```
5. 再走一次人工冒烟：`/chat` 200、匿名 POST 返回 401、`/ai/models` 有模型、`/ai/research` 用 WETH 地址能出真实数据。

---

## 5. 删除旧资源

> 前置：新环境已接管域名并验证通过。删除不可逆。

### 5.1 旧 Vercel 项目

需要**旧账户权限**（当前 CLI 的 `qinjiangban` 已 `Not authorized`，先 `vercel login` 切回有权限的账户）：

```bash
npx vercel login
npx vercel projects ls
npx vercel projects rm app.coolha.com --yes
```

或控制台：Project → Settings → 底部 **Delete Project**。

**删项目会一并删除**：该项目的全部 deployments、域名绑定、环境变量、以及通过 Vercel 集成创建的关联资源。

### 5.2 旧 Neon 数据库

旧库 `ep-broad-math-b361ynsa`（ap-southeast-1）属于 Neon 集成产品（本地 env 里的产品名 `Coolha-Data`）：

- **若随 Vercel 项目删除**：集成与数据库通常一并移除（控制台确认）。
- **若需单独删**：登录 Neon Console → 选择对应 Project → Settings → Delete Project。
- 也可在 Vercel → Storage/Integrations 里移除该 Neon 集成。

### 5.3 删除前最后检查

- [ ] 新项目 `/api/health` 返回 200 且 `modelCount > 0`
- [ ] 新域名可访问，登录（SIWE）与订阅支付链路可用
- [ ] 本地 `DATABASE_URL` 已确认指向新库（不是旧实例）
- [ ] 旧库确无需要保留的数据（本次决策：空库重跑，不需要）
- [ ] 已确认回滚方案：如需回滚，只能靠旧项目的 deployment 快照（项目一旦删除即不可回滚）

---

## 6. 常见坑

1. **`env pull` 覆盖本地文件**：先 `cp .env.local .env.local.bak`。  
   |  |  |  
   | --- | --- |
2. **凭证 BOM**：用 `vercel env add ... --value "值"`，不要用 `echo | vercel env add`（PowerShell 管道会注入 UTF-8 BOM，导致密钥失效）。
3. **Secret 类型不可回读**：CLI 默认存 `Secret`，之后 `env pull` 拿不到值；需要可回读时用 `--type config`。
4. **同变量多环境**：一个变量三环境要么分别加，要么用 `production,preview,development` 一次加；`preview` 需 `--yes`。
5. **本地跑迁移 = 直接改生产库**：本项目本地与生产曾共用同一 Neon 实例，改前务必确认 host 是新库。
6. **构建缓存占用**：开着 `npm run dev` 时 `.next` 被占用，`rm -rf .next && npm run build` 会失败——先停 dev server。

---

## 7. 一句话总结

> **先登录新账户 → `vercel link` + `env pull` → 新库跑 001~009 → 域名从旧项目摘到新项目 → 验证通过 → 才删旧项目和旧库。**  
> 顺序错了会中断站点，删早了不可回滚。

