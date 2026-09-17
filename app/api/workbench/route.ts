import { rm } from "node:fs/promises"
import { resolve, sep } from "node:path"
import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { z } from "zod"
import { sqlite, workspaceForSession } from "@/lib/db"
import { requireSession } from "@/lib/session"
import { workbenchSnapshot, workspaceOwnsProject, workspaceOwnsTarget } from "@/lib/workbench"

export const runtime = "nodejs"

const targetInput = z.object({
  department: z.string().min(1).max(120),
  program: z.string().min(1).max(160),
  direction: z.string().max(160).optional().default(""),
  applicationYear: z.number().int().min(2024).max(2100),
  batch: z.enum(["夏令营", "预推免"]),
  mentor: z.string().max(120).optional().default(""),
  customFields: z.record(z.string(), z.string()).optional().default({}),
})

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("createProject"), school: z.string().min(2).max(120), name: z.string().max(120).optional(), target: targetInput }),
  z.object({ action: z.literal("createTarget"), projectId: z.string(), target: targetInput }),
  z.object({ action: z.literal("setProjectPinned"), projectId: z.string(), pinned: z.boolean() }),
  z.object({ action: z.literal("updateTarget"), projectId: z.string(), targetId: z.string(), target: targetInput }),
  z.object({ action: z.literal("activateTarget"), projectId: z.string(), targetId: z.string() }),
  z.object({ action: z.literal("saveFaculty"), projectId: z.string(), targetId: z.string(), kind: z.enum(["faculty", "group"]), name: z.string().min(1).max(160), homepage: z.string().max(1000).optional(), description: z.string().max(5000).optional() }),
])

function currentWorkspace(request: NextRequest) {
  const workspace = workspaceForSession(requireSession(request))
  if (!workspace) throw new Error("工作区不存在")
  return workspace
}

