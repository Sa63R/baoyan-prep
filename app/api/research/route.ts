import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { z } from "zod"
import { hasModelApiKey, reviewSourceCandidatesWithModel } from "@/lib/adapters/llm"
import { extractTavily, searchTavily } from "@/lib/adapters/tavily"
import { sqlite, workspaceForSession } from "@/lib/db"
import { assertServiceAccess, requireSession } from "@/lib/session"
import {
  assessCandidateRules,
  buildResearchQueries,
  finalizeSourceAssessment,
  normalizeSourceUrl,
  prepareCandidatePreview,
  type SourceCandidate,
  type TargetDescriptor,
} from "@/lib/source-strategy"
import { insertSourceAsset, projectContext, upsertSourceAssessment } from "@/lib/workbench"

export const runtime = "nodejs"
export const maxDuration = 120

const schema = z.object({
  projectId: z.string().min(1),
  targetId: z.string().min(1),
  depth: z.enum(["quick", "standard", "deep"]).default("standard"),
})

const typeLabels: Record<string, string> = {
  official_question: "官方原题或样题",
  official_policy: "官方考核依据",
  candidate_recollection: "考生回忆",
  interview_experience: "面试经验",
  faculty_research: "导师与课题组",
  academic_paper: "公开论文",
  generic_reference: "通用参考",
}

