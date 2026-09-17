import { afterEach, describe, expect, it, vi } from "vitest"
import { collectResearch, researchStream, type ResearchResult } from "../lib/research-stream"

const result: ResearchResult = { runId: "test-run", status: "ready", added: 3, duplicates: 1, rejected: 0, discovered: 4, modelScreening: true }
afterEach(() => vi.unstubAllGlobals())

describe("research progress transport", () => {
  it("reads split UTF-8 chunks and ignores heartbeats until a complete result arrives", async () => {
    const bytes = new TextEncoder().encode(`${JSON.stringify({ type: "progress", detail: "正在审核资料（2/4）" })}\n{"type":"heartbeat"}\n${JSON.stringify({ type: "complete", result })}\n`)
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ start(stream) {
      for (let index = 0; index < bytes.length; index += 7) stream.enqueue(bytes.slice(index, index + 7))
      stream.close()
    } }), { headers: { "content-type": "application/x-ndjson" } })))
    const progress = vi.fn()
    expect(await collectResearch({}, progress)).toEqual(result)
    expect(progress).toHaveBeenCalledWith("正在审核资料（2/4）")
  })

  it("shows server failures and ends instead of waiting indefinitely", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => researchStream(async () => { throw new Error("审核失败，请重试") }, new AbortController().signal)))
    await expect(collectResearch({}, () => {})).rejects.toThrow("审核失败，请重试")
  })

  it("detects a connection that ends without a completion event", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"type":"heartbeat"}\n', { headers: { "content-type": "application/x-ndjson" } })))
    await expect(collectResearch({}, () => {})).rejects.toThrow("收集连接提前结束")
  })

  it("aborts when the server sends no data", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: unknown, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true })
    })))
    await expect(collectResearch({}, () => {}, 20)).rejects.toThrow("收集连接中断")
  })

  it("cancels server work when the client closes the stream", async () => {
    let workSignal: AbortSignal | undefined
    const response = researchStream(async (signal) => {
      workSignal = signal
      await new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }))
      return result
    }, new AbortController().signal)
    const reader = response.body!.getReader()
    expect((await reader.read()).done).toBe(false)
    await reader.cancel()
    expect(workSignal?.aborted).toBe(true)
  })
})
