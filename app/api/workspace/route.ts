import { rm } from "node:fs/promises"
import { resolve, sep } from "node:path"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db, workspaceForSession } from "@/lib/db"
import { workspaces } from "@/lib/db/schema"
import { requireSession, SESSION_COOKIE } from "@/lib/session"

export const runtime = "nodejs"

export async function DELETE(request: NextRequest) {
  try {
    const workspace = workspaceForSession(requireSession(request))
    if (!workspace) return NextResponse.json({ error: "工作区不存在" }, { status: 404 })
    const uploadRoot = resolve(process.env.UPLOAD_DIR || "./data/uploads")
    const target = resolve(uploadRoot, workspace.id)
    if (!target.startsWith(`${uploadRoot}${sep}`)) throw new Error("删除路径校验失败")
    await rm(target, { recursive: true, force: true })
    db.delete(workspaces).where(eq(workspaces.id, workspace.id)).run()
    const response = NextResponse.json({ deleted: true })
    response.cookies.delete(SESSION_COOKIE)
    return response
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "删除失败" }, { status: 400 })
  }
}
