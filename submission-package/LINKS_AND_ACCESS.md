# 产品与仓库链接

## 公网产品

- 正式 URL：**[待部署后填写]**
- 当前本机地址：`http://localhost:3100`（仅用于本地验收，不能作为正式提交链接）
- 登录方式：首版本地工具不提供账号系统。
- 真实联网：需要 DeepSeek 与 Tavily 配置。部署时优先使用服务端环境变量；若允许评委自带 Key，应在页面说明 Key 只保存在浏览器本地、不会写入数据库或导出文件。
- 测试数据：只使用脱敏简历或虚构数据，不上传真人个人信息。

## GitHub

- 仓库：<https://github.com/Sa63R/baoyan-prep>
- 可见性：Public（已核验）
- 默认分支：`main`
- 本提交包入库后提交数：16
- 许可证：Apache-2.0；第三方说明见仓库 `THIRD_PARTY_NOTICES.md`

## 本地运行

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Windows PowerShell：

```powershell
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

生产构建：

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm start
```

## 部署限制与说明

- SQLite 与上传文件需要持久磁盘，不能直接依赖无状态函数的临时文件系统。
- 公网部署必须设置不可预测的 `SESSION_SECRET`，并妥善配置 DeepSeek/Tavily 密钥。
- 不要把 `.env.local`、数据库、上传文件或真实简历提交到 GitHub。
- 若模型或搜索额度有限，应在邮件中明确可用时段、调用上限和失败时的演示替代路径。
