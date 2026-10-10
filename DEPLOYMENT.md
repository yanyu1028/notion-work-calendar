# 部署与运维手册

## 0. 当前交付边界

这是可部署工程，不是已发布的网址。首次上线需要你的 GitHub/Vercel 账号、Notion Integration 和 Redis 配置。没有真实密钥时不能初始化线上数据。

建议单独仓库 `notion-work-calendar`、单独 Vercel 项目及缓存命名空间。不要覆盖关系图谱项目，不复制它的缓存键或迁移旧缓存。

## 1. Notion 授权

在 Notion 集成管理页创建/选择 Internal Integration，只授予读取内容和确有需要的用户信息，不授予写入。通过数据库 Connections 将项目、任务、笔记三库共享给它。

.env.example 中三个值为原部署包的数据源 ID（不是数据库页面 ID）：

| 变量 | 值 |
|---|---|
| PROJECT_DATA_SOURCE_ID | ae69f1cd462483a5a092870eb8b62258 |
| TASK_DATA_SOURCE_ID | 5f99f1cd4624825cb63a870768a37c55 |
| NOTE_DATA_SOURCE_ID | 3ea9f1cd4624807f8085000b314feab5 |

上线前核对对应关系。若换库，更新三项配置和缓存键；服务端 fingerprint 会拒绝读取旧数据源快照。Notion API 固定版本 2025-09-03。

字段别名在 lib/calendar-data.mjs：项目名称/任务名称/笔记名称（兼容 名称/Name）、开始日期/起始日期、截止日期/到期日期、任务周期/日期、状态、优先级、类别、描述/备注、人员安排/负责人/执行人、需求人、项目关联/所属项目/关联项目、任务关联/关联任务、笔记关联/关联笔记。

笔记默认 `NOTE_DATE_PROPERTY=创建日期`。验证业务属性后再调整，不默认用系统 created_time 补空值。未知状态保留并进入诊断，不自动归类到“已归档”。

## 2. Redis

新建 Upstash Redis，或复用已有实例。填写 REST URL 和 REST TOKEN；代码兼容 KV_REST_API_URL/KV_REST_API_TOKEN。

Production：`CALENDAR_CACHE_KEY=notion-calendar:v1:snapshot`。
Preview：`CALENDAR_CACHE_KEY=notion-calendar:preview:v1:snapshot`，最好使用单独测试实例及测试数据源。

本工程的数据键为 `${CALENDAR_CACHE_KEY}:data`，检查点为 `:job`，锁为 `:lock`，限频为 `:rate:*`。不接触 `notion-graph:*`。

**生产没有 Redis 时接口返回 PERSISTENT_CACHE_REQUIRED，不假装同步成功。** 本地仅在 NODE_ENV=development、ALLOW_MEMORY_CACHE=true 且不在 Vercel 时允许临时内存测试；进程退出即丢失，不用于上线。

## 3. 配置登录

运行 `npm run credentials`，在你自己的终端设置至少 14 字符的随机长口令，输入不回显。将输出的 APP_PASSWORD_HASH、SESSION_SECRET、CRON_SECRET 安全保存为平台环境变量。不要上传真实 .env.local，勿在命令行参数/聊天提供口令。

访问口令是应用自己的登录口令，不是 Notion、GitHub 或 Vercel 的密码。本版是单用户认证，不是多人账号系统。

## 4. 本地验证

```bash
npm ci
npm run build
cp .env.example .env.local
# 填好 .env.local，包括 APP_URL=http://localhost:3000
npm test
npm run dev
```

访问 `http://localhost:3000`，应先进入登录页。未登录请求 `/api/calendar` 或 `/api/diagnostics` 应得到 401。

登录后首次等待三库初始化；检查诊断中三库计数、缺开始/截止日期、非法日期、异常范围及未知状态。抽查项目/任务/笔记各 3–5 条，与 Notion 属性一致。

## 5. GitHub

新建私有仓库，上传工程（不是旧单文件 HTML）。不要上传 node_modules、.env.local 或本地真实快照。web/vendor/chart.umd.js 由构建生成，不提交；package-lock.json 必须提交。

```bash
git init
git add .
git status                 # 确认无密钥与真实快照文件
git commit -m "Initial private online calendar"
git branch -M main
git remote add origin https://github.com/<你的账号>/notion-work-calendar.git
git push -u origin main
```

GitHub Actions 自动执行 npm ci、32 项基础回归（后续以实际运行数量为准）、构建和敏感文件检查。通过后再发布。

## 6. Vercel

Add New → Project → Import GitHub 仓库：
- Framework Preset：Other。
- Root Directory：工程根目录。
- Build Command：`npm run build`（vercel.json 已配置）。
- Output Directory：留空，不设为 web。前端由受保护 site 函数提供，避免静态目录绕过登录。
- Node：22 或 24，与本地/CI 一致。
- 不开启 Directory Listing。

