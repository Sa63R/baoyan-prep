import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { z } from "zod"
import { searchTavily } from "@/lib/adapters/tavily"
import { db, workspaceForSession } from "@/lib/db"
import { researchTasks } from "@/lib/db/schema"
import { assertServiceAccess, isDemoMode, requireSession } from "@/lib/session"

export const runtime = "nodejs"

const schema = z.object({ query: z.string().min(2).max(300) })

export async function POST(request: NextRequest) {
  try {
    const workspace = workspaceForSession(requireSession(request))
    if (!workspace) return NextResponse.json({ error: "工作区不存在" }, { status: 404 })
    assertServiceAccess(request)
    const { query } = schema.parse(await request.json())
    const taskId = `task_${nanoid(10)}`
    const now = new Date().toISOString()
    db.insert(researchTasks).values({ id: taskId, workspaceId: workspace.id, kind: "search", status: "discover", searchCount: 0, fetchCount: 0, detail: query, updatedAt: now }).run()
    if (isDemoMode()) {
      return NextResponse.json({ taskId, simulated: true, status: "partial", message: "演示模式未调用搜索服务", results: [
        { title: "2027 年夏令营招生说明（演示）", url: "/demo-sources/notice", content: "虚构演示来源：考核包含上机测试与综合面试。", score: 1 },
        { title: "可信学习组研究页（演示）", url: "/demo-sources/lab", content: "虚构演示来源：可解释机器学习与数据质量评估。", score: 0.9 },
      ] })
    }
    const result = await searchTavily(query, 6)
    return NextResponse.json({ taskId, simulated: false, status: "discover", ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "搜索失败"
    return NextResponse.json({ error: message }, { status: message === "SESSION_REQUIRED" ? 401 : message === "ACCESS_CODE_REQUIRED" ? 403 : 400 })
  }
}
