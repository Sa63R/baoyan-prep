# 验收记录

最后更新：2026-09-17（Asia/Shanghai）

## 已执行

| 检查 | 命令 | 结果 |
|---|---|---|
| TypeScript | `pnpm typecheck` | 通过 |
| ESLint | `pnpm lint` | 通过 |
| 单元测试 | `pnpm test` | 20/20 通过 |
| API smoke | PowerShell 调用 bootstrap → feedback → records | 通过；AI 审查被保存为 `AI_REVIEW_ONLY` |
| 文本 PDF 导入 | 上传挑战说明 PDF | 通过；提取 2,572 字符并私密保存 |
| 生产构建 | `pnpm build` | 通过；14 个路由生成完成，无构建警告 |
| 生产服务 | `PORT=3100 pnpm start`，检查 health/bootstrap | 通过；SQLite 健康，3 来源/5 证据/5 结论 |
| Playwright | `pnpm test:e2e` | 3/3 通过；1440px 与 390px 截图已人工检查 |

## 自动化覆盖

- 引用存在、来源存在、准确摘录可定位。
- 外部事实没有证据时拒绝通过机械校验。
- 旧年份和其他批次不能匹配当前目标。
- 相同内容/转载不重复计为独立经历，冲突关系保留。
- 历史题必须有来源；`generated` 可以无历史出处但必须保留标签。
- AI 代码审查不能升级成 AC；自报 AC 保留 `self_reported`。
- 简历解析不添加原文没有的指标。
- 危险协议、环回、私网和元数据地址被拒绝。
- E2E 覆盖试卷模式答案隐藏、三关实际作答、刷新后记录存在和会话隔离。

## 仅模拟验证

- Tavily：按官方请求结构实现，但测试使用演示 fixture，没有消费真实额度。
- 模型：实现 OpenAI-compatible Chat Completions；演示返回固定且明确标记的反馈，没有调用真实模型。
- 演示学校、导师、经验与简历均为虚构。

## 尚未验证

- 真实学校网站的大规模抓取质量与复杂前端页面兼容性。
- 真实扫描 PDF OCR（本版本明确不支持）。
- 真实模型的提示稳定性、延迟与成本。
- 当前机器没有 Docker CLI，因此 Dockerfile/Compose 未实际构建；目标云主机上的启动与卷备份也未验证。
- 公网部署、负载、可用性与真实用户访谈。
