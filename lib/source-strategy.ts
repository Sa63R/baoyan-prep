export type TrainingModule = "coding" | "interview" | "project"
export type ResearchDepth = "quick" | "standard" | "deep"
export type EvidenceLevel = "L0" | "L1" | "L2" | "L3" | "L4"
export type ReviewVerdict = "accept" | "reference" | "reject"

export type TargetDescriptor = {
  school: string
  department: string
  program: string
  direction?: string | null
  applicationYear: number
  batch: string
  mentor?: string | null
}

export type SourceCandidate = {
  id?: string
  title: string
  url: string | null
  content: string
  status: string
  origin?: "automatic" | "user"
  sourceType?: string
  tavilyScore?: number
}

export type RuleAssessment = {
  hardReject: boolean
  targetMatch: number
  authority: number
  completeness: number
  temporalMatch: number
  preliminaryScore: number
  likelyModules: TrainingModule[]
  reason: string
  officialTarget: boolean
  snippetOnly: boolean
}

export type ModelSourceReview = {
  index: number
  verdict: ReviewVerdict
  targetMatch: number
  contentType: string
  evidenceLevel: EvidenceLevel
  usableFor: TrainingModule[]
  directness: number
  authority: number
  completeness: number
  year?: number | null
  relevantPassages: string[]
  reason: string
}

export type SourceAssessment = {
  verdict: ReviewVerdict
  qualityScore: number
  targetMatch: number
  evidenceLevel: EvidenceLevel
  contentType: string
  usableFor: TrainingModule[]
  relevantPassages: string[]
  reviewReason: string
  modelReviewed: boolean
}

type SchoolProfile = { canonical: string; aliases: string[]; domains: string[] }

const schoolProfiles: SchoolProfile[] = [
  { canonical: "北京大学", aliases: ["北京大学", "北大", "pku"], domains: ["pku.edu.cn"] },
  { canonical: "清华大学", aliases: ["清华大学", "清华", "thu", "tsinghua"], domains: ["tsinghua.edu.cn"] },
  { canonical: "浙江大学", aliases: ["浙江大学", "浙大", "zju"], domains: ["zju.edu.cn"] },
  { canonical: "上海交通大学", aliases: ["上海交通大学", "上海交大", "上交", "sjtu"], domains: ["sjtu.edu.cn"] },
  { canonical: "复旦大学", aliases: ["复旦大学", "复旦", "fdu"], domains: ["fudan.edu.cn"] },
  { canonical: "南京大学", aliases: ["南京大学", "南大", "nju"], domains: ["nju.edu.cn"] },
  { canonical: "中国科学技术大学", aliases: ["中国科学技术大学", "中国科大", "中科大", "ustc"], domains: ["ustc.edu.cn"] },
  { canonical: "哈尔滨工业大学", aliases: ["哈尔滨工业大学", "哈工大", "hit"], domains: ["hit.edu.cn"] },
  { canonical: "北京航空航天大学", aliases: ["北京航空航天大学", "北航", "buaa"], domains: ["buaa.edu.cn"] },
  { canonical: "北京邮电大学", aliases: ["北京邮电大学", "北邮", "bupt"], domains: ["bupt.edu.cn"] },
  { canonical: "北京师范大学", aliases: ["北京师范大学", "北师大", "bnu"], domains: ["bnu.edu.cn"] },
  { canonical: "北京理工大学", aliases: ["北京理工大学", "北理工", "bit"], domains: ["bit.edu.cn"] },
  { canonical: "南开大学", aliases: ["南开大学", "南开", "nankai"], domains: ["nankai.edu.cn"] },
  { canonical: "天津大学", aliases: ["天津大学", "天大", "tju"], domains: ["tju.edu.cn"] },
  { canonical: "武汉大学", aliases: ["武汉大学", "武大", "whu"], domains: ["whu.edu.cn"] },
  { canonical: "华中科技大学", aliases: ["华中科技大学", "华科", "hust"], domains: ["hust.edu.cn"] },
  { canonical: "西安交通大学", aliases: ["西安交通大学", "西交", "xjtu"], domains: ["xjtu.edu.cn"] },
  { canonical: "中山大学", aliases: ["中山大学", "中大", "sysu"], domains: ["sysu.edu.cn"] },
  { canonical: "中国科学院大学", aliases: ["中国科学院大学", "国科大", "ucas"], domains: ["ucas.ac.cn"] },
]

const moduleTerms: Record<TrainingModule, string[]> = {
  coding: ["机试", "上机", "算法", "编程", "oj", "openjudge", "poj", "真题", "题目", "数据结构", "输入输出"],
  interview: ["面试", "面经", "专业问题", "复试", "问答", "英语", "自我介绍", "考核", "经验", "回忆"],
  project: ["导师", "课题组", "实验室", "研究方向", "论文", "项目", "主页", "科研"],
}

