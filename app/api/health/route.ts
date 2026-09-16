import { sqlite } from "@/lib/db"

export const runtime = "nodejs"

export function GET() {
  try {
    sqlite.prepare("select 1").get()
    return Response.json({ ok: true, storage: "sqlite", mode: process.env.DEMO_MODE === "false" ? "real" : "demo" })
  } catch {
    return Response.json({ ok: false }, { status: 503 })
  }
}
