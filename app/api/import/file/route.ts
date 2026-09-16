import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { basename, join, resolve, sep } from "node:path"
import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { extractText } from "unpdf"
import { db, workspaceForSession } from "@/lib/db"
import { attachments, sources } from "@/lib/db/schema"
import { requireSession } from "@/lib/session"

export const runtime = "nodejs"

const allowed = new Set(["application/pdf", "text/plain", "text/markdown", "text/x-markdown"])

export async function POST(request: NextRequest) {
  try {
    const workspace = workspaceForSession(requireSession(request))
    if (!workspace) return NextResponse.json({ error: "工作区不存在" }, { status: 404 })
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) throw new Error("请选择文件")
    if (file.size > 5_000_000) throw new Error("文件超过 5 MB 限制")
    if (!allowed.has(file.type) && !/\.(pdf|txt|md)$/i.test(file.name)) throw new Error("仅支持文本型 PDF、TXT 与 Markdown")
    const fileBytes = new Uint8Array(await file.arrayBuffer())
    let text = ""
    let parseStatus = "success"
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      const extracted = await extractText(new Uint8Array(fileBytes), { mergePages: true })
      text = extracted.text.trim()
      if (text.length < 80) { parseStatus = "needs_text"; text = "扫描件或图片型 PDF 无法可靠提取，请改为粘贴脱敏文字或人工确认。" }
    } else text = new TextDecoder().decode(fileBytes).trim()
    const safeName = basename(file.name).replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 120)
    const uploadRoot = resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./data/uploads")
    const workspaceDir = resolve(uploadRoot, workspace.id)
    if (!workspaceDir.startsWith(`${uploadRoot}${sep}`)) throw new Error("附件目录无效")
    await mkdir(workspaceDir, { recursive: true })
    const attachmentId = `att_${nanoid(12)}`
    const storagePath = join(workspaceDir, `${attachmentId}-${safeName}`)
    await writeFile(storagePath, fileBytes)
    db.insert(attachments).values({ id: attachmentId, workspaceId: workspace.id, filename: safeName, mimeType: file.type || "text/plain", size: file.size, storagePath, extractedText: text, parseStatus, createdAt: new Date().toISOString() }).run()
    const sourceId = `src_${nanoid(12)}`
    db.insert(sources).values({ id: sourceId, workspaceId: workspace.id, title: safeName, url: `upload://${attachmentId}`, author: "当前用户", publishedAt: null, fetchedAt: new Date().toISOString(), statedYear: null, scope: null, sourceType: "用户上传", accessStatus: parseStatus, contentRange: `提取 ${text.length} 字符`, contentHash: createHash("sha256").update(text).digest("hex"), reprintOf: null, visibility: "private", content: text }).run()
    return NextResponse.json({ status: parseStatus, attachmentId, sourceId, extractedCharacters: text.length, message: parseStatus === "needs_text" ? text : "文件已私密导入" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传失败"
    return NextResponse.json({ error: message }, { status: message === "SESSION_REQUIRED" ? 401 : 400 })
  }
}
