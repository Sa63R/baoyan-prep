import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  mode: text("mode", { enum: ["demo", "real"] }).notNull().default("demo"),
  createdAt: text("created_at").notNull(),
})

export const targets = sqliteTable("targets", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  school: text("school"),
  department: text("department"),
  program: text("program"),
  degreeType: text("degree_type"),
  batch: text("batch"),
  assessmentYear: integer("assessment_year"),
  enrollmentYear: integer("enrollment_year"),
  mentorName: text("mentor_name"),
  mentorHomepage: text("mentor_homepage"),
}, (table) => [index("targets_workspace_idx").on(table.workspaceId)])

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url"),
  author: text("author"),
  publishedAt: text("published_at"),
  fetchedAt: text("fetched_at").notNull(),
  statedYear: text("stated_year"),
  scope: text("scope"),
  sourceType: text("source_type").notNull(),
  accessStatus: text("access_status").notNull(),
  contentRange: text("content_range"),
  contentHash: text("content_hash").notNull(),
  reprintOf: text("reprint_of"),
  visibility: text("visibility", { enum: ["private", "public"] }).notNull().default("private"),
  content: text("content").notNull(),
}, (table) => [index("sources_workspace_idx").on(table.workspaceId), index("sources_hash_idx").on(table.workspaceId, table.contentHash)])

export const evidences = sqliteTable("evidences", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  sourceId: text("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
  quote: text("quote").notNull(),
  locator: text("locator").notNull(),
  located: integer("located", { mode: "boolean" }).notNull(),
  searchSnippetOnly: integer("search_snippet_only", { mode: "boolean" }).notNull().default(false),
}, (table) => [index("evidences_workspace_idx").on(table.workspaceId)])

export const claims = sqliteTable("claims", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  claimType: text("claim_type").notNull(),
  evidenceIds: text("evidence_ids").notNull(),
  scope: text("scope").notNull(),
  verification: text("verification").notNull(),
  conflictIds: text("conflict_ids").notNull().default("[]"),
}, (table) => [index("claims_workspace_idx").on(table.workspaceId)])

export const researchTasks = sqliteTable("research_tasks", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  searchCount: integer("search_count").notNull().default(0),
  fetchCount: integer("fetch_count").notNull().default(0),
  detail: text("detail"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("tasks_workspace_idx").on(table.workspaceId)])

export const trainingRecords = sqliteTable("training_records", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  module: text("module").notNull(),
  itemId: text("item_id").notNull(),
  answer: text("answer").notNull(),
  resultKind: text("result_kind").notNull(),
  result: text("result").notNull(),
  feedback: text("feedback").notNull(),
  retestOf: text("retest_of"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("records_workspace_idx").on(table.workspaceId)])

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  storagePath: text("storage_path").notNull(),
  extractedText: text("extracted_text").notNull(),
  parseStatus: text("parse_status").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("attachments_workspace_idx").on(table.workspaceId)])

export const prepProjects = sqliteTable("prep_projects", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  school: text("school").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("prep_projects_workspace_idx").on(table.workspaceId)])

export const applicationTargets = sqliteTable("application_targets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => prepProjects.id, { onDelete: "cascade" }),
  department: text("department").notNull(),
  program: text("program").notNull(),
  direction: text("direction"),
  applicationYear: integer("application_year").notNull(),
  batch: text("batch", { enum: ["夏令营", "预推免"] }).notNull(),
  mentor: text("mentor"),
  customFields: text("custom_fields").notNull().default("{}"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("application_targets_project_idx").on(table.projectId)])

