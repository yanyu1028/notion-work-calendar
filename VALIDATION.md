# v1.2.0 验证记录

- 45 项本地 Node 合成测试通过，0 失败；覆盖匿名首页/日历数据/诊断、旧登录地址返回首页、登录/退出 API 退役、无 Cookie/应用密钥同步、Origin/自定义头检查、GET Cron 无凭据拒绝、文件访问白名单、Vercel 默认入口/web 打包及原有同步算法。
- 本地 Playwright/Chromium 桌面1280×900、移动390×850均通过5项检查：直接进入或旧登录地址跳转、日历初始化、不出现口令框与退出、刷新、公开诊断；0 页面 JavaScript 错误。使用3条合成记录，数据与测试脚本均不放进部署包。
- Redis REST 使用模拟服务验证旧 KV URL/token 兼容、日历 schema=1 可继续读取、图谱键不变。并非用户真实 Redis 线上测试。
- npm test 与 npm run build 成功，前端与 API 语法检查通过。
- 不含真实密钥/.env.local/历史快照/node_modules/vendor生成文件。
- 未修改用户 GitHub/Vercel/Redis/Notion，未执行真实同步。云端部署、实际 Redis Lua/配额、数据库授权和 Notion iframe 仍需线上验收。

访问模式有意公开：没有应用认证，不可以将同源/限流测试描述为私人数据保护。Token不返回浏览器，Notion写操作不存在，但日历业务数据可由匿名请求读取（除非另有平台保护）。
