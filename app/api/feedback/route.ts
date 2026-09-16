import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { z } from "zod"
import { db, workspaceForSession } from "@/lib/db"
import { trainingRecords } from "@/lib/db/schema"
import { demoReview, reviewWithModel } from "@/lib/adapters/llm"
import { assertServiceAccess, isDemoMode, requireSession } from "@/lib/session"
import { safeTrainingResult } from "@/lib/validation"

export const runtime = "nodejs"

const bodySchema = z.object({
  module: z.enum(["coding", "interview", "project"]),
  itemId: z.string().min(1).max(100),
  question: z.string().min(1).max(4000),
  answer: z.string().min(1).max(40_000),
  evidenceIds: z.array(z.string().max(100)).max(20).default([]),
  resultKind: z.enum(["self_reported", "ai_review"]).default("ai_review"),
  result: z.string().max(100).default("AI_REVIEW_ONLY"),
  retestOf: z.string().max(100).nullable().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const sessionId = requireSession(request)
    assertServiceAccess(request)
    const workspace = workspaceForSession(sessionId)
    if (!workspace) return NextResponse.json({ error: "工作区不存在，请刷新后重试" }, { status: 404 })
    const input = bodySchema.parse(await request.json())
    const reviewInput = { module: input.module, answer: input.answer, evidenceIds: input.evidenceIds, question: input.question }
    const review = isDemoMode() ? demoReview(reviewInput) : await reviewWithModel(reviewInput)
    const record = {
      id: `tr_${nanoid(12)}`, workspaceId: workspace.id, module: input.module, itemId: input.itemId, answer: input.answer,
      resultKind: input.resultKind, result: safeTrainingResult(input.resultKind, input.result), feedback: review.content,
      retestOf: input.retestOf || null, createdAt: new Date().toISOString(),
    }
    db.insert(trainingRecords).values(record).run()
    return NextResponse.json({ record, feedback: review.content, modelCalled: review.modelCalled, model: review.model })
  } catch (error) {
    const message = error instanceof Error ? error.message : "反馈生成失败"
    const status = message === "SESSION_REQUIRED" ? 401 : message === "ACCESS_CODE_REQUIRED" ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
