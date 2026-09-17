import { readFile } from "node:fs/promises"
import { basename } from "node:path"
import { NextRequest } from "next/server"
import { sqlite, workspaceForSession } from "@/lib/db"
import { requireSession } from "@/lib/session"
import { workspaceOwnsProject } from "@/lib/workbench"
import { createStoredZip } from "@/lib/zip"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const workspace = workspaceForSession(requireSession(request))
    if (!workspace) return new Response("工作区不存在", { status: 404 })
    const projectId = request.nextUrl.searchParams.get("projectId") || ""
    if (!workspaceOwnsProject(workspace.id, projectId)) return new Response("项目不存在", { status: 404 })
    const project = sqlite.prepare("SELECT name FROM prep_projects WHERE id=?").get(projectId) as { name: string }
    const sources = sqlite.prepare("SELECT * FROM source_assets WHERE project_id=? ORDER BY created_at").all(projectId) as { id: string; title: string; url?: string; local_path?: string; content: string; source_type: string; status: string }[]
    const files: { name: string; data: Uint8Array }[] = []
    const manifest = ["标题\t类型\t状态\t原链接"]
    for (const [index, source] of sources.entries()) {
      manifest.push(`${source.title.replace(/\t/g, " ")}\t${source.source_type}\t${source.status}\t${source.url || ""}`)
      if (source.local_path) files.push({ name: `files/${String(index + 1).padStart(2, "0")}-${basename(source.title)}`, data: await readFile(source.local_path) })
      else files.push({ name: `text/${String(index + 1).padStart(2, "0")}-${source.title.replace(/[\\/:*?"<>|]/g, "_")}.txt`, data: Buffer.from(source.content, "utf8") })
    }
    files.unshift({ name: "来源清单.tsv", data: Buffer.from(manifest.join("\n"), "utf8") })
    const zip = createStoredZip(files)
    return new Response(zip, { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${project.name}-资料库.zip`)}` } })
  } catch (error) { return new Response(error instanceof Error ? error.message : "导出失败", { status: 400 }) }
}
