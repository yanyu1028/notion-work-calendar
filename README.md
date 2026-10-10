# Notion 工作日历 1.2.0 · 无应用登录版

**公开访问提醒**：按用户确认，移除应用口令、登录页、会话与退出功能。若 Vercel 未开启访问保护，任何能访问网址的人都可读取日历记录和链接，也可从自己的客户端触发限流范围内的同步。Origin/请求头/限流不是私人访问控制。Notion 原页面权限不保护已读取并缓存的日历数据。

## 重新上传（无需终端）

1. 解压，进入 notion-work-calendar-deploy，将里面所有文件/文件夹覆盖到原日历 GitHub 仓库所在目录，提交。
2. 保留现有 Notion、三个源 ID、Redis REST 凭据、NOTE_DATE_PROPERTY、CALENDAR_CACHE_KEY。不用新增任何应用密码/密钥。
3. Vercel 等待新 commit 部署 Ready；必要时 Redeploy。
4. 打开正式首页。旧 /login 地址会跳回首页。首次没有日历缓存时自动尝试同步，也可点击“同步数据”。诊断应显示 version 1.2.0、authMode public、cacheMode redis。

## 旧 Redis 兼容

复用原 notion-graph-cache 实例和自动注入的 KV_REST_API_URL / KV_REST_API_TOKEN（读写，不是 READ_ONLY_TOKEN）。旧 UPSTASH_REDIS_REST_URL / TOKEN 仍支持且非空优先：若存在错误旧值应删除。KV_URL/REDIS_URL 不能代替 REST 凭据。

日历仅写 notion-calendar:v1:snapshot:*，不覆盖/删除/迁移 notion-graph:*。保持已有日历 schema=1/fingerprint 与 1.0.0/1.1.x 一致。同源、同键可复用缓存与同步检查点。旧关系图 schema=3 不是日历数据格式；日历从同一 Notion 数据源同步真实记录，不把 graph nodes/edges 冒充完整日历数据。共享 Redis 容量/请求额度，费用由实际套餐与用量决定。

## 已移除与保留

- 移除：应用口令验证、登录表单、8 小时会话、到期跳转、退出按钮。旧 APP_PASSWORD / APP_PASSWORD_HASH / SESSION_SECRET / COOKIE_SAMESITE 变量不再读取，可留着或删除。
- 保留：server.mjs 默认处理函数修复、web/** 文件打包、页面文件白名单、前端不含服务端密钥、同步 POST/同源检查/显式请求头、Redis 限流/锁/原子发布、失败保留缓存、断点恢复。
- /api/login 与 /api/logout 返回 410（旧文件被新版本替换，避免仅上传无法删除旧文件的问题）；/api/session 返回 requiresLogin=false，前端不调用它。
- 公共数据/诊断不包含 Token、原始 Notion API records 或正文。标准日期/标题/状态/关系及其他日历字段属于可访问的数据。
- 不修改 Notion、不扫描正文、不递归普通页面。原页面链接仍受 Notion 自己的权限控制。

## 环境与构建

Framework Other；Root 含 package.json；Build npm run build；Output 默认，不设 web；Node 22.x。Vercel 自动安装依赖和生成 Chart.js，电脑无需 npm。

标准 Vercel 域名自动识别用于同步 Origin 校验。已有 APP_URL 会严格限定该地址，需与实际访问一致；自定义域名显式填 HTTPS Origin，无末尾路径。若打开的是非配置域名，同步可能 ORIGIN_REJECTED，页面数据读取不依赖此项。

默认打开页面检查/手动同步，无离线每日 Cron。可选 Cron 仍需独立 CRON_SECRET 与 vercel.cron.example.json；不要把 Notion/Redis Token 当 Cron 密钥。

详见 DEPLOYMENT.md / VALIDATION.md。交付包不是云端上线确认。
