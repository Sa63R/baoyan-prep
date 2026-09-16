import { NextRequest } from "next/server"
import { workspaceForSession, workspaceSnapshot } from "@/lib/db"
import { requireSession } from "@/lib/session"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const workspace = workspaceForSession(requireSession(request))
    if (!workspace) return new Response("工作区不存在", { status: 404 })
    const snapshot = workspaceSnapshot(workspace.id)
    const target = snapshot.target
    const evidenceIndex = new Map(snapshot.evidences.map((item) => [item.id, item]))
    const sourceIndex = new Map(snapshot.sources.map((item) => [item.id, item]))
    const lines = [
      "# 循证保研调查档案", "", "> 导出默认脱敏；演示数据不对应真实学校、导师或经历。", "",
      `- 学校：${target?.school || "未知"}`, `- 院系：${target?.department || "未知"}`, `- 项目：${target?.program || "未知"}`,
      `- 批次：${target?.batch || "未知"}`, `- 入学年份：${target?.enrollmentYear || "未知"}`, "", "## 结论", "",
    ]
    snapshot.claims.forEach((claim, index) => {
      const ids = JSON.parse(claim.evidenceIds) as string[]
      lines.push(`${index + 1}. **${claim.claimType} / ${claim.verification}**：${claim.content} ${ids.map((id) => `[${id.split(":").pop()}]`).join(" ")}`)
      lines.push(`   - 适用范围：${claim.scope}`)
    })
    lines.push("", "## 来源附录", "")
    snapshot.evidences.forEach((item) => {
      const source = sourceIndex.get(item.sourceId)
      lines.push(`### [${item.id.split(":").pop()}] ${source?.title || "来源缺失"}`)
      lines.push(`- 类型：${source?.sourceType || "未知"}`)
      lines.push(`- 日期：${source?.publishedAt || "未知"}`)
      lines.push(`- 位置：${item.locator}`)
      lines.push(`- 链接：${source?.visibility === "public" ? source.url || "无" : "私有来源不在公开导出中暴露地址"}`)
      lines.push(`- 摘录：${evidenceIndex.get(item.id)?.quote || "摘录缺失"}`, "")
    })
    return new Response(lines.join("\n"), { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": "attachment; filename=baoyan-evidence-profile.md" } })
  } catch { return new Response("会话无效", { status: 401 }) }
}
