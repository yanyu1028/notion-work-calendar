# 1.2.0 — 移除应用登录

用户确认取消登录后，主页与日历数据无需 Cookie/应用口令。移除表单、会话到期跳转和退出按钮，/login 重定向首页。旧登录 API 退役，保留空入口文件供 GitHub 覆盖。不再读取 APP_PASSWORD/HASH/SESSION_SECRET/COOKIE_SAMESITE。

同步保留 POST、同源与自定义请求头检查、限流及锁；这些不是私人访问控制。可选 Cron GET 仍需独立密钥。旧 Redis 和日历 schema/fingerprint 不变；关系图缓存隔离不变。保留 1.1.1 默认服务器导出、原生路由和 web 打包修复。
