# v1.1.0 验证记录

## 本次实际完成

- 45 项 Node 合成测试通过，0 失败。包含旧模式 HTTP 回归、单 APP_PASSWORD HTTP 登录/会话/诊断、新模式签名/口令轮换、弱口令拒绝、Origin/CSRF、自动识别 Vercel 生产域名/Preview 隔离。
- 旧 Redis 兼容测试使用模拟 REST 服务：KV_REST_API_URL/TOKEN 正确认证；日历读写键限定在 notion-calendar 命名空间；原 graph schema=3 数据保持原样；已有日历 schema=1/fingerprint 可读取。
- 原有日期/分页/增量/断点/锁/原子提交/失败保留缓存测试保留。
- npm ci 与 npm run build 成功；安装审计报告 0 漏洞。
- API、前端和脚本语法检查通过。
- 归档不包含真实环境文件、node_modules、历史数据快照或生成的 vendor 脚本（Vercel 构建时生成）。

## 未完成的线上验收

没有操作用户的 GitHub/Vercel/Redis/Notion。本次未连接真实旧 Redis，未测试 Redis 服务端 Lua、实际源授权或 Vercel 域名系统变量；不可把模拟测试称为真实服务兼容验证。本地浏览器流程测试因当前环境缺少 Playwright 依赖未能执行，未将旧版本浏览器测试冒充本次结果。

部署后需要用户验证：正式域名登录、首次同步、诊断 cacheMode=redis/version=1.1.0、三类原页面链接、刷新、无痕访问保护，以及原关系图仍正常。第三方 Cookie/Notion iframe 仍需实际浏览器验收。