const placeholders = new Set(["", "可选", "不限", "都可以", "无", "暂无", "未确定", "待定"])

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
const normalized = (value: string) => value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "")
const includesAny = (text: string, terms: string[]) => terms.some((term) => term && text.includes(term.toLowerCase()))

export function normalizeSourceUrl(value: string) {
  try {
    const url = new URL(value)
    url.hash = ""
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|spm|from|source|ref)/i.test(key)) url.searchParams.delete(key)
    }
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/"
    return url.toString()
  } catch {
    return value.trim()
  }
}

export function schoolIdentity(school: string) {
  const compact = normalized(school)
  const profile = schoolProfiles.find((item) => item.aliases.some((alias) => compact.includes(normalized(alias)) || normalized(alias).includes(compact)))
  if (profile) return profile
  const trimmed = school.trim()
  const short = trimmed.replace(/大学$|学院$/u, "")
  return { canonical: trimmed, aliases: [...new Set([trimmed, short])].filter(Boolean), domains: [] } satisfies SchoolProfile
}

function safeHost(url: string | null) {
  try { return url ? new URL(url).hostname.toLowerCase() : "" } catch { return "" }
}

function yearRange(targetYear: number) {
  const current = new Date().getFullYear()
  const end = Math.min(Math.max(targetYear, current - 1), current)
  return Array.from({ length: 5 }, (_, index) => end - index)
}

export function buildResearchQueries(target: TargetDescriptor, depth: ResearchDepth) {
  const identity = schoolIdentity(target.school)
  const schoolNames = [...new Set([identity.canonical, ...identity.aliases])].slice(0, 3).join(" ")
  const scope = [schoolNames, target.department, target.program, target.direction].filter(Boolean).join(" ")
  const years = yearRange(target.applicationYear).join(" ")
  const officialSite = identity.domains[0] ? ` site:${identity.domains[0]}` : " site:edu.cn"
  const mentor = target.mentor?.trim() || ""
  const queries = [
    `${scope} ${target.batch} 招生简章 考核办法 机试 上机${officialSite}`,
    `${scope} 机试 上机 真题 回忆 OJ ${years}`,
    `${scope} OpenJudge POJ 算法题 GitHub 历年`,
    `${scope} ${target.batch} 面试 面经 经验 回忆 ${years}`,
    `${scope} 推免 复试 专业问题 知乎 GitHub 博客`,
  ]
  if (!placeholders.has(mentor)) queries.push(`${identity.canonical} ${target.department} ${mentor} 导师 课题组 研究方向 论文 主页`)
  else queries.push(`${identity.canonical} ${target.department} ${target.direction || target.program} 课题组 研究方向 论文 主页`)
  if (depth === "deep") {
    queries.push(`${scope} 机试 site:github.com`)
    queries.push(`${scope} 机试 面试 回忆 site:zhihu.com`)
    queries.push(`${scope} 考核 机试 filetype:pdf${officialSite}`)
  }
  return depth === "quick" ? queries.slice(0, 2) : depth === "standard" ? queries.slice(0, 6) : queries
}

