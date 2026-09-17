import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
import { reviewSourceCandidatesWithModel } from "../lib/adapters/llm"

const target = { department: "计算机学院", program: "计算机", direction: null, applicationYear: 2027, batch: "夏令营", mentor: null }
const candidates = (count: number) => Array.from({ length: count }, (_, i) => ({ index: i + 10, title: "北大考核说明", url: "https://pku.edu.cn/test", status: "ready", ruleSummary: "匹配目标院校", content: "北京大学夏令营考核包括机试和专业面试。" }))
const review = (index: number) => ({ index, verdict: "accept", targetMatch: 100, contentType: "official_policy", evidenceLevel: "L2", usableFor: ["coding", "interview"], directness: 80, authority: 100, completeness: 80, year: 2027, relevantPassages: ["夏令营考核包括机试和专业面试"], reason: "官方考核依据" })
const success = (indexes: number[]) => Response.json({ status: "completed", output: [{ content: [{ type: "reasoning_text", text: "not application data" }] }, { content: [{ type: "output_text", text: JSON.stringify({ reviews: indexes.map(review) }) }] }] })

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe("source screening response budget and recovery", () => {
  it("disables Responses reasoning and splits a truncated batch without losing source indexes", async () => {
    vi.stubEnv("LLM_BASE_URL", "https://api.deepseek.com")
    const batches: number[][] = []
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      expect(body.reasoning).toEqual({ effort: "none" })
      expect(body.text.format.type).toBe("json_schema")
      const indexes = JSON.parse(body.input).candidates.map((item: { index: number }) => item.index)
      batches.push(indexes)
      return indexes.length === 4 ? Response.json({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }) : success(indexes)
    })
    vi.stubGlobal("fetch", fetchMock)
    const progress = vi.fn()
    const result = await reviewSourceCandidatesWithModel({ project: { school: "北京大学" }, target, candidates: candidates(4) }, "test-only", { onProgress: progress })
    expect(batches).toEqual([[10, 11, 12, 13], [10, 11], [12, 13]])
    expect(result.map((item) => item.index)).toEqual([10, 11, 12, 13])
    expect(progress.mock.calls).toEqual([[2, 4], [4, 4]])
  })

  it.each(["invalid-json", "missing-index", "duplicate-index"])("recovers %s with a fresh smaller structured response", async (failure) => {
    let calls = 0
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
      calls++
      const indexes = JSON.parse(JSON.parse(String(init.body)).input).candidates.map((item: { index: number }) => item.index)
      if (calls === 1) return Response.json({ status: "completed", output_text: failure === "invalid-json" ? '{"reviews":[' : JSON.stringify({ reviews: failure === "missing-index" ? [review(10)] : [review(10), review(10)] }) })
      return success(indexes)
    }))
    const result = await reviewSourceCandidatesWithModel({ project: { school: "北京大学" }, target, candidates: candidates(2) }, "test-only")
    expect(result.map((item) => item.index)).toEqual([10, 11])
    expect(calls).toBe(3)
  })

  it("limits concurrent model requests to two", async () => {
    let active = 0
    let peak = 0
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
      peak = Math.max(peak, ++active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      return success(JSON.parse(JSON.parse(String(init.body)).input).candidates.map((item: { index: number }) => item.index))
    }))
    const result = await reviewSourceCandidatesWithModel({ project: { school: "北京大学" }, target, candidates: candidates(13) }, "test-only")
    expect(result).toHaveLength(13)
    expect(peak).toBe(2)
  })

  it("stops on bad credentials without retrying or marking sources irrelevant", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(reviewSourceCandidatesWithModel({ project: { school: "北京大学" }, target, candidates: candidates(1) }, "test-only")).rejects.toThrow("HTTP 401")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("bounds retries when a single source still produces truncated output", async () => {
    const fetchMock = vi.fn(async () => Response.json({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(reviewSourceCandidatesWithModel({ project: { school: "北京大学" }, target, candidates: candidates(1) }, "test-only")).rejects.toThrow("审核结果仍不完整")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("propagates cancellation to in-flight API calls and does not retry", async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn((_url: unknown, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true })
      controller.abort()
    }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(reviewSourceCandidatesWithModel({ project: { school: "北京大学" }, target, candidates: candidates(4) }, "test-only", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
