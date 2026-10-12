# v1.4.1 界面优化版上传步骤

## 1. 替换代码

打开已有日历 GitHub 仓库的 Vercel Production 分支（通常 main）。解压本包，将 notion-work-calendar-deploy 里面的内容通过 Add file → Upload files 覆盖到原目录，Commit changes。不是上传 zip 本身。

根目录应看到 package.json、vercel.json、server.mjs、api、lib、web。若项目 Root Directory 以前是子目录，就覆盖该子目录内容。新版含新增 web/ui.js，务必一起上传；它不是可选文件。必须覆盖 api/login.mjs、api/logout.mjs、api/session.mjs、lib/auth.mjs、web/login.html 等旧登录相关文件；新版将旧入口退役，无需手工删除它们。

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

若有旧日历缓存直接显示，后台静默检查；只有旧关系图缓存时，从 Notion 首次同步建立日历独立缓存。

- 同步数据右侧下拉 → 诊断信息：appVersion 1.4.1，authMode public，cacheMode redis。
- 检查项目/任务/笔记记录、原页面链接与筛选，刷新仍能读取。
- /login 不再显示口令框；无 APP_PASSWORD 也可访问日历。
- 原关系图应用与 Redis 数据保持正常。

## 5. 故障

500 Invalid export：确认 server.mjs 新版默认导出以及 vercel.json 已覆盖，部署的是新版 commit。

BOOTSTRAP_REQUIRED：没有有效日历缓存，会尝试自动同步；失败时从同步按钮右侧下拉打开诊断，检查 Notion/Redis；页面不弹出状态提示。

DATA_SOURCE_IDS_REQUIRED / NOTION_TOKEN_REQUIRED：核对必需变量及 Production 范围，修改后重新部署。

CACHE_UNAVAILABLE：检查 REST URL/token是否同实例、读写权限与容量/额度；不要清空 Redis。

ORIGIN_REJECTED：已有 APP_URL 和正在访问域名不一致；修正 APP_URL 或使用配置域名。标准 Vercel 系统域名通常自动识别。

## 可选定时同步

默认没有 Cron。需要每日离线同步时才配置随机至少32字符 CRON_SECRET，再把 vercel.cron.example.json 的 crons 数组加入 vercel.json；0 2 * * * 为北京时间10点。Cron GET 仍需 Bearer 密钥；不能通过 manual=1 绕过。此密钥不是应用登录口令。

## 公开访问与回滚

这个版本有意公开日历数据。页面地址保密不是访问控制，Origin/限流不能阻止直接客户端读取公开 API。若以后需要私有，启用确实覆盖 Production 的平台保护，或回滚恢复应用登录；不要只依赖 Notion 原页面私有权限。

缓存 schema/fingerprint 与旧日历保持兼容，不清库。回滚旧应用需同时恢复其原认证配置。此包没有执行任何云端配置或真实数据库操作。

## 界面验收（本次重点）

1. 首页没有数据版本/连接状态横幅；搜索、周期、日期方式、筛选、原箭头周期导航、“现在”、同步在同一排。窄屏横向滚动操作条，而非整个页面。
2. 点击搜索内设置图标，调整选项仍保持展开；点空白处或 Esc 收起。输入提示随选项变化；已有个人搜索设置继续保留。
3. 切换周期/日期方式选择后收起；筛选面板内部修改不收起。仅笔记时状态禁用，切回任务/项目后原状态条件还在。
4. 视图设置仍在卡片右上角；原定位/排序/字段功能保留，主题在此面板中。
5. “现在”按实际北京时间定位；右栏默认空状态居中且到底，选中日期 → 事项 → 关联 → 返回正常。
6. 同步结果在诊断查看；技术详情 appVersion=1.4.1、authMode=public、cacheMode=redis。旧快照最近完成摘要为空不代表失败，下次完成同步后有记录。
7. 原图谱仍可使用。无需新 Redis、应用口令或新增变量；不必执行完整对账才算部署成功。

失败时不要清 Redis。优先检查新 commit、根目录、web/ui.js 上传与环境变量 Production 范围，然后从诊断获取错误码。若要回滚，选择上一版 Ready 部署；可选诊断字段兼容旧日历读取，无需改缓存键。

## 字段修复专项验收（无需新增环境变量）

1. 上传全部内容到原仓库后，等待新版 commit 的 Vercel 部署 Ready，打开正式页面。
2. 首次访问发现旧 mapping 会自动完整重读；完成前可暂时看到旧数据与“未同步（待字段升级）”。不要手动补人名、清 Redis 或改 CALENDAR_CACHE_KEY。
3. 打开“同步数据右侧下拉 → 诊断信息”：应用版本1.4.1、字段映射版本2/目标2、字段升级当前无需升级。若缓存版本仍1，查看异常后点同步继续；必要时用诊断内“完整对账三库”。
4. 在“字段校验”核对任务人员、笔记内容、项目完成度。以当前真实源为准，不把预期数量写死在网页。
5. 抽查此前红框任务“北极上下一体交付&培训”：在源未变时应显示7位人员，负责人不再显示；任务描述/备注源为空仍应显示未填写。
6. 查一条有内容的笔记，内容完整换行，并能按内容搜索；源无摘要字段时不显示虚假的笔记摘要。
7. 查项目完成度0%和100%不隐藏，源汇总与关联任务归档率分别显示；源公式剩余天数与日历剩余天数分别命名。
8. 附件仅安全HTTPS链接，过期时打开原页或完整对账。检查人员统计的“按每位分别计入”说明。

如果修复未完成：不要仅看 Ready 或应用版本；还要确认 cachedMappingVersion=2、mappingUpgradeRequired=false、字段计数与样本正确。新映射检查点会在同键下恢复，失败不发布半份数据。

没有默认 Cron。源公式/rollup值是同步时采集，网页没有每分钟读取 Notion；日历剩余天数才按实际今天计算。

## 本次界面验收

向下滚动检查工具条保持顶端、详情栏不被遮住。切换周/月/季/年，负责人应不出现在详情、显示字段或统计维度中，人员安排仍正常。详情底部旧说明句不再出现；创建时间为北京时间。无需新增变量或重建 Redis，已是 mappingVersion=2 的缓存正常复用。

嵌入页面的吸顶以嵌入网页自身滚动区域为界；不能跨 iframe 固定到 Notion 宿主页面。若宿主滚动将整个嵌入块移走，工具条也随块移动。