export function assessCandidateRules(candidate: SourceCandidate, target: TargetDescriptor): RuleAssessment {
  const identity = schoolIdentity(target.school)
  const host = safeHost(candidate.url)
  const haystack = `${candidate.title}\n${candidate.content.slice(0, 20_000)}`.toLowerCase()
  const title = candidate.title.toLowerCase()
  const targetAliases = identity.aliases.map((alias) => alias.toLowerCase())
  const officialTarget = identity.domains.some((domain) => host === domain || host.endsWith(`.${domain}`))
  const targetMentioned = includesAny(haystack, targetAliases)
  const departmentTerms = [target.department, target.program, target.direction || ""].map((item) => item.trim().toLowerCase()).filter((item) => item.length >= 2)
  const departmentMatched = includesAny(haystack, departmentTerms)
  const otherProfile = schoolProfiles.find((profile) => profile.canonical !== identity.canonical && (
    profile.domains.some((domain) => host === domain || host.endsWith(`.${domain}`)) ||
    profile.aliases.some((alias) => normalized(title).includes(normalized(alias)))
  ))
  const academicDomain = /(?:\.edu\.cn|\.ac\.cn)$/i.test(host)
  const snippetOnly = candidate.status === "snippet"
  const length = candidate.content.trim().length
  const likelyModules = (Object.keys(moduleTerms) as TrainingModule[]).filter((module) => includesAny(haystack, moduleTerms[module]))

  let targetMatch = officialTarget ? 100 : targetMentioned ? 82 : departmentMatched ? 35 : 8
  if (targetMentioned && departmentMatched) targetMatch = Math.max(targetMatch, 94)
  if (otherProfile && !targetMentioned) targetMatch = 0
  const authority = officialTarget ? 100 : academicDomain ? 52 : /github\.com|openjudge|poj\./i.test(host) ? 68 : 45
  const completeness = snippetOnly ? Math.min(28, length / 8) : clamp(35 + Math.log10(Math.max(length, 100)) * 14)
  const mentionedYears = [...haystack.matchAll(/20\d{2}/g)].map((match) => Number(match[0]))
  const recentYears = yearRange(target.applicationYear)
  const temporalMatch = mentionedYears.some((year) => recentYears.includes(year)) ? 90 : mentionedYears.length ? 52 : 60
  const topical = likelyModules.length ? 90 : 20
  const preliminaryScore = Math.round(targetMatch * 0.42 + authority * 0.18 + completeness * 0.14 + temporalMatch * 0.1 + topical * 0.16)
  const knownForeignAcademicDomain = identity.domains.length > 0 && academicDomain && !officialTarget && !targetMentioned && targetMatch < 20
  const hardReject = length < 20 || Boolean(otherProfile && !targetMentioned) || knownForeignAcademicDomain
  const reason = length < 20
    ? "正文过短"
    : otherProfile && !targetMentioned
      ? `属于其他院校：${otherProfile.canonical}`
      : knownForeignAcademicDomain
        ? "其他院校官网且未匹配当前学校"
        : targetMentioned || officialTarget
          ? "已匹配目标学校，等待语义审核"
          : "目标学校匹配较弱"
  return { hardReject, targetMatch, authority, completeness, temporalMatch, preliminaryScore, likelyModules, reason, officialTarget, snippetOnly }
}

function validatedPassages(passages: string[], content: string) {
  const exact = passages.map((item) => item.trim()).filter((item) => item.length >= 12 && item.length <= 600 && content.includes(item))
  return [...new Set(exact)].slice(0, 4)
}

function capEvidenceLevel(level: EvidenceLevel, contentType: string, snippetOnly: boolean): EvidenceLevel {
  if (snippetOnly) return "L1"
  if (contentType === "official_question") return level
  if (contentType === "candidate_recollection") return level === "L4" ? "L3" : level
  if (contentType === "official_policy" && (level === "L4" || level === "L3")) return "L2"
  if (["generic_reference", "academic_paper", "faculty_research"].includes(contentType) && ["L4", "L3", "L2"].includes(level)) return "L1"
  return level
}

export function finalizeSourceAssessment(candidate: SourceCandidate, rule: RuleAssessment, review?: ModelSourceReview): SourceAssessment {
  if (rule.hardReject) {
    return { verdict: "reject", qualityScore: rule.preliminaryScore, targetMatch: rule.targetMatch, evidenceLevel: "L0", contentType: "unrelated", usableFor: [], relevantPassages: [], reviewReason: rule.reason, modelReviewed: false }
  }
  if (!review) {
    const verdict: ReviewVerdict = rule.preliminaryScore >= 62 ? "accept" : rule.preliminaryScore >= 45 ? "reference" : "reject"
    return {
      verdict,
      qualityScore: rule.preliminaryScore,
      targetMatch: rule.targetMatch,
      evidenceLevel: rule.snippetOnly ? "L1" : rule.officialTarget ? "L2" : "L1",
      contentType: rule.officialTarget ? "official_policy" : "generic_reference",
      usableFor: rule.likelyModules,
      relevantPassages: extractRelevantPassages(candidate.content, [...rule.likelyModules.flatMap((module) => moduleTerms[module])], 3),
      reviewReason: `${rule.reason}；未执行模型审核`,
      modelReviewed: false,
    }
  }
  const targetMatch = Math.round(clamp(review.targetMatch) * 0.72 + rule.targetMatch * 0.28)
  const directness = clamp(review.directness)
  const authority = Math.round(clamp(review.authority) * 0.72 + rule.authority * 0.28)
  const completeness = Math.round(clamp(review.completeness) * 0.72 + rule.completeness * 0.28)
  const topical = review.usableFor.length ? 100 : 15
  const qualityScore = Math.round(targetMatch * 0.3 + directness * 0.22 + authority * 0.16 + rule.temporalMatch * 0.12 + completeness * 0.1 + topical * 0.1)
  const evidenceLevel = capEvidenceLevel(review.evidenceLevel, review.contentType, rule.snippetOnly)
  let verdict = review.verdict
  if (targetMatch < 42 || qualityScore < 42) verdict = "reject"
  else if (qualityScore < 58 || review.verdict === "reference") verdict = "reference"
  return {
    verdict,
    qualityScore,
    targetMatch,
    evidenceLevel,
    contentType: review.contentType,
    usableFor: review.usableFor,
    relevantPassages: validatedPassages(review.relevantPassages, candidate.content),
    reviewReason: review.reason,
    modelReviewed: true,
  }
}

