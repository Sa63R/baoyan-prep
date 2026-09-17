import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { NextRequest } from "next/server"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/session", () => ({ requireSession: () => "test-session", assertServiceAccess: () => {} }))
vi.mock("@/lib/adapters/tavily", () => ({ searchTavily: vi.fn(), extractTavily: vi.fn() }))
vi.mock("@/lib/adapters/llm", () => ({ hasModelApiKey: () => true, reviewSourceCandidatesWithModel: vi.fn() }))
import { searchTavily } from "../lib/adapters/tavily"
import { reviewSourceCandidatesWithModel } from "../lib/adapters/llm"

const directory = mkdtempSync(join(tmpdir(), "baoyan-research-test-"))
let sqlite: typeof import("../lib/db").sqlite
let POST: typeof import("../app/api/research/route").POST
let workspaceId: string

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", join(directory, "test.db"))
  const database = await import("../lib/db")
  sqlite = database.sqlite
  workspaceId = database.ensureWorkspace("test-session").id
  sqlite.prepare("INSERT INTO prep_projects (id,workspace_id,name,school,created_at,updated_at) VALUES ('test-project',?,'清华大学','清华大学','2026','2026')").run(workspaceId)
  sqlite.exec("INSERT INTO application_targets (id,project_id,department,program,application_year,batch,created_at,updated_at) VALUES ('test-target','test-project','计算机系','计算机',2027,'夏令营','2026','2026')")
  POST = (await import("../app/api/research/route")).POST
})

beforeEach(() => {
  sqlite.exec("DELETE FROM research_runs; DELETE FROM source_assets")
  vi.mocked(searchTavily).mockReset().mockResolvedValue({ query: "test", response_time: "0", request_id: "test", results: [{ title: "清华大学计算机系考核说明", url: "https://www.tsinghua.edu.cn/test", content: "", raw_content: "清华大学计算机系夏令营考核包含算法机试和专业面试，考生需按要求参加考试。", score: 1 }] })
  vi.mocked(reviewSourceCandidatesWithModel).mockReset().mockImplementation(async (input, _key, options) => {
    options?.onProgress?.(input.candidates.length, input.candidates.length)
    return input.candidates.map(({ index }) => ({ index, verdict: "accept", targetMatch: 100, contentType: "official_policy", evidenceLevel: "L2", usableFor: ["coding", "interview"], directness: 80, authority: 100, completeness: 80, relevantPassages: ["考核包含算法机试和专业面试"], reason: "官方考核说明" }))
  })
})

afterAll(() => { sqlite?.close(); vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }) })

function request(signal?: AbortSignal) {
  return new NextRequest("http://localhost/api/research", { method: "POST", headers: { "content-type": "application/json", accept: "application/x-ndjson" }, body: JSON.stringify({ projectId: "test-project", targetId: "test-target", depth: "quick" }), signal })
}

describe("research route lifecycle", () => {
  it("streams progress then saves reviewed sources and a completed run", async () => {
    const response = await POST(request())
    expect(response.headers.get("content-type")).toContain("application/x-ndjson")
    const events = (await response.text()).trim().split("\n").map((line) => JSON.parse(line))
    expect(events.some((event) => event.type === "progress" && event.detail.includes("正在审核资料"))).toBe(true)
    expect(events.at(-1)).toMatchObject({ type: "complete", result: { added: 1, status: "ready" } })
    expect(sqlite.prepare("SELECT status FROM research_runs").get()).toEqual({ status: "ready" })
    expect(sqlite.prepare("SELECT project_id FROM source_assets").all()).toEqual([{ project_id: "test-project" }])
  })

  it("records failed model review as a failed run, then permits a new collection", async () => {
    vi.mocked(reviewSourceCandidatesWithModel).mockRejectedValueOnce(new Error("审核服务异常"))
    expect(await (await POST(request())).text()).toContain('"type":"error"')
    expect(sqlite.prepare("SELECT status FROM research_runs").get()).toEqual({ status: "failed" })
    expect(sqlite.prepare("SELECT id FROM source_assets").all()).toEqual([])
    expect(await (await POST(request())).text()).toContain('"type":"complete"')
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM source_assets").get()).toEqual({ count: 1 })
  })

  it("propagates cancellation to search and marks the run cancelled", async () => {
    const controller = new AbortController()
    vi.mocked(searchTavily).mockImplementation((_query, _max, _key, _depth, signal) => new Promise((_resolve, reject) => {
      signal!.addEventListener("abort", () => reject(signal!.reason), { once: true })
    }))
    const response = await POST(request(controller.signal))
    controller.abort()
    expect(await response.text()).toContain("收集已取消")
    expect(sqlite.prepare("SELECT status FROM research_runs").get()).toEqual({ status: "cancelled" })
    expect(reviewSourceCandidatesWithModel).not.toHaveBeenCalled()
  })
})
