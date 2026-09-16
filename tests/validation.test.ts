import { describe, expect, it } from "vitest"
import { demoClaims, demoEvidences, demoSources } from "../lib/demo-data"
import {
  countIndependentSources, extractResumeMetrics, safeTrainingResult, scopeMatchesTarget,
  validateEvidenceGraph, validateQuestionProvenance,
} from "../lib/validation"

const sources = demoSources.map((item) => ({ id: item.suffix, content: item.content, contentHash: item.suffix }))
const evidences = demoEvidences.map((item) => ({ id: item.suffix, sourceId: item.sourceSuffix, quote: item.quote, located: item.located }))
const claims = demoClaims.map((item) => ({ id: item.suffix, evidenceIds: [...item.evidenceSuffixes], claimType: item.claimType, scope: item.scope, conflictIds: [...item.conflictSuffixes] }))

describe("evidence graph", () => {
  it("keeps every citation valid and each quote locatable", () => {
    expect(validateEvidenceGraph(claims, evidences, sources)).toEqual({ valid: true, errors: [] })
  })

  it("rejects an external fact without evidence instead of inventing support", () => {
    const result = validateEvidenceGraph([{ id: "bad", evidenceIds: [], claimType: "官方事实", scope: "2027 夏令营" }], evidences, sources)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("缺少证据")
  })

  it("does not count reprints as independent experiences", () => {
    expect(countIndependentSources([{ id: "a", content: "x", contentHash: "same" }, { id: "b", content: "x", contentHash: "same", reprintOf: "same" }])).toBe(1)
  })

  it("preserves conflict relations", () => {
    const withConflict = [{ ...claims[0], conflictIds: ["C99"] }, { ...claims[1], id: "C99", conflictIds: ["C01"] }]
    expect(withConflict[0].conflictIds).toEqual(["C99"])
    expect(withConflict[1].conflictIds).toEqual(["C01"])
  })
})

describe("training truthfulness", () => {
  it("does not treat an older year or another batch as current scope", () => {
    expect(scopeMatchesTarget("2025 考核 · 夏令营", 2027, "夏令营")).toBe(false)
    expect(scopeMatchesTarget("2027 入学 · 预推免", 2027, "夏令营")).toBe(false)
    expect(scopeMatchesTarget("2027 入学 · 夏令营", 2027, "夏令营")).toBe(true)
  })

  it("requires provenance for historical questions but not generated practice", () => {
    expect(validateQuestionProvenance("official_past", null)).toBe(false)
    expect(validateQuestionProvenance("recalled_past", "E02")).toBe(true)
    expect(validateQuestionProvenance("generated", null)).toBe(true)
  })

  it("never upgrades AI review to an AC verdict", () => {
    expect(safeTrainingResult("ai_review", "AC")).toBe("AI_REVIEW_ONLY")
    expect(safeTrainingResult("self_reported", "AC")).toBe("AC")
  })

  it("extracts only metrics actually present in a resume", () => {
    expect(extractResumeMetrics("召回率提升，效果很好")).toEqual([])
    expect(extractResumeMetrics("Recall 提升 12%，P95 延迟 80ms")).toEqual(["12%", "80ms"])
  })
})
