import "server-only"
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import type { NextRequest, NextResponse } from "next/server"

export const SESSION_COOKIE = "bp_session"

function demoMode() {
  return process.env.DEMO_MODE !== "false"
}

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET
  if (demoMode()) return "demo-only-secret-change-before-real-use"
  throw new Error("真实模式缺少 SESSION_SECRET")
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url")
}

export function verifySessionCookie(raw?: string) {
  if (!raw) return null
  const [value, signature] = raw.split(".")
  if (!value || !signature) return null
  const expected = sign(value)
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null
  return value
}

export function getOrCreateSession(request: NextRequest) {
  const existing = verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value)
  if (existing) return { sessionId: existing, isNew: false }
  return { sessionId: randomBytes(18).toString("base64url"), isNew: true }
}

export function setSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(SESSION_COOKIE, `${sessionId}.${sign(sessionId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
}

export function requireSession(request: NextRequest) {
  const sessionId = verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value)
  if (!sessionId) throw new Error("SESSION_REQUIRED")
  return sessionId
}

export function assertServiceAccess(request: NextRequest) {
  if (demoMode()) return
  const configured = process.env.APP_ACCESS_CODE
  if (!configured) throw new Error("真实模式缺少 APP_ACCESS_CODE")
  const supplied = request.headers.get("x-app-access-code") || ""
  const left = Buffer.from(supplied)
  const right = Buffer.from(configured)
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error("ACCESS_CODE_REQUIRED")
}

export const isDemoMode = demoMode
