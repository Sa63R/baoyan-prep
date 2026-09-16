import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

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

export type TrainingRecord = typeof trainingRecords.$inferSelect
