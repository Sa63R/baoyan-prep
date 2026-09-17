import { describe, expect, it } from "vitest"
import {
  assessCandidateRules,
  buildResearchQueries,
  extractRelevantPassages,
  finalizeSourceAssessment,
  selectSourcesForGeneration,
  type SourceCandidate,
  type TargetDescriptor,
} from "../lib/source-strategy"

const target: TargetDescriptor = {
  school: "北大",
  department: "计算机学院",
  program: "人工智能",
  direction: "大模型",
  applicationYear: 2028,
  batch: "夏令营",
  mentor: "都可以",
}

describe("target-aware source strategy", () => {
  it("plans separate official, coding, experience, and faculty searches without placeholder mentors", () => {
    const queries = buildResearchQueries(target, "standard")
    expect(queries.length).toBeGreaterThanOrEqual(5)
    expect(queries[0]).toContain("site:pku.edu.cn")
    expect(queries.some((query) => query.includes("机试") && query.includes("真题"))).toBe(true)
    expect(queries.some((query) => query.includes("面经"))).toBe(true)
    expect(queries.join(" ")).not.toContain("都可以")
  })

  it("rejects another university's official page instead of trusting every edu.cn host", () => {
    const candidate: SourceCandidate = { title: "北京师范大学人工智能学院夏令营通知", url: "https://ai.bnu.edu.cn/admission", content: "北京师范大学人工智能学院夏令营考核办法，包含机试。", status: "ready" }
    const result = assessCandidateRules(candidate, target)
    expect(result.hardReject).toBe(true)
    expect(result.targetMatch).toBe(0)
    expect(result.reason).toContain("其他院校")
  })

  it("recognizes the target university's official domain", () => {
    const candidate: SourceCandidate = { title: "信息科学技术学院夏令营考核办法", url: "https://eecs.pku.edu.cn/admission", content: "信息科学技术学院夏令营考核包含上机考试与综合面试。", status: "ready" }
    const result = assessCandidateRules(candidate, target)
    expect(result.hardReject).toBe(false)
    expect(result.officialTarget).toBe(true)
    expect(result.targetMatch).toBe(100)
  })

  it("sends an unknown university domain to semantic review instead of rejecting it blindly", () => {
    const unknownTarget = { ...target, school: "同济大学" }
    const candidate: SourceCandidate = { title: "计算机学院夏令营考核办法", url: "https://cs.tongji.edu.cn/admission", content: "计算机学院夏令营综合考核包括编程能力测试和专业面试，具体安排如下。", status: "ready" }
    const result = assessCandidateRules(candidate, unknownTarget)
    expect(result.hardReject).toBe(false)
    expect(result.reason).toContain("匹配较弱")
  })

  it("retrieves relevant passages from the end of a long article", () => {
    const content = `${"无关的活动介绍。".repeat(600)}\n\n2025 年北京大学计算机学院机试回忆：现场完成两道算法题，其中一道涉及最短路。`
    const passages = extractRelevantPassages(content, ["北京大学", "机试", "算法题", "最短路"], 2)
    expect(passages.join(" ")).toContain("最短路")
  })

  it("caps a policy notice at L2 even if the model overstates its evidence", () => {
    const candidate: SourceCandidate = { title: "北大考核通知", url: "https://eecs.pku.edu.cn/policy", content: "北京大学计算机学院夏令营考核包含机试，具体安排以现场通知为准。", status: "ready" }
    const rule = assessCandidateRules(candidate, target)
    const result = finalizeSourceAssessment(candidate, rule, {
      index: 0, verdict: "accept", targetMatch: 100, contentType: "official_policy", evidenceLevel: "L4", usableFor: ["coding"], directness: 60, authority: 100, completeness: 80, year: 2025, relevantPassages: ["北京大学计算机学院夏令营考核包含机试，具体安排以现场通知为准。"], reason: "官方政策",
    })
    expect(result.evidenceLevel).toBe("L2")
    expect(result.modelReviewed).toBe(true)
  })

  it("excludes rejected sources from generation and uses relevant chunks", () => {
    const rejected = { id: "bad", title: "其他学校", url: "https://ai.bnu.edu.cn", content: "北京师范大学机试。", status: "ready", origin: "automatic" as const, assessment: { verdict: "reject" as const, qualityScore: 20, targetMatch: 0, evidenceLevel: "L0" as const, contentType: "unrelated", usableFor: [], relevantPassages: [], reviewReason: "其他学校", modelReviewed: true } }
    const accepted = { id: "good", title: "北大机试回忆", url: "https://example.com/pku", content: `${"背景。".repeat(500)}北京大学计算机学院机试出现图论最短路题。`, status: "ready", origin: "automatic" as const, assessment: { verdict: "accept" as const, qualityScore: 85, targetMatch: 95, evidenceLevel: "L3" as const, contentType: "candidate_recollection", usableFor: ["coding" as const], relevantPassages: ["北京大学计算机学院机试出现图论最短路题。"], reviewReason: "具体回忆", modelReviewed: true } }
    const selected = selectSourcesForGeneration([rejected, accepted], target, "coding")
    expect(selected.map((source) => source.id)).toEqual(["good"])
    expect(selected[0].content).toContain("最短路")
  })
})
