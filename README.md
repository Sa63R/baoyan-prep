# 循证保研

面向计算机相关保研考核的项目化、证据驱动准备工作台。每所学校拥有独立的申请目标、资料库和三关题单；系统先收集并筛选公开资料，再生成机试、面试题单和简历项目追问。无来源内容会明确标为 AI 补充，AI 代码复盘不会冒充真实判题。

## 已实现的纵向闭环

- 项目工作台：ChatGPT 式侧栏切换学校项目，支持置顶、可靠删除和多个精细申请目标。
- 项目资料库：Tavily 联网收集、URL/文本/PDF/图片导入、自动采集与用户上传分区、预览、下载和批量 ZIP。
- 两阶段资料筛选：规范化 URL/内容指纹去重与规则预筛后，再由 DeepSeek 按目标匹配、证据等级和适用关卡复核。
- 第一关机试：题源分类、原题链接、C++/Python/Java 草稿编辑器，以及不持久化的一次性 AI 静态复盘。
- 第二关面试题单：按高频主题组织问题，只读版本管理，不生成标准答案。
- 第三关项目追问：将当前脱敏简历与导师或课题组公开方向映射，只生成可能追问。
- 证据边界：题目区分官方真题/样题、回忆题、证据推断、通用补充和 AI 生成；来源可在证据抽屉中核查。
- 本地持久化与隔离：SQLite + Drizzle，学校项目、资料、研究任务和题单版本分开保存。

## 本地启动

要求 Node.js 22+ 与 pnpm 11+。

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

打开 <http://localhost:3000>。默认 `DEMO_MODE=true`；要进行真实联网研究与题单生成，需要在页面的 API Key 弹窗中填写 DeepSeek/Tavily Key，或使用服务端环境变量。

Windows PowerShell 可使用：

```powershell
Copy-Item .env.example .env.local
pnpm db:migrate
pnpm dev
```

## 真实模式

在 `.env.local` 中设置：

```dotenv
DEMO_MODE=false
SESSION_SECRET=<至少 32 字节的随机字符串>
APP_ACCESS_CODE=<保护搜索与模型额度入口的访问码>
LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=<服务端密钥>
LLM_MODEL=deepseek-flash
TAVILY_API_KEY=<服务端密钥>
```

DeepSeek/Tavily Key 也可由 API Key 弹窗配置，仅保存在当前浏览器的 `localStorage`，随请求发送给本机后端；不会写入数据库、日志或导出文件。公网多人环境优先使用服务端变量和独立测试额度。真实模式缺配置或外部请求失败会返回明确错误，不会静默伪造结果。

## 存储

- SQLite：`DATABASE_URL`，默认 `./data/baoyan-prep.db`
- 上传文件：`UPLOAD_DIR`，默认 `./data/uploads`
- 数据库、WAL、上传、简历和环境变量都被 `.gitignore` 排除。
- 单实例 Node 服务适合 SQLite 写入模型。不要直接部署到没有持久磁盘保证的无服务器环境。

## 测试

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

当前 5 个测试文件、30 项单元测试全部通过。旧版 Playwright 脚本仍指向大改版前的页面文案，尚待更新，不能表述为当前版本 E2E 已通过。详见 [EVALUATION.md](./EVALUATION.md)。

## Docker 部署

```bash
docker compose up --build -d
```

Compose 将 `/app/data` 挂载到命名卷 `baoyan-data`，并通过 `/api/health` 检查 SQLite。公网部署前必须替换 `SESSION_SECRET` 与 `APP_ACCESS_CODE`，并在反向代理层启用 HTTPS、请求大小限制和备份。

## 主要限制

- 第一版不在应用服务器执行用户代码，AI 复盘只做静态审查。
- 图片文字提取依赖模型能力；复杂版式、低清扫描件和受限页面仍可能失败。
- 联网研究是单次同步任务，尚未实现跨进程任务队列和自动周期采集。
- URL 抽取使用正文启发式清洗；复杂 JavaScript 页面可能仅部分成功。
- 尚未进行正式用户访谈、系统化来源质量评测或公网部署。

## 文档

- [ARCHITECTURE.md](./ARCHITECTURE.md) — 架构、数据模型与信任边界
- [DATA_SOURCES.md](./DATA_SOURCES.md) — 来源策略与真实适配器
- [EVALUATION.md](./EVALUATION.md) — 已运行检查与限制
- [submission-package/](./submission-package/) — 最终提交清单、Product Memo、邮件草稿、Demo 指南与附加材料
- [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) — 参考与第三方许可

原创代码按 Apache-2.0 许可发布。公开的是代码，不是用户数据。
