import { NextRequest, NextResponse } from "next/server"
import { ensureWorkspace, workspaceSnapshot } from "@/lib/db"
import { getOrCreateSession, isDemoMode, setSessionCookie } from "@/lib/session"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const { sessionId, isNew } = getOrCreateSession(request)
  const workspace = ensureWorkspace(sessionId)
  const response = NextResponse.json({ workspace, ...workspaceSnapshot(workspace.id), demoMode: isDemoMode(), integrations: {
    tavilyConfigured: Boolean(process.env.TAVILY_API_KEY),
    llmConfigured: Boolean(process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL),
  } })
  if (isNew) setSessionCookie(response, sessionId)
  return response
}
