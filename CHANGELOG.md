# 1.1.1 — Vercel 服务入口修复

- 根据真实日志 Invalid export found in module /var/task/server.mjs 修复：根入口提供默认 request/response 函数。
- 保留本地开发 named server，但 Vercel 导入时不主动 listen。
- 根入口也显式打包 web/**，避免入口自动检测后遗漏登录页/前端资源。
- 无 request.query helper 的原生请求也能处理 /api/site?path= 重写。
- 不修改 Redis 数据结构/命名空间或认证策略；未添加 APP_PASSWORD 的认证方式仍待用户确认。

# 1.1.0

- 新增单 APP_PASSWORD 模式，服务器 scrypt 派生用途隔离会话签名密钥；可兼容旧哈希+SESSION_SECRET 模式。
- Vercel 生产域名/部署域名通过平台系统变量识别；自定义 APP_URL 保留严格校验。
- 原 Redis/KV REST 变量支持保持不变，旧日历 schema/fingerprint 不变，旧图谱键不触碰。
- 诊断新增 authMode/cacheNamespace，仅返回非敏感元数据。
- 默认移除 Cron 配置，不需要 CRON_SECRET；保持打开检查和手动同步，附可选 Cron 配置。
- 重写无需终端的 GitHub/Vercel 上传步骤。未更改日历展示布局和筛选功能。
