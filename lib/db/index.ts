import "server-only"
import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"
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
CREATE TABLE IF NOT EXISTS prep_projects (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, name TEXT NOT NULL, school TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS prep_projects_workspace_idx ON prep_projects(workspace_id);
CREATE TABLE IF NOT EXISTS application_targets (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES prep_projects(id) ON DELETE CASCADE, department TEXT NOT NULL, program TEXT NOT NULL, direction TEXT, application_year INTEGER NOT NULL, batch TEXT NOT NULL, mentor TEXT, custom_fields TEXT NOT NULL DEFAULT '{}', is_active INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS application_targets_project_idx ON application_targets(project_id);
CREATE TABLE IF NOT EXISTS source_assets (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, project_id TEXT NOT NULL REFERENCES prep_projects(id) ON DELETE CASCADE, origin TEXT NOT NULL, title TEXT NOT NULL, url TEXT, mime_type TEXT, local_path TEXT, content TEXT NOT NULL, content_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ready', confidence TEXT NOT NULL DEFAULT 'medium', source_type TEXT NOT NULL DEFAULT '网页资料', published_at TEXT, fetched_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS source_assets_project_idx ON source_assets(project_id); CREATE INDEX IF NOT EXISTS source_assets_hash_idx ON source_assets(project_id, content_hash);
CREATE TABLE IF NOT EXISTS source_target_links (source_id TEXT NOT NULL REFERENCES source_assets(id) ON DELETE CASCADE, target_id TEXT NOT NULL REFERENCES application_targets(id) ON DELETE CASCADE, PRIMARY KEY(source_id, target_id));
CREATE TABLE IF NOT EXISTS source_assessments (source_id TEXT NOT NULL REFERENCES source_assets(id) ON DELETE CASCADE, target_id TEXT NOT NULL REFERENCES application_targets(id) ON DELETE CASCADE, verdict TEXT NOT NULL, quality_score INTEGER NOT NULL, target_match INTEGER NOT NULL, evidence_level TEXT NOT NULL, content_type TEXT NOT NULL, usable_for TEXT NOT NULL DEFAULT '[]', relevant_passages TEXT NOT NULL DEFAULT '[]', review_reason TEXT NOT NULL, model_reviewed INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY(source_id, target_id));
CREATE INDEX IF NOT EXISTS source_assessments_target_idx ON source_assessments(target_id, verdict, quality_score);
CREATE TABLE IF NOT EXISTS research_runs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES prep_projects(id) ON DELETE CASCADE, target_id TEXT REFERENCES application_targets(id) ON DELETE SET NULL, depth TEXT NOT NULL, status TEXT NOT NULL, query TEXT NOT NULL, source_count INTEGER NOT NULL DEFAULT 0, detail TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS research_runs_project_idx ON research_runs(project_id);
CREATE TABLE IF NOT EXISTS question_set_versions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES prep_projects(id) ON DELETE CASCADE, target_id TEXT NOT NULL REFERENCES application_targets(id) ON DELETE CASCADE, module TEXT NOT NULL, title TEXT NOT NULL, source_snapshot TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS question_sets_target_idx ON question_set_versions(target_id, module);
CREATE TABLE IF NOT EXISTS question_items (id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES question_set_versions(id) ON DELETE CASCADE, position INTEGER NOT NULL, theme TEXT NOT NULL, question TEXT NOT NULL, summary TEXT, url TEXT, kind TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]', evidence_ids TEXT NOT NULL DEFAULT '[]', metadata TEXT NOT NULL DEFAULT '{}');
CREATE INDEX IF NOT EXISTS question_items_version_idx ON question_items(version_id);
CREATE TABLE IF NOT EXISTS resume_assets (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE, filename TEXT, mime_type TEXT, local_path TEXT, content TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS faculty_subjects (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES prep_projects(id) ON DELETE CASCADE, target_id TEXT NOT NULL REFERENCES application_targets(id) ON DELETE CASCADE, kind TEXT NOT NULL, name TEXT NOT NULL, homepage TEXT, description TEXT, source_ids TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS faculty_subjects_target_idx ON faculty_subjects(target_id);
`)
sqlite.prepare("UPDATE research_tasks SET status = 'interrupted', updated_at = ? WHERE status IN ('plan','discover','fetch','extract','verify','synthesize')").run(new Date().toISOString())

export const db = drizzle(sqlite, { schema })

export function ensureWorkspace(sessionId: string) {
  const current = db.select().from(schema.workspaces).where(eq(schema.workspaces.sessionId, sessionId)).get()
  if (current) return current
  const now = new Date().toISOString()
  const workspace = { id: `ws_${nanoid(12)}`, sessionId, mode: (process.env.DEMO_MODE === "false" ? "real" : "demo") as "demo" | "real", createdAt: now }
  db.insert(schema.workspaces).values(workspace).run()
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