export async function POST(request: NextRequest) {
  let runId = ""
  try {
    const workspace = workspaceForSession(requireSession(request))
    if (!workspace) throw new Error("工作区不存在")
    assertServiceAccess(request)
    const input = schema.parse(await request.json())
    const context = projectContext(workspace.id, input.projectId, input.targetId)
    const tavilyKey = request.headers.get("x-tavily-api-key") || undefined
    const deepseekKey = request.headers.get("x-deepseek-api-key") || undefined
    const target: TargetDescriptor = { school: context.project.school, ...context.target }
    const queries = buildResearchQueries(target, input.depth)
    const maxResults = input.depth === "quick" ? 5 : input.depth === "standard" ? 6 : 8
    const timestamp = new Date().toISOString()
    runId = `run_${nanoid(12)}`
    sqlite.prepare("INSERT INTO research_runs (id, project_id, target_id, depth, status, query, source_count, detail, created_at, updated_at) VALUES (?, ?, ?, ?, 'running', ?, 0, ?, ?, ?)")
      .run(runId, input.projectId, input.targetId, input.depth, queries.join(" | "), "正在发现并审核公开资料", timestamp, timestamp)

    const found = new Map<string, { title: string; url: string; content: string; score: number; raw_content?: string | null }>()
    for (let index = 0; index < queries.length; index += 3) {
      const results = await Promise.all(queries.slice(index, index + 3).map((query) => searchTavily(query, maxResults, tavilyKey, input.depth === "deep" ? "advanced" : "basic")))
      for (const result of results) {
        for (const item of result.results) {
          const key = normalizeSourceUrl(item.url)
          const existing = found.get(key)
          if (!existing || item.score > existing.score || (item.raw_content?.length || 0) > (existing.raw_content?.length || 0)) found.set(key, { ...item, url: key })
        }
      }
    }
    const items = [...found.values()]
    const extractLimit = input.depth === "quick" ? 10 : input.depth === "standard" ? 20 : 40
    const needExtract = items.filter((item) => !item.raw_content && item.url.startsWith("http")).slice(0, extractLimit)
    const extracted = new Map<string, string>()
    for (let index = 0; index < needExtract.length; index += 20) {
      const batch = needExtract.slice(index, index + 20)
      const result = await extractTavily(batch.map((item) => item.url), tavilyKey).catch(() => ({ results: [], failed_results: [], request_id: "" }))
      for (const item of result.results) extracted.set(normalizeSourceUrl(item.url), item.raw_content)
    }

    const candidates = items.flatMap((item): SourceCandidate[] => {
      const content = (item.raw_content || extracted.get(item.url) || item.content || "").trim()
      if (content.length < 20) return []
      return [{
        title: item.title || new URL(item.url).hostname,
        url: item.url,
        content: content.slice(0, 500_000),
        status: item.raw_content || extracted.has(item.url) ? "ready" : "snippet",
        origin: "automatic",
        tavilyScore: item.score,
      }]
    })
    const rules = candidates.map((candidate) => assessCandidateRules(candidate, target))
    const reviewable = candidates.map((candidate, index) => ({ candidate, rule: rules[index], index })).filter((item) => !item.rule.hardReject)
      .sort((a, b) => b.rule.preliminaryScore - a.rule.preliminaryScore)
      .slice(0, input.depth === "quick" ? 12 : input.depth === "standard" ? 30 : 54)

    let modelReviews = new Map<number, Awaited<ReturnType<typeof reviewSourceCandidatesWithModel>>[number]>()
    const modelScreening = hasModelApiKey(deepseekKey)
    if (modelScreening && reviewable.length) {
      const reviews = await reviewSourceCandidatesWithModel({
        project: { school: context.project.school },
        target: context.target,
        candidates: reviewable.map(({ candidate, rule, index }) => ({ index, title: candidate.title, url: candidate.url, status: candidate.status, ruleSummary: rule.reason, content: prepareCandidatePreview(candidate, target) })),
      }, deepseekKey)
      modelReviews = new Map(reviews.map((review) => [review.index, review]))
    }

    let added = 0
    let duplicates = 0
    let rejected = 0
    let referenced = 0
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index]
      const modelReview = modelReviews.get(index)
      const baseAssessment = finalizeSourceAssessment(candidate, rules[index], modelReview)
      const assessment = modelScreening && !rules[index].hardReject && !modelReview
        ? { ...baseAssessment, verdict: "reject" as const, reviewReason: "DeepSeek 未返回该候选的审核结果，已按失败关闭处理" }
        : baseAssessment
      if (assessment.verdict === "reject") { rejected += 1; continue }
      if (assessment.verdict === "reference") referenced += 1
      const confidence = assessment.qualityScore >= 78 && assessment.targetMatch >= 78 ? "high" : assessment.qualityScore >= 55 ? "medium" : "low"
      const saved = insertSourceAsset({
        workspaceId: workspace.id,
        projectId: input.projectId,
        origin: "automatic",
        title: candidate.title,
        url: candidate.url,
        mimeType: "text/html",
        content: candidate.content,
        status: candidate.status,
        confidence,
        sourceType: typeLabels[assessment.contentType] || "公开网络资料",
        targetIds: [input.targetId],
      })
      upsertSourceAssessment(saved.source.id, input.targetId, assessment)
      if (saved.duplicate) duplicates += 1
      else added += 1
    }
    const ruleRejected = rules.filter((rule) => rule.hardReject).length
    const screeningLabel = modelScreening ? "DeepSeek 二次审核完成" : "未配置 DeepSeek，已使用严格规则审核"
    const detail = `发现 ${items.length} 条；排除 ${rejected} 条（规则 ${ruleRejected}）；保留参考 ${referenced} 条；新增 ${added} 条；合并重复 ${duplicates} 条；${screeningLabel}`
    sqlite.prepare("UPDATE research_runs SET status='ready', source_count=?, detail=?, updated_at=? WHERE id=?")
      .run(added, detail, new Date().toISOString(), runId)
    sqlite.prepare("UPDATE prep_projects SET updated_at=? WHERE id=?").run(new Date().toISOString(), input.projectId)
    return NextResponse.json({ runId, status: "ready", added, duplicates, rejected, discovered: items.length, modelScreening })
  } catch (error) {
    const message = error instanceof Error ? error.message : "研究失败"
    if (runId) sqlite.prepare("UPDATE research_runs SET status='failed', detail=?, updated_at=? WHERE id=?").run(message, new Date().toISOString(), runId)
    return NextResponse.json({ error: message }, { status: message === "SESSION_REQUIRED" ? 401 : message === "ACCESS_CODE_REQUIRED" ? 403 : 400 })
  }
}
