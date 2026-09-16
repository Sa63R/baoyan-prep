# 循证保研

面向计算机相关保研考核的证据驱动准备工作台。产品先把学校、院系、项目、批次、年份和导师范围调查清楚，再把可定位的证据转成机试、专业面试和项目追问训练。所有外部事实都保留来源边界；旧年经验不会冒充当前规则，AI 审查不会冒充真实判题。

## 已实现的纵向闭环

- 调查工作台：目标范围、研究状态、官方事实/经验陈述/未知、冲突与缺口、桌面证据抽屉和移动 Sheet。
- 三类资料入口：Tavily 自动搜索适配器、带 SSRF 防护的公开 URL 正文读取、PDF/TXT/Markdown/脱敏文字导入。
- 调查档案：Source → Evidence → Claim 结构、摘录定位、转载/内容哈希去重、Markdown 脱敏导出和浏览器打印。
- 机试训练：题型来源标签、原创完整题面、计时、代码草稿、原 OJ 跳转、自报结果和 AI 代码审查。
- 专业面试：学习/试卷模式、提交前隐藏要点、3 轮追问、基于实际回答的反馈与复测。
- 项目追问：简历事实确认、导师研究证据、关联强度、未知字段和不同措辞复测。
- 持久化与隔离：SQLite + Drizzle；随机会话 ID 经 HMAC 签名写入 HttpOnly Cookie；每条数据校验工作区所有权。
- 安全边界：真实额度入口访问码、服务端密钥、URL 协议/DNS/重定向校验、文件类型与大小限制、私有导出脱敏、工作区与附件删除。

## 本地启动

要求 Node.js 22+ 与 pnpm 11+。

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

打开 <http://localhost:3000>。默认 `DEMO_MODE=true`，无需密钥。演示中的学校、导师、经历与网页均为虚构，界面持续显示演示标识；固定反馈明确标注“未调用模型”。

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
TAVILY_API_KEY=<服务端密钥>
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=<服务端密钥>
LLM_MODEL=<兼容 Chat Completions 的模型名>
```

前端“资料与来源”页只接收 `APP_ACCESS_CODE`，并仅保存在当前标签页的 `sessionStorage`。Tavily 与模型密钥从不发送到浏览器。真实模式缺配置或外部请求失败会返回明确错误，不会降级成虚构搜索结果。当前未使用任何真实密钥进行 smoke test。

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

Playwright 测试覆盖三关作答、试卷答案隐藏、记录刷新后保存、会话隔离，以及 1440px/390px 核心界面。外部 API 测试使用演示 fixture，不消耗真实额度。详见 [EVALUATION.md](./EVALUATION.md)。

## Docker 部署

```bash
docker compose up --build -d
```

Compose 将 `/app/data` 挂载到命名卷 `baoyan-data`，并通过 `/api/health` 检查 SQLite。公网部署前必须替换 `SESSION_SECRET` 与 `APP_ACCESS_CODE`，并在反向代理层启用 HTTPS、请求大小限制和备份。

## 主要限制

- 第一版不在应用服务器执行用户代码；只有用户自报与 AI 审查，没有 `sandbox_judged` 结果。
- PDF 仅可靠处理文本层；扫描件会返回 `needs_text`，不做假提取。
- 自动调查默认最多 10 次搜索与 20 个页面，当前界面提供单次任务入口，尚未实现跨进程任务队列。
- URL 抽取使用正文启发式清洗；复杂 JavaScript 页面可能仅部分成功。
- 尚未进行真实用户访谈、真实大学资料导入、真实 Tavily/LLM smoke test或公网部署。

## 文档

- [ARCHITECTURE.md](./ARCHITECTURE.md) — 架构、数据模型与信任边界
- [DATA_SOURCES.md](./DATA_SOURCES.md) — 来源策略与真实适配器
- [EVALUATION.md](./EVALUATION.md) — 已运行检查与限制
- [docs/product-memo.md](./docs/product-memo.md) — 产品取舍与待验证假设
- [docs/demo-script.md](./docs/demo-script.md) — 三分钟演示脚本
- [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) — 参考与第三方许可

原创代码按 Apache-2.0 许可发布。公开的是代码，不是用户数据。
