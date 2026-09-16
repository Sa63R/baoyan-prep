import "server-only"
import { createHash } from "node:crypto"
import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { demoClaims, demoEvidences, demoSources } from "@/lib/demo-data"
import * as schema from "@/lib/db/schema"

const configuredPath = process.env.DATABASE_URL || "./data/baoyan-prep.db"
const databasePath = resolve(configuredPath.replace(/^file:/, ""))
mkdirSync(dirname(databasePath), { recursive: true })

export const sqlite = new Database(databasePath)
sqlite.pragma("journal_mode = WAL")
sqlite.pragma("foreign_keys = ON")
sqlite.exec(`
CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, session_id TEXT NOT NULL UNIQUE, mode TEXT NOT NULL DEFAULT 'demo', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS targets (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, school TEXT, department TEXT, program TEXT, degree_type TEXT, batch TEXT, assessment_year INTEGER, enrollment_year INTEGER, mentor_name TEXT, mentor_homepage TEXT);
CREATE INDEX IF NOT EXISTS targets_workspace_idx ON targets(workspace_id);
CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, title TEXT NOT NULL, url TEXT, author TEXT, published_at TEXT, fetched_at TEXT NOT NULL, stated_year TEXT, scope TEXT, source_type TEXT NOT NULL, access_status TEXT NOT NULL, content_range TEXT, content_hash TEXT NOT NULL, reprint_of TEXT, visibility TEXT NOT NULL DEFAULT 'private', content TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS sources_workspace_idx ON sources(workspace_id); CREATE INDEX IF NOT EXISTS sources_hash_idx ON sources(workspace_id, content_hash);
CREATE TABLE IF NOT EXISTS evidences (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE, quote TEXT NOT NULL, locator TEXT NOT NULL, located INTEGER NOT NULL, search_snippet_only INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS evidences_workspace_idx ON evidences(workspace_id);
CREATE TABLE IF NOT EXISTS claims (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, content TEXT NOT NULL, claim_type TEXT NOT NULL, evidence_ids TEXT NOT NULL, scope TEXT NOT NULL, verification TEXT NOT NULL, conflict_ids TEXT NOT NULL DEFAULT '[]');
CREATE INDEX IF NOT EXISTS claims_workspace_idx ON claims(workspace_id);
CREATE TABLE IF NOT EXISTS research_tasks (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, kind TEXT NOT NULL, status TEXT NOT NULL, search_count INTEGER NOT NULL DEFAULT 0, fetch_count INTEGER NOT NULL DEFAULT 0, detail TEXT, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS tasks_workspace_idx ON research_tasks(workspace_id);
CREATE TABLE IF NOT EXISTS training_records (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, module TEXT NOT NULL, item_id TEXT NOT NULL, answer TEXT NOT NULL, result_kind TEXT NOT NULL, result TEXT NOT NULL, feedback TEXT NOT NULL, retest_of TEXT, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS records_workspace_idx ON training_records(workspace_id);
CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, filename TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, storage_path TEXT NOT NULL, extracted_text TEXT NOT NULL, parse_status TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS attachments_workspace_idx ON attachments(workspace_id);
`)
sqlite.prepare("UPDATE research_tasks SET status = 'interrupted', updated_at = ? WHERE status IN ('plan','discover','fetch','extract','verify','synthesize')").run(new Date().toISOString())

export const db = drizzle(sqlite, { schema })

const hash = (content: string) => createHash("sha256").update(content).digest("hex")

export function ensureWorkspace(sessionId: string) {
  const current = db.select().from(schema.workspaces).where(eq(schema.workspaces.sessionId, sessionId)).get()
  if (current) return current
  const now = new Date().toISOString()
  const workspace = { id: `ws_${nanoid(12)}`, sessionId, mode: (process.env.DEMO_MODE === "false" ? "real" : "demo") as "demo" | "real", createdAt: now }
  db.transaction((tx) => {
    tx.insert(schema.workspaces).values(workspace).run()
    tx.insert(schema.targets).values({
      id: `${workspace.id}:target`, workspaceId: workspace.id, school: "虚构理工大学", department: "计算机学院",
      program: "智能科学与技术", degreeType: "学硕", batch: "夏令营", assessmentYear: 2026, enrollmentYear: 2027,
      mentorName: "鲁言教授（虚构）", mentorHomepage: "/demo-sources/lab",
    }).run()
    for (const source of demoSources) {
      tx.insert(schema.sources).values({
        id: `${workspace.id}:${source.suffix}`, workspaceId: workspace.id, title: source.title, url: source.url, author: source.author,
        publishedAt: source.publishedAt, fetchedAt: now, statedYear: source.statedYear, scope: source.scope, sourceType: source.sourceType,
        accessStatus: source.accessStatus, contentRange: source.contentRange, contentHash: hash(source.content), visibility: "private", content: source.content,
      }).run()
    }
    for (const item of demoEvidences) tx.insert(schema.evidences).values({
      id: `${workspace.id}:${item.suffix}`, workspaceId: workspace.id, sourceId: `${workspace.id}:${item.sourceSuffix}`,
      quote: item.quote, locator: item.locator, located: item.located, searchSnippetOnly: false,
    }).run()
    for (const item of demoClaims) tx.insert(schema.claims).values({
      id: `${workspace.id}:${item.suffix}`, workspaceId: workspace.id, content: item.content, claimType: item.claimType,
      evidenceIds: JSON.stringify(item.evidenceSuffixes.map((id) => `${workspace.id}:${id}`)), scope: item.scope,
      verification: item.verification, conflictIds: JSON.stringify(item.conflictSuffixes),
    }).run()
  })
  return workspace
}

export function workspaceForSession(sessionId: string) {
  return db.select().from(schema.workspaces).where(eq(schema.workspaces.sessionId, sessionId)).get()
}

export function workspaceSnapshot(workspaceId: string) {
  return {
    target: db.select().from(schema.targets).where(eq(schema.targets.workspaceId, workspaceId)).get(),
    sources: db.select().from(schema.sources).where(eq(schema.sources.workspaceId, workspaceId)).all(),
    evidences: db.select().from(schema.evidences).where(eq(schema.evidences.workspaceId, workspaceId)).all(),
    claims: db.select().from(schema.claims).where(eq(schema.claims.workspaceId, workspaceId)).all(),
    records: db.select().from(schema.trainingRecords).where(eq(schema.trainingRecords.workspaceId, workspaceId)).all(),
  }
}
