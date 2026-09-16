import { isIP } from "node:net"
import { lookup } from "node:dns/promises"
import { parse } from "node-html-parser"

const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain", "metadata.google.internal", "instance-data", "host.docker.internal"])

function blockedIpv4(ip: string) {
  const parts = ip.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b] = parts
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
}

function blockedIpv6(ip: string) {
  const normalized = ip.toLowerCase()
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice(7)
    if (isIP(mapped) === 4) return blockedIpv4(mapped)
  }
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")
}

export function isBlockedAddress(address: string) {
  const version = isIP(address)
  return version === 4 ? blockedIpv4(address) : version === 6 ? blockedIpv6(address) : true
}

export function validatePublicUrl(value: string) {
  let url: URL
  try { url = new URL(value) } catch { throw new Error("URL 格式无效") }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("只允许 http/https URL")
  if (url.username || url.password) throw new Error("URL 不得包含账号信息")
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "")
  if (!hostname || BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) throw new Error("不允许访问本地或内网地址")
  if (isIP(hostname) && isBlockedAddress(hostname)) throw new Error("不允许访问本地或内网地址")
  return url
}

export async function assertPublicUrl(value: string) {
  const url = validatePublicUrl(value)
  if (!isIP(url.hostname)) {
    const addresses = await lookup(url.hostname, { all: true, verbatim: true })
    if (!addresses.length || addresses.some(({ address }) => isBlockedAddress(address))) throw new Error("域名解析到本地或内网地址")
  }
  return url
}

export async function safeFetchText(input: string, fetcher: typeof fetch = fetch) {
  let current = (await assertPublicUrl(input)).toString()
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetcher(current, { redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { "user-agent": "BaoyanPrep/0.1 (+evidence import)" } })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location")
      if (!location) throw new Error("重定向缺少目标地址")
      current = (await assertPublicUrl(new URL(location, current).toString())).toString()
      continue
    }
    if (!response.ok) throw new Error(`页面读取失败：HTTP ${response.status}`)
    const length = Number(response.headers.get("content-length") || 0)
    if (length > 5_000_000) throw new Error("页面超过 5 MB 限制")
    const contentType = response.headers.get("content-type") || ""
    if (!/(text|html|json|xml|markdown)/i.test(contentType)) throw new Error(`不支持的页面类型：${contentType || "未知"}`)
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > 5_000_000) throw new Error("页面超过 5 MB 限制")
    const raw = new TextDecoder().decode(buffer)
    let text = raw
    if (/html/i.test(contentType)) {
      const document = parse(raw)
      document.querySelectorAll("script,style,noscript,svg").forEach((node) => node.remove())
      text = document.textContent
    }
    return { finalUrl: current, contentType, text: String(text).replace(/\s+/g, " ").trim(), status: "success" as const }
  }
  throw new Error("重定向次数过多")
}
