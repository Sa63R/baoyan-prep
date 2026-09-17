import "server-only"

import { createHash } from "node:crypto"
import { nanoid } from "nanoid"
import { sqlite } from "@/lib/db"
import { normalizeSourceUrl, type SourceAssessment } from "@/lib/source-strategy"

export type WorkbenchModule = "coding" | "interview" | "project"
export type SourceOrigin = "automatic" | "user"

export type PrepProject = {
  id: string
  workspaceId: string
  name: string
  school: string
  createdAt: string
  updatedAt: string
}

export type ApplicationTarget = {
  id: string
  projectId: string
  department: string
  program: string
  direction: string | null
  applicationYear: number
  batch: "夏令营" | "预推免"
  mentor: string | null
  customFields: Record<string, string>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type SourceAsset = {
  id: string
  workspaceId: string
  projectId: string
  origin: SourceOrigin
  title: string
  url: string | null
  mimeType: string | null
  localPath: string | null
  content: string
  contentHash: string
  status: string
  confidence: "high" | "medium" | "low"
  sourceType: string
  publishedAt: string | null
  fetchedAt: string
  createdAt: string
  targetIds: string[]
}

type RawRow = Record<string, unknown>

const now = () => new Date().toISOString()
export const contentHash = (content: string) => createHash("sha256").update(content).digest("hex")

function projectFrom(row: RawRow): PrepProject {
  return {
    id: String(row.id), workspaceId: String(row.workspace_id), name: String(row.name), school: String(row.school),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }
}

function targetFrom(row: RawRow): ApplicationTarget {
  let customFields: Record<string, string> = {}
  try { customFields = JSON.parse(String(row.custom_fields || "{}")) as Record<string, string> } catch { /* ignore malformed legacy value */ }
  return {
    id: String(row.id), projectId: String(row.project_id), department: String(row.department), program: String(row.program),
    direction: row.direction ? String(row.direction) : null, applicationYear: Number(row.application_year), batch: String(row.batch) as ApplicationTarget["batch"],
    mentor: row.mentor ? String(row.mentor) : null, customFields, isActive: Boolean(row.is_active), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }
}

function sourceFrom(row: RawRow, targetIds: string[] = []): SourceAsset {
  return {
    id: String(row.id), workspaceId: String(row.workspace_id), projectId: String(row.project_id), origin: String(row.origin) as SourceOrigin,
    title: String(row.title), url: row.url ? String(row.url) : null, mimeType: row.mime_type ? String(row.mime_type) : null,
    localPath: row.local_path ? String(row.local_path) : null, content: String(row.content), contentHash: String(row.content_hash),
    status: String(row.status), confidence: String(row.confidence) as SourceAsset["confidence"], sourceType: String(row.source_type),
    publishedAt: row.published_at ? String(row.published_at) : null, fetchedAt: String(row.fetched_at), createdAt: String(row.created_at), targetIds,
  }
}

function sourceAssessmentFrom(row: RawRow): SourceAssessment & { sourceId: string; targetId: string } {
  return {
    sourceId: String(row.source_id),
    targetId: String(row.target_id),
    verdict: String(row.verdict) as SourceAssessment["verdict"],
    qualityScore: Number(row.quality_score),
    targetMatch: Number(row.target_match),
    evidenceLevel: String(row.evidence_level) as SourceAssessment["evidenceLevel"],
    contentType: String(row.content_type),
    usableFor: safeJsonArray(row.usable_for) as SourceAssessment["usableFor"],
    relevantPassages: safeJsonArray(row.relevant_passages),
    reviewReason: String(row.review_reason),
    modelReviewed: Boolean(row.model_reviewed),
  }
}

export function ensureDefaultPrepProject(workspaceId: string) {
  const existing = sqlite.prepare("SELECT * FROM prep_projects WHERE workspace_id = ? ORDER BY created_at LIMIT 1").get(workspaceId) as RawRow | undefined
  if (existing) return projectFrom(existing)
  const legacy = sqlite.prepare("SELECT * FROM targets WHERE workspace_id = ? LIMIT 1").get(workspaceId) as RawRow | undefined
  if (!legacy || String(legacy.school || "") === "虚构理工大学") return null
  const timestamp = now()
  const projectId = `proj_${nanoid(12)}`
  const targetId = `target_${nanoid(12)}`
  const school = String(legacy.school)
  sqlite.transaction(() => {
    sqlite.prepare("INSERT INTO prep_projects (id, workspace_id, name, school, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(projectId, workspaceId, school, school, timestamp, timestamp)
    sqlite.prepare("INSERT INTO application_targets (id, project_id, department, program, direction, application_year, batch, mentor, custom_fields, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', 1, ?, ?)")
      .run(targetId, projectId, String(legacy.department || ""), String(legacy.program || ""), null, Number(legacy.enrollment_year || new Date().getFullYear() + 1), String(legacy.batch || "夏令营") === "预推免" ? "预推免" : "夏令营", legacy.mentor_name ? String(legacy.mentor_name) : null, timestamp, timestamp)
    const legacySources = sqlite.prepare("SELECT * FROM sources WHERE workspace_id = ?").all(workspaceId) as RawRow[]
    const insert = sqlite.prepare("INSERT OR IGNORE INTO source_assets (id, workspace_id, project_id, origin, title, url, mime_type, local_path, content, content_hash, status, confidence, source_type, published_at, fetched_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    for (const source of legacySources) {
      insert.run(`asset_${nanoid(12)}`, workspaceId, projectId, String(source.source_type || "").includes("用户") ? "user" : "automatic", String(source.title), source.url || null, "text/html", null, String(source.content), String(source.content_hash), String(source.access_status || "ready"), "medium", String(source.source_type || "历史资料"), source.published_at || null, String(source.fetched_at || timestamp), timestamp)
    }
  })()
  return projectFrom(sqlite.prepare("SELECT * FROM prep_projects WHERE id = ?").get(projectId) as RawRow)
}

export function workspaceOwnsProject(workspaceId: string, projectId: string) {
  return Boolean(sqlite.prepare("SELECT 1 FROM prep_projects WHERE id = ? AND workspace_id = ?").get(projectId, workspaceId))
}

export function workspaceOwnsTarget(workspaceId: string, targetId: string) {
  return Boolean(sqlite.prepare("SELECT 1 FROM application_targets t JOIN prep_projects p ON p.id = t.project_id WHERE t.id = ? AND p.workspace_id = ?").get(targetId, workspaceId))
}

export function workbenchSnapshot(workspaceId: string) {
  ensureDefaultPrepProject(workspaceId)
  const projects = (sqlite.prepare("SELECT * FROM prep_projects WHERE workspace_id = ? ORDER BY updated_at DESC").all(workspaceId) as RawRow[]).map(projectFrom)
  const targets = (sqlite.prepare("SELECT t.* FROM application_targets t JOIN prep_projects p ON p.id=t.project_id WHERE p.workspace_id=? ORDER BY t.created_at").all(workspaceId) as RawRow[]).map(targetFrom)
  const linkRows = sqlite.prepare("SELECT l.source_id, l.target_id FROM source_target_links l JOIN source_assets s ON s.id=l.source_id WHERE s.workspace_id=?").all(workspaceId) as RawRow[]
  const targetMap = new Map<string, string[]>()
  for (const row of linkRows) targetMap.set(String(row.source_id), [...(targetMap.get(String(row.source_id)) || []), String(row.target_id)])
  const sources = (sqlite.prepare("SELECT * FROM source_assets WHERE workspace_id = ? ORDER BY created_at DESC").all(workspaceId) as RawRow[]).map((row) => sourceFrom(row, targetMap.get(String(row.id)) || []))
  const runs = sqlite.prepare("SELECT * FROM research_runs WHERE project_id IN (SELECT id FROM prep_projects WHERE workspace_id=?) ORDER BY created_at DESC LIMIT 30").all(workspaceId) as RawRow[]
  const versions = sqlite.prepare("SELECT * FROM question_set_versions WHERE project_id IN (SELECT id FROM prep_projects WHERE workspace_id=?) ORDER BY created_at DESC").all(workspaceId) as RawRow[]
  const versionIds = versions.map((item) => String(item.id))
  const items = versionIds.length
    ? sqlite.prepare(`SELECT * FROM question_items WHERE version_id IN (${versionIds.map(() => "?").join(",")}) ORDER BY position`).all(...versionIds) as RawRow[]
    : []
  const resume = sqlite.prepare("SELECT id, workspace_id, filename, mime_type, content, created_at FROM resume_assets WHERE workspace_id=?").get(workspaceId) as RawRow | undefined
  const faculty = sqlite.prepare("SELECT f.* FROM faculty_subjects f JOIN prep_projects p ON p.id=f.project_id WHERE p.workspace_id=? ORDER BY f.updated_at DESC").all(workspaceId) as RawRow[]
  return {
    projects,
    targets,
    sources,
    runs: runs.map((row) => ({ id: String(row.id), projectId: String(row.project_id), targetId: row.target_id ? String(row.target_id) : null, depth: String(row.depth), status: String(row.status), query: String(row.query), sourceCount: Number(row.source_count), detail: row.detail ? String(row.detail) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at) })),
    versions: versions.map((row) => ({
      id: String(row.id), projectId: String(row.project_id), targetId: String(row.target_id), module: String(row.module), title: String(row.title), createdAt: String(row.created_at),
      sourceSnapshot: safeJsonArray(row.source_snapshot),
      items: items.filter((item) => item.version_id === row.id).map((item) => ({ id: String(item.id), position: Number(item.position), theme: String(item.theme), question: String(item.question), summary: item.summary ? String(item.summary) : null, url: item.url ? String(item.url) : null, kind: String(item.kind), tags: safeJsonArray(item.tags), evidenceIds: safeJsonArray(item.evidence_ids), metadata: safeJsonObject(item.metadata) })),
    })),
    resume: resume ? { id: String(resume.id), filename: resume.filename ? String(resume.filename) : null, mimeType: resume.mime_type ? String(resume.mime_type) : null, content: String(resume.content), createdAt: String(resume.created_at) } : null,
    faculty: faculty.map((row) => ({ id: String(row.id), projectId: String(row.project_id), targetId: String(row.target_id), kind: String(row.kind), name: String(row.name), homepage: row.homepage ? String(row.homepage) : null, description: row.description ? String(row.description) : null, sourceIds: safeJsonArray(row.source_ids), createdAt: String(row.created_at), updatedAt: String(row.updated_at) })),
  }
}

function safeJsonArray(value: unknown): string[] {
  try { const parsed = JSON.parse(String(value || "[]")); return Array.isArray(parsed) ? parsed.map(String) : [] } catch { return [] }
}

function safeJsonObject(value: unknown): Record<string, unknown> {
  try { const parsed = JSON.parse(String(value || "{}")); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {} } catch { return {} }
}

export function insertSourceAsset(input: {
  workspaceId: string; projectId: string; origin: SourceOrigin; title: string; url?: string | null; mimeType?: string | null;
  localPath?: string | null; content: string; status?: string; confidence?: SourceAsset["confidence"]; sourceType?: string;
  publishedAt?: string | null; targetIds?: string[];
}) {
  if (!workspaceOwnsProject(input.workspaceId, input.projectId)) throw new Error("项目不存在或无权访问")
  const digest = contentHash(input.content)
  const byHash = sqlite.prepare("SELECT * FROM source_assets WHERE project_id=? AND content_hash=? LIMIT 1").get(input.projectId, digest) as RawRow | undefined
  const normalizedUrl = input.url ? normalizeSourceUrl(input.url) : null
  const byUrl = normalizedUrl
    ? (sqlite.prepare("SELECT * FROM source_assets WHERE project_id=? AND url IS NOT NULL").all(input.projectId) as RawRow[]).find((row) => normalizeSourceUrl(String(row.url)) === normalizedUrl)
    : undefined
  const duplicate = byHash || byUrl
  if (duplicate) {
    const duplicateId = String(duplicate.id)
    if (String(duplicate.origin) === "automatic" && input.origin === "automatic" && input.content.length >= String(duplicate.content || "").length) {
      sqlite.prepare("UPDATE source_assets SET title=?, url=?, mime_type=?, content=?, content_hash=?, status=?, confidence=?, source_type=?, published_at=?, fetched_at=? WHERE id=?")
        .run(input.title, normalizedUrl, input.mimeType || duplicate.mime_type || null, input.content, digest, input.status || "ready", input.confidence || "medium", input.sourceType || "网络资料", input.publishedAt || duplicate.published_at || null, now(), duplicateId)
    }
    const link = sqlite.prepare("INSERT OR IGNORE INTO source_target_links (source_id, target_id) VALUES (?, ?)")
    for (const targetId of input.targetIds || []) if (workspaceOwnsTarget(input.workspaceId, targetId)) link.run(duplicateId, targetId)
    const refreshed = sqlite.prepare("SELECT * FROM source_assets WHERE id=?").get(duplicateId) as RawRow
    return { source: sourceFrom(refreshed, input.targetIds || []), duplicate: true }
  }
  const timestamp = now()
  const id = `asset_${nanoid(12)}`
  sqlite.transaction(() => {
    sqlite.prepare("INSERT INTO source_assets (id, workspace_id, project_id, origin, title, url, mime_type, local_path, content, content_hash, status, confidence, source_type, published_at, fetched_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, input.workspaceId, input.projectId, input.origin, input.title, normalizedUrl, input.mimeType || null, input.localPath || null, input.content, digest, input.status || "ready", input.confidence || "medium", input.sourceType || (input.origin === "user" ? "用户资料" : "网络资料"), input.publishedAt || null, timestamp, timestamp)
    const link = sqlite.prepare("INSERT OR IGNORE INTO source_target_links (source_id, target_id) VALUES (?, ?)")
    for (const targetId of input.targetIds || []) if (workspaceOwnsTarget(input.workspaceId, targetId)) link.run(id, targetId)
  })()
  return { source: sourceFrom(sqlite.prepare("SELECT * FROM source_assets WHERE id=?").get(id) as RawRow, input.targetIds || []), duplicate: false }
}

export function upsertSourceAssessment(sourceId: string, targetId: string, assessment: SourceAssessment) {
  sqlite.prepare(`INSERT INTO source_assessments (source_id, target_id, verdict, quality_score, target_match, evidence_level, content_type, usable_for, relevant_passages, review_reason, model_reviewed, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_id, target_id) DO UPDATE SET verdict=excluded.verdict, quality_score=excluded.quality_score, target_match=excluded.target_match, evidence_level=excluded.evidence_level, content_type=excluded.content_type, usable_for=excluded.usable_for, relevant_passages=excluded.relevant_passages, review_reason=excluded.review_reason, model_reviewed=excluded.model_reviewed, updated_at=excluded.updated_at`)
    .run(sourceId, targetId, assessment.verdict, assessment.qualityScore, assessment.targetMatch, assessment.evidenceLevel, assessment.contentType, JSON.stringify(assessment.usableFor), JSON.stringify(assessment.relevantPassages), assessment.reviewReason, assessment.modelReviewed ? 1 : 0, now())
}

export function projectContext(workspaceId: string, projectId: string, targetId: string) {
  if (!workspaceOwnsProject(workspaceId, projectId) || !workspaceOwnsTarget(workspaceId, targetId)) throw new Error("项目或目标不存在")
  const project = projectFrom(sqlite.prepare("SELECT * FROM prep_projects WHERE id=?").get(projectId) as RawRow)
  const target = targetFrom(sqlite.prepare("SELECT * FROM application_targets WHERE id=? AND project_id=?").get(targetId, projectId) as RawRow)
  const sourceRows = sqlite.prepare("SELECT DISTINCT s.* FROM source_assets s LEFT JOIN source_target_links l ON l.source_id=s.id WHERE s.project_id=? AND (l.target_id IS NULL OR l.target_id=?) ORDER BY CASE WHEN s.origin='user' THEN 0 ELSE 1 END, s.created_at DESC LIMIT 160").all(projectId, targetId) as RawRow[]
  const sources = sourceRows.map((row) => sourceFrom(row))
  const assessments = (sqlite.prepare("SELECT * FROM source_assessments WHERE target_id=?").all(targetId) as RawRow[]).map(sourceAssessmentFrom)
  const resume = sqlite.prepare("SELECT * FROM resume_assets WHERE workspace_id=?").get(workspaceId) as RawRow | undefined
  const faculty = sqlite.prepare("SELECT * FROM faculty_subjects WHERE target_id=? ORDER BY updated_at DESC LIMIT 1").get(targetId) as RawRow | undefined
  return { project, target, sources, assessments, resume, faculty }
}
