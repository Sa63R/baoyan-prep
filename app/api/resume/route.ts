import { mkdir, rm, writeFile } from "node:fs/promises"
import { basename, resolve, sep } from "node:path"
import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { extractText } from "unpdf"
import { z } from "zod"
import { sqlite, workspaceForSession } from "@/lib/db"
import { requireSession } from "@/lib/session"

export const runtime = "nodejs"

function current(request: NextRequest) {
  const workspace = workspaceForSession(requireSession(request))
  if (!workspace) throw new Error("工作区不存在")
  return workspace
}

async function removeOld(workspaceId: string) {
  const old = sqlite.prepare("SELECT local_path FROM resume_assets WHERE workspace_id=?").get(workspaceId) as { local_path?: string } | undefined
  if (old?.local_path) {
    const uploadRoot = resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./data/uploads")
    const path = resolve(old.local_path)
    if (path.startsWith(`${uploadRoot}${sep}`)) await rm(path, { force: true })
  }
  sqlite.prepare("DELETE FROM resume_assets WHERE workspace_id=?").run(workspaceId)
}

export async function POST(request: NextRequest) {
  try {
    const workspace = current(request)
    let filename: string | null = null
    let mimeType: string | null = null
    let localPath: string | null = null
    let content = ""
    if ((request.headers.get("content-type") || "").includes("multipart/form-data")) {
      const form = await request.formData()
      const file = form.get("file")
      if (!(file instanceof File)) throw new Error("请选择简历 PDF")
      if (file.size > 10_000_000) throw new Error("简历超过 10 MB")
      if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) throw new Error("简历文件仅支持 PDF，也可以改用文本粘贴")
      const bytes = new Uint8Array(await file.arrayBuffer())
      // unpdf transfers (and detaches) the supplied ArrayBuffer. Parse a copy so
      // the original bytes remain available when the PDF is persisted below.
      const extracted = await extractText(new Uint8Array(bytes), { mergePages: true })
      content = extracted.text.trim()
      if (content.length < 40) throw new Error("该 PDF 无法提取可靠文字，请改用文本粘贴")
      const uploadRoot = resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./data/uploads")
      const directory = resolve(uploadRoot, workspace.id, "resume")
      if (!directory.startsWith(`${uploadRoot}${sep}`)) throw new Error("简历目录无效")
      await mkdir(directory, { recursive: true })
      filename = basename(file.name).replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 120)
      mimeType = "application/pdf"
      localPath = resolve(directory, `${nanoid(10)}-${filename}`)
      await writeFile(localPath, bytes)
    } else {
      const input = z.object({ text: z.string().min(40).max(500_000) }).parse(await request.json())
      content = input.text.trim()
      filename = "粘贴简历.txt"
      mimeType = "text/plain"
    }
    await removeOld(workspace.id)
    sqlite.prepare("INSERT INTO resume_assets (id, workspace_id, filename, mime_type, local_path, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(`resume_${nanoid(12)}`, workspace.id, filename, mimeType, localPath, content, new Date().toISOString())
    return NextResponse.json({ saved: true, filename, characters: content.length })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "简历保存失败" }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const workspace = current(request)
    await removeOld(workspace.id)
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "简历删除失败" }, { status: 400 })
  }
}
