# Notion 工作日历 1.4.0 · 无应用登录版

**公开访问提醒**：按用户确认，移除应用口令、登录页、会话与退出功能。若 Vercel 未开启访问保护，任何能访问网址的人都可读取日历记录和链接，也可从自己的客户端触发限流范围内的同步。Origin/请求头/限流不是私人访问控制。Notion 原页面权限不保护已读取并缓存的日历数据。

## 重新上传（无需终端）

1. 解压，进入 notion-work-calendar-deploy，将里面所有文件/文件夹覆盖到原日历 GitHub 仓库所在目录，提交。
2. 保留现有 Notion、三个源 ID、Redis REST 凭据、NOTE_DATE_PROPERTY、CALENDAR_CACHE_KEY。不用新增任何应用密码/密钥。
3. Vercel 等待新 commit 部署 Ready；必要时 Redeploy。
4. 打开正式首页。旧 /login 地址会跳回首页。旧映射缓存也会自动安排完整重读；首次没有日历缓存时自动尝试同步，也可点击“同步数据”。诊断应显示 appVersion 1.4.0、authMode public、cacheMode redis。

## 本次字段修复（v1.4.0）

保留 v1.3.0 工具条、菜单收起、原箭头/视图设置位置、真实“现在”、右栏与静默刷新；不重做整体视觉。

- 人员安排支持 multi_select；保留每个人的名称/选项 ID，不先拼接再拆分，不会拿负责人冒充人员安排。
- 任务/项目独立读取并显示负责人，保留用户 ID/名称；名字无法取得时明确标记信息不完整。
- 笔记实际“笔记内容”完整读取与换行显示，参与内容和已同步字段搜索；不冒充源摘要，不扫描页面正文。
- 项目完成度读取 rollup.number/formula.number/number，0% 不隐藏。源完成度与前端关联任务归档率分开。
- 补源四象限、源剩余天数、源任务状态、创建时间、附件；公式/汇总为同步时值，与实时日历剩余天数并列区分。
- 搜索范围明确为“全部已同步字段”：业务字段、负责人/人员、笔记内容、三库关联记录名称、附件名称等；不包含正文、按钮、第四库、内部技术键和附件内容全文。
- 统计可按人员安排、负责人、四象限、源任务状态分类；多人员分别计数，合计可能大于记录数；不影响原统计口径。
- 源空值显示“未填写”、源无属性显示“不适用”、旧映射空值显示“未同步（待字段升级）”；不支持类型/不完整数据在详情与诊断中区分。
- 诊断展示字段映射版本和人员/负责人/完成度/笔记内容读取数量；技术详情包括空值、缺失、异常计数。

## 旧缓存自动修复

缓存 schema 仍是 1，同一 Redis 实例与键，新增 mappingVersion=2。旧缓存继续可读；第一次访问自动检查发现旧映射后完整重读三库，忽略旧字段映射的同步检查点，并支持新版断点续读。只有完成后才原子替换有效数据；失败不清空旧缓存，诊断可查看原因并继续。

不依赖 Notion 记录被编辑，也不只做增量同步，避免159条旧人员仍为空。刷新或下次同步可继续暂停进度。没有在交付时操作真实 Redis/Notion。

附件签名链接有过期时间；过期链接不再直接点击，提示打开原 Notion 页面或进行“诊断 → 完整对账三库”刷新。普通增量可能不更新未编辑记录的签名链接；不要为了附件清空 Redis。

按钮 Done/创建笔记不执行；“待办事项完成”属于第四库，不默认扩展；源日期反向异常只提醒，不交换日期或写回。

**新增可访问内容提醒**：无应用登录的访问方式保持不变。新增的人员、负责人、笔记内容和附件链接也属于可被访问者读取的数据；若需要私有，请使用有效的平台访问保护。Notion 原页私有权限不会撤回已缓存的字段。

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