export const sourceAssets = sqliteTable("source_assets", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: text("project_id").notNull().references(() => prepProjects.id, { onDelete: "cascade" }),
  origin: text("origin", { enum: ["automatic", "user"] }).notNull(),
  title: text("title").notNull(),
  url: text("url"),
  mimeType: text("mime_type"),
  localPath: text("local_path"),
  content: text("content").notNull(),
  contentHash: text("content_hash").notNull(),
  status: text("status").notNull().default("ready"),
  confidence: text("confidence").notNull().default("medium"),
  sourceType: text("source_type").notNull().default("网页资料"),
  publishedAt: text("published_at"),
  fetchedAt: text("fetched_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("source_assets_project_idx").on(table.projectId),
  index("source_assets_hash_idx").on(table.projectId, table.contentHash),
])

export const sourceTargetLinks = sqliteTable("source_target_links", {
  sourceId: text("source_id").notNull().references(() => sourceAssets.id, { onDelete: "cascade" }),
  targetId: text("target_id").notNull().references(() => applicationTargets.id, { onDelete: "cascade" }),
})

export const sourceAssessments = sqliteTable("source_assessments", {
  sourceId: text("source_id").notNull().references(() => sourceAssets.id, { onDelete: "cascade" }),
  targetId: text("target_id").notNull().references(() => applicationTargets.id, { onDelete: "cascade" }),
  verdict: text("verdict", { enum: ["accept", "reference", "reject"] }).notNull(),
  qualityScore: integer("quality_score").notNull(),
  targetMatch: integer("target_match").notNull(),
  evidenceLevel: text("evidence_level", { enum: ["L0", "L1", "L2", "L3", "L4"] }).notNull(),
  contentType: text("content_type").notNull(),
  usableFor: text("usable_for").notNull().default("[]"),
  relevantPassages: text("relevant_passages").notNull().default("[]"),
  reviewReason: text("review_reason").notNull(),
  modelReviewed: integer("model_reviewed", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.sourceId, table.targetId] }),
  index("source_assessments_target_idx").on(table.targetId, table.verdict, table.qualityScore),
])

export const researchRuns = sqliteTable("research_runs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => prepProjects.id, { onDelete: "cascade" }),
  targetId: text("target_id").references(() => applicationTargets.id, { onDelete: "set null" }),
  depth: text("depth", { enum: ["quick", "standard", "deep"] }).notNull(),
  status: text("status").notNull(),
  query: text("query").notNull(),
  sourceCount: integer("source_count").notNull().default(0),
  detail: text("detail"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("research_runs_project_idx").on(table.projectId)])

export const questionSetVersions = sqliteTable("question_set_versions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => prepProjects.id, { onDelete: "cascade" }),
  targetId: text("target_id").notNull().references(() => applicationTargets.id, { onDelete: "cascade" }),
  module: text("module", { enum: ["coding", "interview", "project"] }).notNull(),
  title: text("title").notNull(),
  sourceSnapshot: text("source_snapshot").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("question_sets_target_idx").on(table.targetId, table.module)])

export const questionItems = sqliteTable("question_items", {
  id: text("id").primaryKey(),
  versionId: text("version_id").notNull().references(() => questionSetVersions.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  theme: text("theme").notNull(),
  question: text("question").notNull(),
  summary: text("summary"),
  url: text("url"),
  kind: text("kind").notNull(),
  tags: text("tags").notNull().default("[]"),
  evidenceIds: text("evidence_ids").notNull().default("[]"),
  metadata: text("metadata").notNull().default("{}"),
}, (table) => [index("question_items_version_idx").on(table.versionId)])

export const resumeAssets = sqliteTable("resume_assets", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }).unique(),
  filename: text("filename"),
  mimeType: text("mime_type"),
  localPath: text("local_path"),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
})

export const facultySubjects = sqliteTable("faculty_subjects", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => prepProjects.id, { onDelete: "cascade" }),
  targetId: text("target_id").notNull().references(() => applicationTargets.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["faculty", "group"] }).notNull(),
  name: text("name").notNull(),
  homepage: text("homepage"),
  description: text("description"),
  sourceIds: text("source_ids").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("faculty_subjects_target_idx").on(table.targetId)])

export type TrainingRecord = typeof trainingRecords.$inferSelect
