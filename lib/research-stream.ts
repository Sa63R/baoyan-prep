export type ResearchResult = { runId: string; status: "ready"; added: number; duplicates: number; rejected: number; discovered: number; modelScreening: boolean }
export type ResearchEvent =
  | { type: "progress"; detail: string }
  | { type: "heartbeat" }
  | { type: "complete"; result: ResearchResult }
  | { type: "error"; error: string }

/** Send headers immediately and keep the connection alive during external calls. */
export function researchStream(
  execute: (signal: AbortSignal, progress: (detail: string) => void) => Promise<ResearchResult>,
  parentSignal: AbortSignal,
) {
  const controller = new AbortController()
  const signal = AbortSignal.any([parentSignal, controller.signal, AbortSignal.timeout(360_000)])
  let closed = false
  let heartbeat: ReturnType<typeof setInterval> | undefined
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(stream) {
      const send = (event: ResearchEvent) => {
        if (!closed) stream.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }
      send({ type: "progress", detail: "正在准备收集…" })
      heartbeat = setInterval(() => send({ type: "heartbeat" }), 10_000)
      void execute(signal, (detail) => send({ type: "progress", detail }))
        .then((result) => send({ type: "complete", result }))
        .catch((error) => send({ type: "error", error: error instanceof Error ? error.message : "收集失败，请重试" }))
        .finally(() => {
          clearInterval(heartbeat)
          if (!closed) { closed = true; stream.close() }
        })
    },
    cancel() {
      closed = true
      clearInterval(heartbeat)
      controller.abort(new DOMException("已取消收集", "AbortError"))
    },
  })
  return new Response(body, { headers: {
    "content-type": "application/x-ndjson; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    "x-accel-buffering": "no",
  } })
}

/** Consume complete lines; a closed or silent connection must not leave a spinner. */
export async function collectResearch(
  init: RequestInit,
  onProgress: (detail: string) => void,
  idleTimeoutMs = 45_000,
): Promise<ResearchResult> {
  const controller = new AbortController()
  const signals = [controller.signal, AbortSignal.timeout(390_000)]
  if (init.signal) signals.push(init.signal)
  const signal = AbortSignal.any(signals)
  let idleTimer: ReturnType<typeof setTimeout>
  const touch = () => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => controller.abort(new Error("收集连接中断，请重试")), idleTimeoutMs)
  }
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  touch()
  try {
    const headers = new Headers(init.headers)
    headers.set("accept", "application/x-ndjson")
    const response = await fetch("/api/research", { ...init, headers, signal })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(payload?.error || `收集请求失败（${response.status}），请重试`)
    }
    if (!response.headers.get("content-type")?.includes("application/x-ndjson") || !response.body) throw new Error("收集连接异常，请刷新页面后重试")
    reader = response.body.getReader()
    const decoder = new TextDecoder()
    let pending = ""
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      touch()
      pending += decoder.decode(value, { stream: true })
      let end: number
      while ((end = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, end).trim()
        pending = pending.slice(end + 1)
        if (!line) continue
        let event: ResearchEvent
        try { event = JSON.parse(line) }
        catch { throw new Error("收集进度响应异常，请重试") }
        if (event.type === "error") throw new Error(event.error)
        if (event.type === "complete") return event.result
        if (event.type === "progress") onProgress(event.detail)
      }
    }
    throw new Error("收集连接提前结束，请重试")
  } finally {
    clearTimeout(idleTimer!)
    await reader?.cancel().catch(() => {})
  }
}
