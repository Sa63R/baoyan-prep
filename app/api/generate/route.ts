import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { z } from "zod"
import {
  generateQuestionsWithModel,
  reviewSourceCandidatesWithModel,
  verifyGeneratedQuestionEvidence,
  type GeneratedQuestion,
} from "@/lib/adapters/llm"
import { sqlite, workspaceForSession } from "@/lib/db"
import { assertServiceAccess, requireSession } from "@/lib/session"
import {
  assessCandidateRules,
  finalizeSourceAssessment,
  prepareCandidatePreview,
  selectSourcesForGeneration,
  schoolIdentity,
  type SourceAssessment,
  type SourceCandidate,
  type TargetDescriptor,
} from "@/lib/source-strategy"
import { projectContext, upsertSourceAssessment } from "@/lib/workbench"
import { questionKinds, validateQuestionProvenance } from "@/lib/validation"

export const runtime = "nodejs"
export const maxDuration = 120

const schema = z.object({
  projectId: z.string(), targetId: z.string(), module: z.enum(["coding", "interview", "project"]),
  model: z.enum(["deepseek-flash", "deepseek-v4-pro"]).default("deepseek-flash"), thinkingEnabled: z.boolean().default(true), customPrompt: z.string().max(3000).optional(),
})

const historicalKinds = new Set<GeneratedQuestion["kind"]>(["official_past", "official_sample", "recalled_past"])

