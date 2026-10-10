# Notion 工作日历 · 在线版 1.1.0（简化部署）

在已连接 Notion 和旧 Redis 的 Vercel 项目中，只需新增一个服务端环境变量 `APP_PASSWORD`。无需在电脑运行 npm、生成哈希或配置会话密钥。访问口令至少 14 字符，推荐 20 字符以上的随机口令；不要使用公开示例或重复使用其他账户密码。

## 上传 GitHub

解压后，将 `notion-work-calendar-deploy` 文件夹里的文件/子文件夹上传到原 GitHub 仓库根目录，覆盖同名文件。根目录应看到 `package.json`、`vercel.json`、`api/`、`lib/`、`web/`。不能只上传 zip 或 web 文件夹。不要上传真实 .env 文件、令牌、口令或 node_modules。

## 保留已有配置

保留 NOTION_API_TOKEN、三个 *_DATA_SOURCE_ID、NOTE_DATE_PROPERTY、CALENDAR_CACHE_KEY、Vercel Storage 自动注入的 KV_REST_API_URL 和 KV_REST_API_TOKEN。

新增 `APP_PASSWORD`（Production），Value 填自己设置的强访问口令，不加引号。不需 APP_PASSWORD_HASH / SESSION_SECRET / CRON_SECRET。旧哈希和会话变量仍兼容；设置 APP_PASSWORD 时优先采用简化模式。

Vercel 默认域名自动识别；自定义域名使用 APP_URL=https://实际域名，末尾不加路径。Production 支持 Vercel 提供的生产域名和本次部署域名，Preview 不自动信任 Production 域名。已有 APP_URL 会严格限制到该域名；如填错，修改或删除后重新部署。

## Redis 和数据兼容范围（重要）

- 复用原 `notion-graph-cache` 数据库实例与 REST 读写凭据，不用新建、不用付费升级来安装本包。
- 日历仅写 `notion-calendar:v1:snapshot:*`；原图谱 `notion-graph:*` 保持原样，不迁移、不删除、不覆盖。不允许将 CALENDAR_CACHE_KEY 设置成图谱键。
- 1.0.0 日历缓存 schema=1 与 source fingerprint 保持不变：同数据源、同笔记日期属性、同缓存键可继续读取。
- 原关系图 7.8.3 的 graph schema=3 不是日历 schema=1，本包不会冒充能直接读取 graph nodes/edges 为完整日历。日历首次从授权 Notion 数据库同步真实记录，单独保存。
- 两个应用不会自动同步彼此的缓存；共享 Redis 的容量和请求额度。是否收费由现有数据库套餐/使用量决定，本包不调整套餐。
- KV_URL / REDIS_URL / read-only token 不能代替 REST 读写变量。代码兼容旧 UPSTASH_REDIS_REST_URL / TOKEN；非空旧值优先，因此错误旧值应删除。不要混用不同实例的 URL/token。

## Vercel

Framework: Other；Build: npm run build；Root: 仓库根目录（或实际含 package.json 的目录）；Output Directory: 保留 Other 默认，不改成 web；Node: 22.x。依赖由 Vercel 自动安装。本地无需执行命令。

部署 Ready 后，用正式域名打开，登录 → 同步数据 → 诊断（cacheMode 应为 redis）。首次同步可能分段完成，失败保留旧缓存。授权不足要在 Notion 的数据库 Connections 添加对应集成。

## 同步方式

本包默认打开页面后检查同步、提供手动同步；长时间不打开不会保证数据自动更新。为了免填额外变量，默认 vercel.json 不再启用每日 Cron。可选配置见 DEPLOYMENT.md；启用 Cron 仍须独立 CRON_SECRET，不以访问口令充当 Cron 密钥。

## 安全

服务端环境变量保存 APP_PASSWORD；服务器用用途隔离、按日历命名空间限定的 scrypt 派生签名密钥，不把口令存入 Redis或发送给浏览器。口令变更并重新部署后旧会话失效；使用强口令尤其重要（Cookie 签名安全依赖口令强度）。兼容原哈希/独立会话密钥模式。HttpOnly Cookie、8 小时会话、CSRF、Origin、Redis 频率限制和页面/数据访问保护保留。不是多用户登录/MFA/SSO。

不读取正文、不递归扫描普通页面、不修改 Notion。不内嵌历史/演示工作数据、不提供公开数据端点。Notion iframe 受第三方 Cookie 限制，登录失败时在新窗口打开。

## 验证

见 VALIDATION.md。本包已做本地合成测试；未连接你的真实 Redis、Notion、GitHub 或 Vercel。交付压缩包不代表已经上线。
