import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { reviewCodeEphemerally } from "@/lib/adapters/llm"
import { assertServiceAccess, requireSession } from "@/lib/session"

export const runtime = "nodejs"

const schema = z.object({ question: z.string().min(1).max(4000), code: z.string().min(1).max(50_000), submission: z.string().max(5000).optional() })

export async function POST(request: NextRequest) {
  try {
    requireSession(request)
    assertServiceAccess(request)
    const input = schema.parse(await request.json())
    const review = await reviewCodeEphemerally(input, request.headers.get("x-deepseek-api-key") || undefined)
    return NextResponse.json({ review, persisted: false })
  } catch (error) {
    const message = error instanceof Error ? error.message : "复盘失败"
    return NextResponse.json({ error: message }, { status: message === "SESSION_REQUIRED" ? 401 : message === "ACCESS_CODE_REQUIRED" ? 403 : 400 })
  }
}
