import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { z } from "zod"
import { db, workspaceForSession } from "@/lib/db"
import { trainingRecords } from "@/lib/db/schema"
import { demoMockInterview, mockInterviewWithModel } from "@/lib/adapters/llm"
import { searchTavily } from "@/lib/adapters/tavily"
import { assertServiceAccess, isDemoMode, requireSession } from "@/lib/session"

export const runtime = "nodejs"

const bodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(12_000),
  })).min(1).max(24),
  model: z.enum(["deepseek-flash", "deepseek-v4-pro"]).optional(),
  thinkingEnabled: z.boolean().default(true),
  reasoningEffort: z.enum(["high", "max"]).default("high"),
  stage: z.enum(["foundation", "camp", "prepush"]),
  assessment: z.enum(["technical", "project", "comprehensive"]),
  codingEnabled: z.boolean(),
  durationMinutes: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
  answerLength: z.enum(["short", "medium", "long"]),
  useSearch: z.boolean(),
  selectedQuestions: z.array(z.string().min(1).max(300)).max(12),
  customPrompt: z.string().max(3000).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const sessionId = requireSession(request)
    assertServiceAccess(request)
    const workspace = workspaceForSession(sessionId)
    if (!workspace) return NextResponse.json({ error: "工作区不存在，请刷新后重试" }, { status: 404 })
    const input = bodySchema.parse(await request.json())
    let searchContext = ""
    let searchSources: { title: string; url: string }[] = []

    if (input.useSearch) {
      if (!process.env.TAVILY_API_KEY) throw new Error("联网搜索尚未配置 TAVILY_API_KEY，请关闭联网搜索后重试")
      const latest = [...input.messages].reverse().find((message) => message.role === "user")?.content || "计算机保研面试"
      const result = await searchTavily(`计算机 保研 面试 ${latest.slice(0, 180)}`, 3)
      searchSources = result.results.map(({ title, url }) => ({ title, url }))
      searchContext = result.results.map((item, index) => `[S${index + 1}] ${item.title}\n${item.content}\n${item.url}`).join("\n\n")
    }

    const modelInput = { ...input, searchContext }
    const result = isDemoMode() ? demoMockInterview(modelInput) : await mockInterviewWithModel(modelInput)
    const latestAnswer = [...input.messages].reverse().find((message) => message.role === "user")?.content || ""
    db.insert(trainingRecords).values({
      id: `tr_${nanoid(12)}`,
      workspaceId: workspace.id,
      module: "interview",
      itemId: `mock-${Date.now()}`,
      answer: latestAnswer,
      resultKind: "ai_review",
      result: "AI_REVIEW_ONLY",
      feedback: result.content,
      retestOf: null,
      createdAt: new Date().toISOString(),
    }).run()
    return NextResponse.json({ message: result.content, modelCalled: result.modelCalled, model: result.model, searchUsed: Boolean(searchContext), sources: searchSources })
  } catch (error) {
    const message = error instanceof Error ? error.message : "模拟面试请求失败"
    const status = message === "SESSION_REQUIRED" ? 401 : message === "ACCESS_CODE_REQUIRED" ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