export function chunkText(content: string, targetSize = 1100, overlap = 180) {
  const clean = content.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
  if (!clean) return []
  const paragraphs = clean.split(/\n{2,}|(?<=[。！？；])\s*/u).map((part) => part.trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ""
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 1 > targetSize) {
      chunks.push(current)
      current = `${current.slice(-overlap)}\n${paragraph}`
    } else current = current ? `${current}\n${paragraph}` : paragraph
  }
  if (current) chunks.push(current)
  return chunks.flatMap((chunk) => chunk.length <= targetSize * 1.7 ? [chunk] : Array.from({ length: Math.ceil(chunk.length / targetSize) }, (_, index) => chunk.slice(Math.max(0, index * targetSize - overlap), (index + 1) * targetSize)))
}

export function extractRelevantPassages(content: string, terms: string[], limit = 4) {
  const loweredTerms = [...new Set(terms.map((term) => term.trim().toLowerCase()).filter((term) => term.length >= 2))]
  return chunkText(content).map((chunk, index) => {
    const lower = chunk.toLowerCase()
    const hits = loweredTerms.reduce((count, term) => count + (lower.includes(term) ? 1 : 0), 0)
    const concrete = /(?:20\d{2}|第?\d+[题轮]|机试|上机|真题|回忆|招生|考核|研究方向|论文)/u.test(chunk) ? 2 : 0
    return { chunk, index, score: hits * 3 + concrete }
  }).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit).map((item) => item.chunk)
}

export function sourceTermsForModule(target: TargetDescriptor, module: TrainingModule) {
  const identity = schoolIdentity(target.school)
  return [...identity.aliases, target.department, target.program, target.direction || "", ...moduleTerms[module]].filter(Boolean)
}

export function prepareCandidatePreview(candidate: SourceCandidate, target: TargetDescriptor) {
  const terms = [...sourceTermsForModule(target, "coding"), ...sourceTermsForModule(target, "interview"), ...sourceTermsForModule(target, "project")]
  const passages = extractRelevantPassages(candidate.content, terms, 5)
  return passages.join("\n\n---\n\n").slice(0, 7000) || candidate.content.slice(0, 7000)
}

export function selectSourcesForGeneration<T extends SourceCandidate & { assessment?: SourceAssessment }>(sources: T[], target: TargetDescriptor, module: TrainingModule, limit = 16) {
  const terms = sourceTermsForModule(target, module)
  return sources.map((source) => {
    const rule = assessCandidateRules(source, target)
    const assessment = source.assessment
    // User-provided material may omit the school name or use private shorthand.
    // It must still reach semantic review instead of being discarded by URL/text rules.
    if ((rule.hardReject && source.origin !== "user") || assessment?.verdict === "reject") return null
    if (assessment?.usableFor.length && !assessment.usableFor.includes(module) && source.origin !== "user") return null
    const modelPassages = (assessment?.relevantPassages || []).filter((passage) => source.content.includes(passage))
    const passages = [...new Set([...modelPassages, ...extractRelevantPassages(source.content, terms, 4)])].slice(0, 4)
    const lower = passages.join("\n").toLowerCase()
    const termHits = terms.reduce((count, term) => count + (lower.includes(term.toLowerCase()) ? 1 : 0), 0)
    const baseQuality = assessment?.qualityScore ?? rule.preliminaryScore
    const moduleBoost = assessment?.usableFor.includes(module) ? 18 : 0
    const userBoost = source.origin === "user" ? 12 : 0
    const evidenceBoost = assessment ? Number(assessment.evidenceLevel.slice(1)) * 4 : 0
    const content = passages.join("\n\n--- 相关片段 ---\n\n").slice(0, 5200) || (source.origin === "user" ? source.content.slice(0, 5200) : "")
    return { source, score: baseQuality + Math.min(termHits * 2, 22) + moduleBoost + userBoost + evidenceBoost, content }
  }).filter((item): item is NonNullable<typeof item> => Boolean(item && item.content)).sort((a, b) => b.score - a.score).slice(0, limit).map(({ source, content }) => ({ ...source, content }))
}