export async function POST(request: NextRequest) {
  try {
    const workspace = workspaceForSession(requireSession(request))
    if (!workspace) throw new Error("工作区不存在")
    assertServiceAccess(request)
    const input = schema.parse(await request.json())
    const context = projectContext(workspace.id, input.projectId, input.targetId)
    if (input.module === "project" && !context.resume) throw new Error("请先上传或粘贴简历")
    if (input.module === "project" && !context.faculty) throw new Error("请先填写导师或课题组")
    const apiKey = request.headers.get("x-deepseek-api-key") || undefined
    const target: TargetDescriptor = { school: context.project.school, ...context.target }
    const assessmentMap = new Map(context.assessments.map((assessment) => [assessment.sourceId, assessment as SourceAssessment]))

    // Existing materials from earlier versions are reviewed lazily the next time a
    // question set is generated. This upgrades old projects without a destructive migration.
    const unreviewed = context.sources.filter((source) => !assessmentMap.has(source.id)).map((source, index) => {
      const candidate: SourceCandidate = { ...source, url: source.url, origin: source.origin }
      const initialRule = assessCandidateRules(candidate, target)
      const rule = source.origin === "user" && initialRule.hardReject
        ? { ...initialRule, hardReject: false, targetMatch: Math.max(initialRule.targetMatch, 35), reason: "用户资料，交由模型判断用途" }
        : initialRule
      return { source, candidate, rule, index }
    })
    const reviewable = unreviewed.filter((item) => !item.rule.hardReject).sort((a, b) => b.rule.preliminaryScore - a.rule.preliminaryScore)
    const reviews = reviewable.length ? await reviewSourceCandidatesWithModel({
      project: { school: schoolIdentity(context.project.school).canonical },
      target: context.target,
      candidates: reviewable.map(({ candidate, rule, index }) => ({ index, title: candidate.title, url: candidate.url, status: candidate.status, ruleSummary: rule.reason, content: prepareCandidatePreview(candidate, target) })),
    }, apiKey) : []
    const reviewMap = new Map(reviews.map((review) => [review.index, review]))
    if (reviewMap.size !== reviewable.length) throw new Error(`DeepSeek 资料审核格式不完整：应返回 ${reviewable.length} 条，实际解析到 ${reviewMap.size} 条`)
    for (const item of unreviewed) {
      const assessment = finalizeSourceAssessment(item.candidate, item.rule, reviewMap.get(item.index))
      upsertSourceAssessment(item.source.id, input.targetId, assessment)
      assessmentMap.set(item.source.id, assessment)
    }

    const ranked = selectSourcesForGeneration(context.sources.map((source) => ({
      ...source,
      url: source.url,
      assessment: assessmentMap.get(source.id),
    })), target, input.module)
    const sources = ranked.map((source) => ({
      id: source.id,
      title: source.title,
      url: source.url,
      sourceType: `${source.sourceType} · ${source.assessment?.evidenceLevel || "未分级"}`,
      confidence: source.assessment ? `${source.assessment.qualityScore}/100` : source.confidence,
      content: source.content,
    }))
    const result = await generateQuestionsWithModel({
      module: input.module, model: input.model, thinkingEnabled: input.thinkingEnabled, customPrompt: input.customPrompt,
      project: { school: context.project.school },
      target: context.target,
      sources,
      resume: context.resume ? String(context.resume.content) : undefined,
      faculty: context.faculty ? { kind: String(context.faculty.kind), name: String(context.faculty.name), homepage: context.faculty.homepage ? String(context.faculty.homepage) : null, description: context.faculty.description ? String(context.faculty.description) : null } : undefined,
    }, apiKey)

    const audits = await verifyGeneratedQuestionEvidence({ project: { school: context.project.school }, target: context.target, questions: result.questions, sources }, apiKey)
    const auditMap = new Map(audits.map((audit) => [audit.questionIndex, audit]))
    const timestamp = new Date().toISOString()
    const versionId = `qsv_${nanoid(12)}`
    sqlite.transaction(() => {
      sqlite.prepare("INSERT INTO question_set_versions (id, project_id, target_id, module, title, source_snapshot, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(versionId, input.projectId, input.targetId, input.module, result.title, JSON.stringify(sources.map(({ id, title, url }) => ({ id, title, url }))), timestamp)
      const insert = sqlite.prepare("INSERT INTO question_items (id, version_id, position, theme, question, summary, url, kind, tags, evidence_ids, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      result.questions.forEach((question, index) => {
        const requestedKind = questionKinds.includes(question.kind) ? question.kind : "generated"
        const requestedIndexes = (question.evidenceSourceIndexes || []).filter((value) => Number.isInteger(value) && value >= 0 && value < sources.length)
        const audit = auditMap.get(index)
        let finalKind: GeneratedQuestion["kind"] = requestedKind
        let evidenceIndexes = requestedIndexes
        if (historicalKinds.has(requestedKind)) {
          const directlySupported = Boolean(audit?.supported && audit.supportedEvidenceSourceIndexes.length)
          if (!directlySupported) finalKind = audit?.maxKind === "generated" ? "generated" : "recommended_practice"
          else if (audit) finalKind = audit.maxKind
          evidenceIndexes = audit?.supportedEvidenceSourceIndexes.length ? audit.supportedEvidenceSourceIndexes : requestedIndexes
        } else if (audit?.supportedEvidenceSourceIndexes.length) evidenceIndexes = audit.supportedEvidenceSourceIndexes
        const evidenceIds = evidenceIndexes.map((value) => sources[value]?.id).filter((value): value is string => Boolean(value))
        if (!validateQuestionProvenance(finalKind, evidenceIds[0])) finalKind = "recommended_practice"
        const citedUrl = evidenceIds.length ? sources.find((source) => source.id === evidenceIds[0])?.url || null : null
        const knownQuestionUrl = question.url && sources.some((source) => source.url === question.url) ? question.url : null
        const url = citedUrl || knownQuestionUrl
        insert.run(
          `qi_${nanoid(12)}`,
          versionId,
          index,
          question.theme || "综合",
          question.question,
          question.summary || null,
          url,
          finalKind,
          JSON.stringify(question.tags || []),
          JSON.stringify(evidenceIds),
          JSON.stringify({ evidenceAudit: audit ? { supported: audit.supported, reason: audit.reason, originalKind: requestedKind } : { supported: !historicalKinds.has(requestedKind), reason: "该题无需历史来源审计", originalKind: requestedKind } }),
        )
      })
      sqlite.prepare("UPDATE prep_projects SET updated_at=? WHERE id=?").run(timestamp, input.projectId)
    })()
    return NextResponse.json({ versionId, title: result.title, count: result.questions.length, model: result.model, sourceCount: sources.length, evidenceAudited: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败"
    return NextResponse.json({ error: message }, { status: message === "SESSION_REQUIRED" ? 401 : message === "ACCESS_CODE_REQUIRED" ? 403 : 400 })
  }
}
