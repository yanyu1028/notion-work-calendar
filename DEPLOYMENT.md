# 本次 500 错误修复

日志确认 Vercel 选择了根 server.mjs，却找不到默认函数/服务器导出。新版提供默认处理函数，并兼容原生请求，不需要通过改 Redis 或加入密码来修复这项启动错误。

server.mjs、api/site.mjs、vercel.json 是关键修复文件。将完整包覆盖旧仓库内容并提交最方便。不要删除旧 Redis、不要重新配置现有凭据。

本次只修启动入口，没有取消应用访问保护。如果没有 APP_PASSWORD 且没有旧哈希/会话配置，/login 页可打开，但登录仍未配置；这与 Invalid export 启动错误不同。不要为绕过登录把工作数据直接公开。

# 重新上传与上线操作（无需终端）

## 1. 替换 GitHub 文件

1. 下载新版 zip，解压，打开 notion-work-calendar-deploy 文件夹。
2. 打开已有日历 GitHub 仓库，确认当前分支就是 Vercel 连接的 Production 分支（通常 main）。
3. Add file → Upload files，将该文件夹内的所有文件与子文件夹上传到仓库根目录，Commit changes。确保 vercel.json 也被覆盖；不是把 zip 上传到仓库。
4. 根目录看到 package.json、vercel.json、api、lib、web。若原 Vercel Root Directory 指向子文件夹，应更新那一目录内的代码，不另造根目录。
5. 不上传 .env.local、真实口令/Token、node_modules。系统隐藏的 .gitignore、.github 推荐同时上传，但不要为它们填写任何真实密钥。

## 2. 保留旧 Redis 和数据配置

在日历 Vercel 项目（不是关系图项目）Environment Variables，保持已有：

| Key | 值 |
|---|---|
| NOTION_API_TOKEN | 已授权的集成密钥（保留） |
| PROJECT_DATA_SOURCE_ID | ae69f1cd462483a5a092870eb8b62258（或实际源） |
| TASK_DATA_SOURCE_ID | 5f99f1cd4624825cb63a870768a37c55（或实际源） |
| NOTE_DATA_SOURCE_ID | 3ea9f1cd4624807f8085000b314feab5（或实际源） |
| NOTE_DATE_PROPERTY | 创建日期（须与实际属性一致） |
| CALENDAR_CACHE_KEY | notion-calendar:v1:snapshot |
| KV_REST_API_URL | 旧 Redis Storage 连接自动生成的 HTTPS URL |
| KV_REST_API_TOKEN | 同一旧数据库的读写 Token |

不用解绑旧关系图项目，不要 Flush/清空 Redis、不删图谱键、不重置数据库密码、不改套餐。其余自动注入 KV_URL、REDIS_URL、read-only token 可以保留（程序不使用它们）。若错误配置的 UPSTASH_REDIS_REST_* 仍存在，删除该日历项目的错误值，避免覆盖正确 KV 凭据。

## 3. 只新增 APP_PASSWORD

Add Environment Variable → Key: APP_PASSWORD → Value: 自己设置的至少 14 字符访问口令（推荐 20+ 随机字符）→ Production → Save。不填公开示例，不加引号，不发到聊天，不写进 GitHub。

- 新简化模式不需 APP_PASSWORD_HASH 或 SESSION_SECRET，已设置时也不用重新生成（APP_PASSWORD 优先）。若 APP_PASSWORD 为空，则沿用原哈希+会话密钥模式。
- CRON_SECRET 不再是默认部署要求；默认没有每日 Cron。
- COOKIE_SAMESITE 不填默认 Lax。
- 使用 Vercel 正式域名不需 APP_URL；若已有，确保访问地址与其一致。自定义域名才需显式填写完整 HTTPS Origin。Preview 不要继承 Production APP_URL。
- 不要启用 ALLOW_MEMORY_CACHE 或将 NODE_ENV 设置为 development 来绕过 Redis。

## 4. Vercel 构建和重部署

Framework: Other；Root: 含 package.json 的目录；Build Command: npm run build；Output Directory: 默认，不设 web；Node: 22.x。

GitHub commit 通常触发自动部署，但环境变量更新只影响新部署。在 Save APP_PASSWORD 后到 Deployments → 最近部署的菜单 → Redeploy，确保 Production，等待 Ready。部署来源应是上传新版文件的 commit。无需电脑执行 npm 命令。

## 5. 首次验收

正式域名新窗口 → 输入口令 → 同步数据 → 诊断。

- 版本 1.1.1，cacheMode=redis。
- 项目/任务/笔记真实记录与授权数据库一致，实际数量可能不同于历史截图。
- 三类各打开一项 → 打开 Notion 页面链接正常。
- 刷新保留缓存；无痕窗口先登录，匿名 API 不提供数据。
- 原关系图应用仍可使用，旧图谱 Redis 键未变。

如果只有旧图谱缓存，没有日历缓存：这是正常的。日历从 Notion 首次同步后建立自己的缓存，不会自动转换图谱 nodes/edges。

## 6. 常见问题

- APP_PASSWORD_REQUIRED_MIN_14：Production 的 APP_PASSWORD 不足 14 字符，或超过 256；改后重部署。
- AUTH_NOT_CONFIGURED：未配置 APP_PASSWORD，原模式的哈希/会话变量也没配齐。
- ORIGIN_REJECTED：已有 APP_URL 与访问地址不同；纠正 APP_URL。若平台没有提供自动域名变量也可显式配置。
- PERSISTENT_CACHE_REQUIRED：缺 REST URL/token；重新连接已有 Redis，不能用 REDIS_URL 代替。
- CACHE_UNAVAILABLE：检查同实例 URL/token、额度和服务状态；不要清空数据库作为修复。
- DATA_SOURCE_IDS_REQUIRED：缺三项源 ID或环境范围错误；改后重部署。
- 同步失败：确认三库授权给对应集成、源 ID和字段；已有有效数据保留。
- Notion 嵌入无法保持登录：先新窗口访问；第三方 Cookie 策略不能由此包保证。

## 可选每日定时同步（以后需要再配置）

默认不启用，减少初始配置。需要离线每日同步时：
1. 单独设置至少 32 字符随机 CRON_SECRET（不能和访问口令相同），Vercel Production。
2. 将 vercel.cron.example.json 内的 crons 数组合并进 vercel.json，保留其他配置。
3. 提交并重新部署，检查 Cron Jobs；0 2 * * * 表示北京时间每天 10:00。
4. 与关系图错开时间可减少共享 Redis/Notion 瞬时负载。不要改旧关系图的 CRON_SECRET 或任务。

Cron GET 仍严格要求 Bearer CRON_SECRET；浏览器同步要求已登录 POST + Origin + CSRF。定时执行可能分段，不能保证单次完成大型同步。

## 兼容和回滚

v1.1.1 保持日历缓存 schema=1、字段映射 fingerprint 与 v1.0.0 相同。同源/同键可复用已有日历快照和同步检查点。旧图谱 schema=3 保持隔离，只复用 Redis 服务不读取/改写其业务快照。

回滚部署不会修改 Notion。若回滚至只支持哈希的 1.0.0，要同时恢复 APP_PASSWORD_HASH/SESSION_SECRET；新版 APP_PASSWORD 单变量模式不被旧代码识别。旧部署已签 Cookie 在新派生密钥下无效，需要重新登录。
