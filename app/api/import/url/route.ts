import { createHash } from "node:crypto"
import { eq, and } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { z } from "zod"
import { db, workspaceForSession } from "@/lib/db"
import { sources } from "@/lib/db/schema"
import { requireSession } from "@/lib/session"
import { safeFetchText } from "@/lib/security/url"

export const runtime = "nodejs"

const schema = z.object({ url: z.string().min(8).max(2000), title: z.string().max(300).optional() })

export async function POST(request: NextRequest) {
  try {
    const workspace = workspaceForSession(requireSession(request))
    if (!workspace) return NextResponse.json({ error: "工作区不存在" }, { status: 404 })
    const input = schema.parse(await request.json())
    const result = await safeFetchText(input.url)
    const content = result.text.slice(0, 500_000)
    if (content.length < 40) throw new Error("页面可提取正文过少，已标记失败")
    const contentHash = createHash("sha256").update(content).digest("hex")
    const duplicate = db.select().from(sources).where(and(eq(sources.workspaceId, workspace.id), eq(sources.contentHash, contentHash))).get()
    if (duplicate) return NextResponse.json({ status: "duplicate", source: duplicate, message: "内容与现有来源相同，未作为独立经历重复计数" })
    const source = {
      id: `src_${nanoid(12)}`, workspaceId: workspace.id, title: input.title || new URL(result.finalUrl).hostname, url: result.finalUrl,
      author: null, publishedAt: null, fetchedAt: new Date().toISOString(), statedYear: null, scope: null, sourceType: "官网",
      accessStatus: content.length < 300 ? "partial" : "success", contentRange: `已提取 ${content.length} 字符`, contentHash,
      reprintOf: null, visibility: "private" as const, content,
    }
    db.insert(sources).values(source).run()
    return NextResponse.json({ status: source.accessStatus, source })
  } catch (error) {
    const message = error instanceof Error ? error.message : "导入失败"
    return NextResponse.json({ error: message }, { status: message === "SESSION_REQUIRED" ? 401 : 400 })
  }
}
