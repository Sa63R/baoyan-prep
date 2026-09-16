import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db, workspaceForSession } from "@/lib/db"
import { trainingRecords } from "@/lib/db/schema"
import { requireSession } from "@/lib/session"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const workspace = workspaceForSession(requireSession(request))
    if (!workspace) return NextResponse.json({ error: "工作区不存在" }, { status: 404 })
    return NextResponse.json({ records: db.select().from(trainingRecords).where(eq(trainingRecords.workspaceId, workspace.id)).all() })
  } catch { return NextResponse.json({ error: "会话无效" }, { status: 401 }) }
}