配置：NOTION_API_TOKEN、三项 Data Source ID、NOTE_DATE_PROPERTY、Redis REST URL/TOKEN、CALENDAR_CACHE_KEY、APP_PASSWORD_HASH、SESSION_SECRET、CRON_SECRET。

APP_URL：生产正式 HTTPS Origin，例如 `https://calendar.example.com`，不带路径。若没有自定义域名，可以先留空，代码使用平台 VERCEL_URL。配置 APP_URL 后必须从同一个域名访问，以免 Origin 校验拒绝登录/同步。Preview 应使用自身 Origin，不能继承生产 APP_URL。

Production 不设置 ALLOW_MEMORY_CACHE=true。Vercel 环境也会强制拒绝内存降级。不要把生产 Notion/Redis 密钥提供给不可信 PR Preview。

配置或修改环境变量后重新部署；确认 routes 全部进入 api/site 或已列出的 api 函数。`/lib/auth.mjs`、`/web/index.html`、`/.env.local`、`/package.json` 不应被静态文件服务公开。

## 7. Cron

默认每天一次 `/api/sync`：`0 2 * * *`，Vercel 按 UTC 执行，即北京时间 10:00。若想北京时间凌晨 02:00，可以改为 `0 18 * * *`（前一 UTC 日 18:00）。请按套餐核对 Cron 数量、频率、函数 60 秒预算。

Cron GET 要求平台发送 `Authorization: Bearer <CRON_SECRET>`。浏览器同步为 POST，要求用户 Cookie、同 Origin 与 CSRF。`manual=1` 等参数不会绕过认证。

每天 Cron 只执行本轮 40 秒预算；较大库如果尚未完成，会保留检查点，由下一次 Cron/页面打开/手动同步继续。想提高 Cron 频率须先确认套餐，再编辑配置，不保证单个日任务能扫描任意大小的库。

## 8. Production 验收

- 匿名：主页和 app.js 跳转登录；数据/诊断 401。
- 登录：三库计数与真实数据源对应，无演示数据。
- 开始、截止、连续模式；周/月/季/年；热力与统计的不同日期口径正确。
- 手动同步、新增/修改记录、全量对账删除；失败保留旧数据；断点可继续。
- 定位后保留面板；更新后保留周期/筛选/搜索/详情。
- 明亮/暗黑、320px/390px、柱形数值不裁切。
- 无 JSON 响应、页面或日志泄露 Token；诊断不包含密钥或原始全文。
- Redis keys 只在 notion-calendar 命名空间；原关系图谱不受影响。
- 正式域名、版本 1.0.0、生成时间显示正确。

## 9. Notion 嵌入

先在独立网页完成安全验收，再在 Notion 使用 Embed 插入正式 HTTPS URL。CSP 允许 notion.so/notion.site/notion.com 相关来源嵌入（仍需实际客户端测试）。

默认 COOKIE_SAMESITE=Lax；如果 iframe 无法保持登录，可将 Production 配置为 COOKIE_SAMESITE=None 后重新部署，必须 HTTPS。CSRF/Origin 校验继续生效。浏览器第三方 Cookie 政策仍可能阻断，此时用独立网页，不公开接口或关闭认证。

若 Vercel Deployment Protection 又加一层登录，要在真实 Notion 客户端验证；不要设置公开 bypass token 来解决 iframe 问题。团队访问应另加组织认证方案。

## 10. 诊断、费用与回滚

诊断提供缓存模式、版本、三库计数、数据时间、完整对账时间、分页进度、关联待处理数和错误码；不显示密钥。关注 Vercel 请求/函数耗时、Redis 操作数和 Notion 429。

常见错误：
- AUTH_NOT_CONFIGURED：缺少正确口令哈希或会话密钥。
- ORIGIN_REJECTED：APP_URL 与浏览器地址不一致。
- PERSISTENT_CACHE_REQUIRED / CACHE_UNAVAILABLE：Redis 配置或服务问题。
- NOTION_HTTP_401：Integration 密钥无效。
- NOTION_HTTP_403/404：授权或数据源 ID 问题。
- LOCK_LOST / busy：另一个同步占用锁；等待或重试，不删除未知所有者的锁。
- paused：不是失败；下一次操作从检查点继续。

本版缓存 schema=1、应用=1.0.0。保留上一版 Vercel Deployment。更新若不兼容旧缓存结构，用新的 notion-calendar 键，保留旧键用于回滚；不要清空关系图谱 Redis。服务端不写 Notion，因此回滚应用不涉及恢复 Notion 数据。

真实 Notion/Redis/Vercel 发布与嵌入验收必须单独记录，不以本地合成测试替代。完成线上验收前不宣称已部署完成。
