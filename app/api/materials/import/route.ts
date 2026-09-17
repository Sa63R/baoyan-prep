import { mkdir, writeFile } from "node:fs/promises"
import { basename, resolve, sep } from "node:path"
import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { extractText } from "unpdf"
import { z } from "zod"
import { extractImageTextWithModel } from "@/lib/adapters/llm"
import { workspaceForSession } from "@/lib/db"
import { requireSession } from "@/lib/session"
import { safeFetchText } from "@/lib/security/url"
import { insertSourceAsset, workspaceOwnsProject, workspaceOwnsTarget } from "@/lib/workbench"

export const runtime = "nodejs"
export const maxDuration = 90

const jsonSchema = z.object({
  projectId: z.string(), targetId: z.string().optional(), mode: z.enum(["url", "text"]),
  title: z.string().max(300).optional(), url: z.string().max(2000).optional(), text: z.string().max(500_000).optional(),
})

function workspace(request: NextRequest) {
  const value = workspaceForSession(requireSession(request))
  if (!value) throw new Error("工作区不存在")
  return value
}

export async function POST(request: NextRequest) {
  try {
    const current = workspace(request)
    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData()
      const file = form.get("file")
      const projectId = String(form.get("projectId") || "")
      const targetId = String(form.get("targetId") || "")
      if (!(file instanceof File)) throw new Error("请选择文件")
      if (!workspaceOwnsProject(current.id, projectId)) throw new Error("项目不存在")
      if (targetId && !workspaceOwnsTarget(current.id, targetId)) throw new Error("目标不存在")
      if (file.size > 10_000_000) throw new Error("文件超过 10 MB 限制")
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name)
      const isText = /^(text\/plain|text\/markdown)$/.test(file.type) || /\.(txt|md)$/i.test(file.name)
      const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name)
      if (!isPdf && !isText && !isImage) throw new Error("仅支持 PDF、TXT、Markdown、PNG、JPG 与 WebP")
      const bytes = new Uint8Array(await file.arrayBuffer())
      let text = ""
      let status = "ready"
      if (isPdf) {
        const extracted = await extractText(bytes, { mergePages: true })
        text = extracted.text.trim()
        if (text.length < 40) { status = "needs_text"; text = "扫描型 PDF 暂未提取到可靠文字，请同时上传截图或粘贴正文。" }
      } else if (isImage) {
        text = await extractImageTextWithModel(bytes, file.type || "image/png", request.headers.get("x-deepseek-api-key") || undefined)
      } else text = new TextDecoder().decode(bytes).trim()
      if (!text) throw new Error("文件中没有可提取文字")
      const uploadRoot = resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./data/uploads")
      const projectDir = resolve(uploadRoot, current.id, projectId)
      if (!projectDir.startsWith(`${uploadRoot}${sep}`)) throw new Error("附件目录无效")
      await mkdir(projectDir, { recursive: true })
      const safeName = basename(file.name).replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 120)
      const localPath = resolve(projectDir, `${nanoid(10)}-${safeName}`)
      await writeFile(localPath, bytes)
      const saved = insertSourceAsset({ workspaceId: current.id, projectId, origin: "user", title: safeName, mimeType: file.type || "application/octet-stream", localPath, content: text, status, confidence: "high", sourceType: isImage ? "用户图片" : isPdf ? "用户 PDF" : "用户文本", targetIds: targetId ? [targetId] : [] })
      return NextResponse.json({ status: saved.duplicate ? "duplicate" : status, source: saved.source })
    }

    const input = jsonSchema.parse(await request.json())
    if (!workspaceOwnsProject(current.id, input.projectId)) throw new Error("项目不存在")
    if (input.targetId && !workspaceOwnsTarget(current.id, input.targetId)) throw new Error("目标不存在")
    if (input.mode === "text") {
      if (!input.text || input.text.trim().length < 20) throw new Error("请至少粘贴 20 个字符")
      const saved = insertSourceAsset({ workspaceId: current.id, projectId: input.projectId, origin: "user", title: input.title?.trim() || "用户粘贴资料", mimeType: "text/plain", content: input.text.trim(), confidence: "high", sourceType: "用户粘贴", targetIds: input.targetId ? [input.targetId] : [] })
      return NextResponse.json({ status: saved.duplicate ? "duplicate" : "ready", source: saved.source })
    }
    if (!input.url) throw new Error("请输入公开 URL")
    const fetched = await safeFetchText(input.url)
    if (fetched.text.trim().length < 40) throw new Error("页面可读取正文过少")
    const saved = insertSourceAsset({ workspaceId: current.id, projectId: input.projectId, origin: "user", title: input.title?.trim() || new URL(fetched.finalUrl).hostname, url: fetched.finalUrl, mimeType: "text/html", content: fetched.text.slice(0, 500_000), confidence: "medium", sourceType: "用户链接", targetIds: input.targetId ? [input.targetId] : [] })
    return NextResponse.json({ status: saved.duplicate ? "duplicate" : "ready", source: saved.source })
  } catch (error) {
    const message = error instanceof Error ? error.message : "导入失败"
    return NextResponse.json({ error: message }, { status: message === "SESSION_REQUIRED" ? 401 : 400 })
  }
}
