import "server-only"

const endpoint = "https://api.tavily.com"

function key(override?: string) {
  const value = override?.trim() || process.env.TAVILY_API_KEY
  if (!value) throw new Error("请先在 API Key 中填写 Tavily Key")
  return value
}

async function tavilyRequest<T>(path: string, body: object, apiKey?: string): Promise<T> {
  const response = await fetch(`${endpoint}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${key(apiKey)}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Tavily 请求失败：HTTP ${response.status}`)
  return response.json() as Promise<T>
}

export type TavilyResult = { title: string; url: string; content: string; score: number; raw_content?: string | null }

export function searchTavily(query: string, maxResults = 6, apiKey?: string, depth: "basic" | "advanced" = "basic") {
  return tavilyRequest<{ query: string; results: TavilyResult[]; response_time: string; request_id: string }>("/search", {
    query, search_depth: depth, max_results: Math.min(Math.max(maxResults, 1), 10), include_answer: false, include_raw_content: depth === "advanced",
  }, apiKey)
}

export function extractTavily(urls: string[], apiKey?: string) {
  return tavilyRequest<{ results: { url: string; raw_content: string }[]; failed_results: { url: string; error: string }[]; request_id: string }>("/extract", {
    urls: urls.slice(0, 20), extract_depth: "basic", format: "text", timeout: 15, include_usage: true,
  }, apiKey)
}
