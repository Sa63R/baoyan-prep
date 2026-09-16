export type EvidenceLike = { id: string; sourceId: string; quote: string; located: boolean }
export type SourceLike = { id: string; content: string; contentHash?: string; reprintOf?: string | null }
export type ClaimLike = { id: string; evidenceIds: string[]; claimType: string; scope: string; conflictIds?: string[] }

export function validateEvidenceGraph(claims: ClaimLike[], evidences: EvidenceLike[], sources: SourceLike[]) {
  const evidenceMap = new Map(evidences.map((item) => [item.id, item]))
  const sourceMap = new Map(sources.map((item) => [item.id, item]))
  const errors: string[] = []
  for (const claim of claims) {
    if (claim.claimType !== "未知" && claim.evidenceIds.length === 0) errors.push(`${claim.id}: 外部事实缺少证据`)
    for (const evidenceId of claim.evidenceIds) {
      const evidence = evidenceMap.get(evidenceId)
      if (!evidence) { errors.push(`${claim.id}: 引用不存在 ${evidenceId}`); continue }
      const source = sourceMap.get(evidence.sourceId)
      if (!source) { errors.push(`${evidenceId}: 来源不存在`); continue }
      if (evidence.located && !source.content.includes(evidence.quote)) errors.push(`${evidenceId}: 摘录无法在来源中定位`)
    }
  }
  return { valid: errors.length === 0, errors }
}

export function countIndependentSources(sources: SourceLike[]) {
  const roots = new Set(sources.map((source) => source.reprintOf || source.contentHash || source.id))
  return roots.size
}

export function safeTrainingResult(resultKind: string, result: string) {
  if (resultKind === "ai_review" && /^(AC|accepted|通过)$/i.test(result)) return "AI_REVIEW_ONLY"
  return result
}

export function extractResumeMetrics(text: string) {
  return text.match(/(?:\d+(?:\.\d+)?%|\d+(?:\.\d+)?\s*(?:ms|秒|毫秒|万|亿|倍))/g) || []
}

export const questionKinds = ["official_past", "official_sample", "recalled_past", "recommended_practice", "generated"] as const
export type QuestionKind = (typeof questionKinds)[number]

export function validateQuestionProvenance(kind: QuestionKind, sourceId?: string | null) {
  const historical = kind === "official_past" || kind === "official_sample" || kind === "recalled_past"
  return !historical || Boolean(sourceId)
}

export function scopeMatchesTarget(scope: string, enrollmentYear: number, batch: string) {
  return scope.includes(String(enrollmentYear)) && scope.includes(batch)
}
