import { afterEach, describe, expect, it, vi } from "vitest"
import { collectGeneration, generationStream, type GenerationResult } from "../lib/generation-stream"

const result: GenerationResult = {
  versionId: "test-version",
  title: "测试题单",
  count: 8,
  model: "deepseek-flash",
  sourceCount: 12,
  evidenceAudited: true,
}

afterEach(() => vi.unstubAllGlobals())

describe("question generation progress transport", () => {
  it("reads progress and heartbeat events until the complete result arrives", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => generationStream(async (_signal, progress) => {
      progress("正在生成题单")
      return result
    }, new AbortController().signal)))
    const progress = vi.fn()
    expect(await collectGeneration({}, progress)).toEqual(result)
    expect(progress).toHaveBeenCalledWith("正在准备题单…")
    expect(progress).toHaveBeenCalledWith("正在生成题单")
  })

  it("shows the server error instead of an opaque fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => generationStream(async () => { throw new Error("DeepSeek 请求失败：HTTP 401") }, new AbortController().signal)))
    await expect(collectGeneration({}, () => {})).rejects.toThrow("DeepSeek 请求失败：HTTP 401")
  })

  it("detects a connection that closes before completion", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"heartbeat"}\n', { headers: { "content-type": "application/x-ndjson" } })))
    await expect(collectGeneration({}, () => {})).rejects.toThrow("生成连接提前结束")
  })

  it("replaces a browser network failure with a retryable message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch") }))
    await expect(collectGeneration({}, () => {})).rejects.toThrow("生成连接被中断，请稍后重试")
  })
})