export async function GET(request: NextRequest) {
  try {
    const workspace = currentWorkspace(request)
    return NextResponse.json(workbenchSnapshot(workspace.id))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "读取失败" }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const workspace = currentWorkspace(request)
    const input = bodySchema.parse(await request.json())
    const timestamp = new Date().toISOString()
    if (input.action === "createProject") {
      const projectId = `proj_${nanoid(12)}`
      const targetId = `target_${nanoid(12)}`
      sqlite.transaction(() => {
        sqlite.prepare("INSERT INTO prep_projects (id, workspace_id, name, school, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(projectId, workspace.id, input.name?.trim() || input.school.trim(), input.school.trim(), timestamp, timestamp)
        sqlite.prepare("INSERT INTO application_targets (id, project_id, department, program, direction, application_year, batch, mentor, custom_fields, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)")
          .run(targetId, projectId, input.target.department, input.target.program, input.target.direction || null, input.target.applicationYear, input.target.batch, input.target.mentor || null, JSON.stringify(input.target.customFields), timestamp, timestamp)
      })()
      return NextResponse.json({ projectId, targetId, snapshot: workbenchSnapshot(workspace.id) })
    }
    if (!workspaceOwnsProject(workspace.id, input.projectId)) throw new Error("项目不存在或无权访问")
    if (input.action === "setProjectPinned") {
      sqlite.prepare("UPDATE prep_projects SET pinned_at=?, updated_at=? WHERE id=? AND workspace_id=?")
        .run(input.pinned ? timestamp : null, timestamp, input.projectId, workspace.id)
      return NextResponse.json({ snapshot: workbenchSnapshot(workspace.id) })
    }
    if (input.action === "createTarget") {
      const id = `target_${nanoid(12)}`
      sqlite.prepare("INSERT INTO application_targets (id, project_id, department, program, direction, application_year, batch, mentor, custom_fields, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)")
        .run(id, input.projectId, input.target.department, input.target.program, input.target.direction || null, input.target.applicationYear, input.target.batch, input.target.mentor || null, JSON.stringify(input.target.customFields), timestamp, timestamp)
      sqlite.prepare("UPDATE prep_projects SET updated_at=? WHERE id=?").run(timestamp, input.projectId)
      return NextResponse.json({ targetId: id, snapshot: workbenchSnapshot(workspace.id) })
    }
    if (!workspaceOwnsTarget(workspace.id, input.targetId)) throw new Error("申请目标不存在")
    if (input.action === "updateTarget") {
      sqlite.prepare("UPDATE application_targets SET department=?, program=?, direction=?, application_year=?, batch=?, mentor=?, custom_fields=?, updated_at=? WHERE id=? AND project_id=?")
        .run(input.target.department, input.target.program, input.target.direction || null, input.target.applicationYear, input.target.batch, input.target.mentor || null, JSON.stringify(input.target.customFields), timestamp, input.targetId, input.projectId)
    } else if (input.action === "activateTarget") {
      sqlite.transaction(() => {
        sqlite.prepare("UPDATE application_targets SET is_active=0 WHERE project_id=?").run(input.projectId)
        sqlite.prepare("UPDATE application_targets SET is_active=1, updated_at=? WHERE id=? AND project_id=?").run(timestamp, input.targetId, input.projectId)
      })()
    } else {
      const existing = sqlite.prepare("SELECT id FROM faculty_subjects WHERE target_id=? LIMIT 1").get(input.targetId) as { id: string } | undefined
      if (existing) sqlite.prepare("UPDATE faculty_subjects SET kind=?, name=?, homepage=?, description=?, updated_at=? WHERE id=?").run(input.kind, input.name, input.homepage || null, input.description || null, timestamp, existing.id)
      else sqlite.prepare("INSERT INTO faculty_subjects (id, project_id, target_id, kind, name, homepage, description, source_ids, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)")
        .run(`faculty_${nanoid(12)}`, input.projectId, input.targetId, input.kind, input.name, input.homepage || null, input.description || null, timestamp, timestamp)
    }
    sqlite.prepare("UPDATE prep_projects SET updated_at=? WHERE id=?").run(timestamp, input.projectId)
    return NextResponse.json({ snapshot: workbenchSnapshot(workspace.id) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const workspace = currentWorkspace(request)
    const type = request.nextUrl.searchParams.get("type")
    const id = request.nextUrl.searchParams.get("id") || ""
    if (type === "project") {
      if (!workspaceOwnsProject(workspace.id, id)) throw new Error("项目不存在")
      const paths = sqlite.prepare("SELECT local_path FROM source_assets WHERE project_id=? AND local_path IS NOT NULL").all(id) as { local_path: string }[]
      const deleted = sqlite.prepare("DELETE FROM prep_projects WHERE id=? AND workspace_id=?").run(id, workspace.id)
      if (!deleted.changes) throw new Error("项目不存在")
      await removeUploadedFiles(paths)
    } else if (type === "version") {
      const owned = sqlite.prepare("SELECT 1 FROM question_set_versions v JOIN prep_projects p ON p.id=v.project_id WHERE v.id=? AND p.workspace_id=?").get(id, workspace.id)
      if (!owned) throw new Error("题单版本不存在")
      sqlite.prepare("DELETE FROM question_set_versions WHERE id=?").run(id)
    } else if (type === "source") {
      const source = sqlite.prepare("SELECT * FROM source_assets WHERE id=? AND workspace_id=?").get(id, workspace.id) as { local_path?: string } | undefined
      if (!source) throw new Error("资料不存在")
      if (source.local_path) {
        const uploadRoot = resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./data/uploads")
        const path = resolve(source.local_path)
        if (path.startsWith(`${uploadRoot}${sep}`)) await rm(path, { force: true })
      }
      sqlite.prepare("DELETE FROM source_assets WHERE id=?").run(id)
    } else if (type === "sources") {
      const projectId = request.nextUrl.searchParams.get("projectId") || ""
      if (!workspaceOwnsProject(workspace.id, projectId)) throw new Error("项目不存在")
      const paths = sqlite.prepare("SELECT local_path FROM source_assets WHERE project_id=? AND workspace_id=? AND local_path IS NOT NULL").all(projectId, workspace.id) as { local_path: string }[]
      const uploadRoot = resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./data/uploads")
      for (const item of paths) {
        const path = resolve(item.local_path)
        if (path.startsWith(`${uploadRoot}${sep}`)) await rm(path, { force: true })
      }
      sqlite.prepare("DELETE FROM source_assets WHERE project_id=? AND workspace_id=?").run(projectId, workspace.id)
    } else throw new Error("不支持的删除类型")
    return NextResponse.json({ deleted: true, snapshot: workbenchSnapshot(workspace.id) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "删除失败" }, { status: 400 })
  }
}

async function removeUploadedFiles(paths: { local_path: string }[]) {
  const uploadRoot = resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./data/uploads")
  await Promise.allSettled(paths.map(async (item) => {
    const path = resolve(item.local_path)
    if (path.startsWith(`${uploadRoot}${sep}`)) await rm(path, { force: true })
  }))
}
