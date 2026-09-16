import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { z } from "zod"
import { db, workspaceForSession } from "@/lib/db"
import { sources } from "@/lib/db/schema"
import { requireSession } from "@/lib/session"

export const runtime = "nodejs"

const schema = z.object({ title: z.string().min(1).max(300), text: z.string().min(20).max(500_000), kind: z.enum(["用户粘贴", "亲历经验"]).default("用户粘贴") })

export async function POST(request: NextRequest) {
  try {
    const workspace = workspaceForSession(requireSession(request))
    if (!workspace) return NextResponse.json({ error: "工作区不存在" }, { status: 404 })
    const input = schema.parse(await request.json())
    const source = {
      id: `src_${nanoid(12)}`, workspaceId: workspace.id, title: input.title, url: null, author: "当前用户", publishedAt: null,
      fetchedAt: new Date().toISOString(), statedYear: null, scope: null, sourceType: input.kind, accessStatus: "success",
      contentRange: `粘贴文本 ${input.text.length} 字符`, contentHash: createHash("sha256").update(input.text).digest("hex"),
      reprintOf: null, visibility: "private" as const, content: input.text,
    }
    db.insert(sources).values(source).run()
    return NextResponse.json({ status: "success", source })
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存失败"
    return NextResponse.json({ error: message }, { status: message === "SESSION_REQUIRED" ? 401 : 400 })
  }
}
