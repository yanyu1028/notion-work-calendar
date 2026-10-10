# 免应用登录版上传步骤

## 1. 替换代码

打开已有日历 GitHub 仓库的 Vercel Production 分支（通常 main）。解压本包，将 notion-work-calendar-deploy 里面的内容通过 Add file → Upload files 覆盖到原目录，Commit changes。不是上传 zip 本身。

根目录应看到 package.json、vercel.json、server.mjs、api、lib、web。若项目 Root Directory 以前是子目录，就覆盖该子目录内容。必须覆盖 api/login.mjs、api/logout.mjs、api/session.mjs、lib/auth.mjs、web/login.html 等旧登录相关文件；新版将旧入口退役，无需手工删除它们。

不要上传实际 .env.local、真实 Token、口令或 node_modules。包内 .env.example 只有空密钥与已知源 ID 示例。

## 2. 保留现有变量

| 名称 | 内容 |
|---|---|
| NOTION_API_TOKEN | 保留你已授权的集成密钥 |
| PROJECT_DATA_SOURCE_ID | ae69f1cd462483a5a092870eb8b62258，或实际源 |
| TASK_DATA_SOURCE_ID | 5f99f1cd4624825cb63a870768a37c55，或实际源 |
| NOTE_DATA_SOURCE_ID | 3ea9f1cd4624807f8085000b314feab5，或实际源 |
| NOTE_DATE_PROPERTY | 创建日期，或实际属性名 |
| CALENDAR_CACHE_KEY | notion-calendar:v1:snapshot |
| KV_REST_API_URL | 原 Redis 自动注入的 REST URL |
| KV_REST_API_TOKEN | 同实例读写 Token |

确保 Production。其它 Storage 自动注入变量可留着。不要重建/清空 Redis，不解绑原图谱应用，不修改图谱键。若日历项目里还有错误的 UPSTASH_REDIS_REST_* 值，删掉错误值，因为会优先覆盖 KV 值。

**无需 APP_PASSWORD、APP_PASSWORD_HASH、SESSION_SECRET、COOKIE_SAMESITE。**已有这几个变量不影响新版，删除也是可选，不用因此再做一遍配置。

## 3. 部署

Framework Other、Node 22.x、Build npm run build、Output 默认（不要设 web），Root 为上述目录。GitHub commit 后等待自动部署；环境修改后需重新 Redeploy。确认 Deployment 来源为新版 commit，状态 Ready。

打开 https://你的正式域名/，直接进入日历；以前收藏的 /login 也会返回首页。不输入任何访问口令，不会创建应用登录 Cookie。Vercel 自身的项目访问保护不会被本包关闭，若仍出现 Vercel 登录是平台保护，不是应用表单。

## 4. 数据验收

若有旧日历缓存直接显示，再检查同步；只有旧关系图缓存时，从 Notion 首次同步建立日历独立缓存。

- 同步数据 → 诊断：appVersion 1.2.0，authMode public，cacheMode redis。
- 检查项目/任务/笔记记录、原页面链接与筛选，刷新仍能读取。
- /login 不再显示口令框；无 APP_PASSWORD 也可访问日历。
- 原关系图应用与 Redis 数据保持正常。

## 5. 故障

500 Invalid export：确认 server.mjs 新版默认导出以及 vercel.json 已覆盖，部署的是新版 commit。

BOOTSTRAP_REQUIRED：没有有效日历缓存，会尝试自动同步；失败时按提示检查 Notion/Redis。

DATA_SOURCE_IDS_REQUIRED / NOTION_TOKEN_REQUIRED：核对必需变量及 Production 范围，修改后重新部署。

CACHE_UNAVAILABLE：检查 REST URL/token是否同实例、读写权限与容量/额度；不要清空 Redis。

ORIGIN_REJECTED：已有 APP_URL 和正在访问域名不一致；修正 APP_URL 或使用配置域名。标准 Vercel 系统域名通常自动识别。

## 可选定时同步

默认没有 Cron。需要每日离线同步时才配置随机至少32字符 CRON_SECRET，再把 vercel.cron.example.json 的 crons 数组加入 vercel.json；0 2 * * * 为北京时间10点。Cron GET 仍需 Bearer 密钥；不能通过 manual=1 绕过。此密钥不是应用登录口令。

## 公开访问与回滚

这个版本有意公开日历数据。页面地址保密不是访问控制，Origin/限流不能阻止直接客户端读取公开 API。若以后需要私有，启用确实覆盖 Production 的平台保护，或回滚恢复应用登录；不要只依赖 Notion 原页面私有权限。

缓存 schema/fingerprint 与旧日历保持兼容，不清库。回滚旧应用需同时恢复其原认证配置。此包没有执行任何云端配置或真实数据库操作。
