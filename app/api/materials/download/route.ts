import { readFile } from "node:fs/promises"
import { NextRequest } from "next/server"
import { sqlite, workspaceForSession } from "@/lib/db"
import { requireSession } from "@/lib/session"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const workspace = workspaceForSession(requireSession(request))
    if (!workspace) return new Response("工作区不存在", { status: 404 })
    const id = request.nextUrl.searchParams.get("id") || ""
    const source = sqlite.prepare("SELECT * FROM source_assets WHERE id=? AND workspace_id=?").get(id, workspace.id) as { title: string; mime_type?: string; local_path?: string; content: string } | undefined
    if (!source) return new Response("资料不存在", { status: 404 })
    const data = source.local_path ? await readFile(source.local_path) : Buffer.from(source.content, "utf8")
    const rawName = source.local_path ? source.title : `${source.title}.txt`
    const safeName = rawName.replace(/["\r\n]/g, "_")
    return new Response(data, { headers: { "content-type": source.local_path ? source.mime_type || "application/octet-stream" : "text/plain; charset=utf-8", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}` } })
  } catch { return new Response("会话无效", { status: 401 }) }
}
