"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle, ArrowRight, BookOpen, BrainCircuit, Check, CheckCircle2, Clock3, Code2,
  Download, ExternalLink, FilePlus2, FileText, FolderSearch2, Link2, LoaderCircle, LockKeyhole,
  MessageSquareText, Play, RefreshCw, RotateCcw, Save, Search, Send, ShieldCheck, Sparkles,
  Target, Upload, UserRoundCheck, XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

type ActiveView = "overview" | "coding" | "interview" | "project" | "sources"

type ReviewState = { loading: boolean; error: string; feedback: string; modelCalled: boolean; recordId?: string }
const emptyReview: ReviewState = { loading: false, error: "", feedback: "", modelCalled: false }

async function requestJson(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  const accessCode = typeof window !== "undefined" ? sessionStorage.getItem("baoyan-access-code") : ""
  if (accessCode) headers.set("x-app-access-code", accessCode)
  const response = await fetch(url, { ...init, headers })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `请求失败：HTTP ${response.status}`)
  return payload
}

function FeedbackCard({ state, onRetest }: { state: ReviewState; onRetest?: () => void }) {
  if (!state.loading && !state.error && !state.feedback) return null
  if (state.loading) return <div className="feedback-card loading"><LoaderCircle className="spin" /><div><strong>正在整理反馈</strong><p>会引用你的实际回答，不会把 AI 审查当作判题。</p></div></div>
  if (state.error) return <div className="feedback-card error"><XCircle /><div><strong>反馈未生成</strong><p>{state.error}</p></div></div>
  return (
    <div className="feedback-card success">
      <div className="feedback-head"><span><BrainCircuit />具体反馈</span><Badge variant="outline">{state.modelCalled ? "模型生成" : "固定演示 · 未调用模型"}</Badge></div>
      <div className="feedback-copy">{state.feedback.split("\n").map((line) => <p key={line}>{line}</p>)}</div>
      {onRetest && <Button variant="outline" onClick={onRetest}><RotateCcw />换一种问法复测</Button>}
    </div>
  )
}

function ViewHeader({ icon: Icon, eyebrow, title, description, action }: { icon: typeof Target; eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="content-head training-head">
      <div><div className="eyebrow"><Icon />{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
      {action && <div className="head-actions">{action}</div>}
    </div>
  )
}

function useReview() {
  const [state, setState] = useState<ReviewState>(emptyReview)
  const submit = async (input: { module: "coding" | "interview" | "project"; itemId: string; question: string; answer: string; evidenceIds: string[]; resultKind?: "self_reported" | "ai_review"; result?: string; retestOf?: string }) => {
    if (!input.answer.trim()) { setState({ ...emptyReview, error: "请先写下你的真实回答。" }); return }
    setState({ ...emptyReview, loading: true })
    try {
      const payload = await requestJson("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) })
      setState({ loading: false, error: "", feedback: payload.feedback, modelCalled: payload.modelCalled, recordId: payload.record.id })
    } catch (error) { setState({ ...emptyReview, error: error instanceof Error ? error.message : "反馈失败" }) }
  }
  return { state, submit, reset: () => setState(emptyReview) }
}

function OverviewView() {
  const stages = [
    ["调查档案", "6 / 9 字段已核实", 67, true], ["机试训练", "1 道原创演示题可作答", 25, true],
    ["专业面试", "3 轮模拟待开始", 0, false], ["项目追问", "简历事实待确认", 0, false],
  ] as const
  return (
    <>
      <ViewHeader icon={Target} eyebrow="目标概览" title="一条可追溯的准备路径" description="从目标范围开始，所有训练都能回到来源、回答和复测记录。" />
      <div className="overview-hero">
        <div><span>当前目标</span><h2>虚构理工大学 · 计算机学院</h2><p>智能科学与技术 · 学硕 · 2027 入学 · 夏令营</p></div>
        <div className="coverage-ring"><strong>67%</strong><span>调查覆盖</span></div>
      </div>
      <div className="stage-grid">
        {stages.map(([title, detail, value, ready], index) => <article key={title}>
          <div className="stage-index">0{index + 1}</div><Badge variant={ready ? "default" : "secondary"}>{ready ? "可继续" : "待补充"}</Badge>
          <h3>{title}</h3><p>{detail}</p><Progress value={value} />
        </article>)}
      </div>
      <div className="gap-banner"><AlertTriangle /><div><strong>下一步最有价值</strong><p>补充机试语言与时长的最新官方通知；在此之前，练习默认值不会被写成学校规则。</p></div></div>
    </>
  )
}

function CodingView({ openEvidence }: { openEvidence: (id: string) => void }) {
  const [code, setCode] = useState(`// 原创演示题：可信路径\n#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n  // 在这里完成你的解法\n  return 0;\n}`)
  const [seconds, setSeconds] = useState(90 * 60)
  const [running, setRunning] = useState(false)
  const review = useReview()
  useEffect(() => {
    if (!running || seconds <= 0) return
    const timer = window.setInterval(() => setSeconds((value) => value - 1), 1000)
    return () => window.clearInterval(timer)
  }, [running, seconds])
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
  const question = "给定一个含非负边权的有向图，求从起点到所有节点的最短距离；不可达输出 -1。"
  const saveDraft = () => { localStorage.setItem("baoyan-coding-draft", code); toast.success("草稿已保存在当前浏览器") }
  return (
    <>
      <ViewHeader icon={Code2} eyebrow="第一关 · 机试训练" title="把“可能考”变成可验证的能力" description="历史来源与推荐练习分开；本题为原创演示变式，不冒充真题。" action={<Button variant="outline" onClick={() => setRunning(!running)}><Clock3 />{running ? "暂停" : "开始"} {time}</Button>} />
      <div className="module-layout">
        <section className="module-card problem-panel">
          <div className="module-card-head"><div><Badge>generated · 原创</Badge><span>图论 · 最短路</span></div><Badge variant="outline">练习难度：中等</Badge></div>
          <h2>可信路径</h2>
          <p>{question}</p>
          <div className="problem-callout"><strong>为什么推荐</strong><p>一份 2025 年个人回忆提及图搜索，仅作为训练主题线索，不代表 2027 年考题。</p><button onClick={() => openEvidence("E02")}>查看 [E02] 原文</button></div>
          <h3>输入与输出</h3><p>第一行 n、m、s。随后 m 行为 u、v、w。输出 n 个整数。</p>
          <div className="sample-grid"><pre><span>输入</span>{`5 6 1\n1 2 2\n1 3 5\n2 3 1\n2 4 4\n3 5 3\n4 5 1`}</pre><pre><span>输出</span>{`0 2 3 6 6`}</pre></div>
          <details><summary>查看经过测试的参考思路</summary><p>使用邻接表与 Dijkstra。弹出堆顶时跳过过期距离；总复杂度 O((n+m)log n)。完整参考代码在提交或自报结果后才建议查看。</p></details>
        </section>
        <section className="module-card editor-panel">
          <div className="editor-toolbar"><span>C++17 · 仅保存与审查，不在服务器执行</span><div><Button size="sm" variant="ghost" onClick={saveDraft}><Save />保存</Button></div></div>
          <Textarea aria-label="代码编辑器" value={code} onChange={(event) => setCode(event.target.value)} className="code-editor" spellCheck={false} />
          <div className="editor-actions">
            <Button variant="outline" onClick={() => window.open("https://www.luogu.com.cn/problem/list", "_blank", "noopener,noreferrer")}><ExternalLink />前往公开 OJ</Button>
            <Button variant="outline" onClick={() => review.submit({ module: "coding", itemId: "generated-trust-path", question, answer: code, evidenceIds: ["E02"], resultKind: "self_reported", result: "AC" })}><CheckCircle2 />自报 OJ 已通过</Button>
            <Button onClick={() => review.submit({ module: "coding", itemId: "generated-trust-path", question, answer: code, evidenceIds: ["E02"], resultKind: "ai_review", result: "AI_REVIEW_ONLY" })}><Sparkles />AI 代码审查</Button>
          </div>
          <p className="judging-note"><ShieldCheck />自报结果标记 self_reported；AI 审查标记 ai_review，绝不会显示为沙箱 AC。</p>
        </section>
      </div>
      <FeedbackCard state={review.state} onRetest={() => { review.reset(); setCode((value) => `${value}\n// 复测：说明边权为 0 时的正确性`) }} />
    </>
  )
}

const interviewQuestions = [
  "请解释事务的隔离性，并说明可重复读与串行化的区别。",
  "如果一个查询在并发写入时出现幻读，你会如何复现并定位？",
  "在吞吐量与一致性之间必须取舍时，你会先确认哪些业务约束？",
]

function InterviewView({ openEvidence }: { openEvidence: (id: string) => void }) {
  const [mode, setMode] = useState("learn")
  const [round, setRound] = useState(0)
  const [answer, setAnswer] = useState("")
  const review = useReview()
  const submitted = Boolean(review.state.feedback)
  const submit = () => review.submit({ module: "interview", itemId: `db-isolation-${round + 1}`, question: interviewQuestions[round], answer, evidenceIds: ["E02"] })
  const next = () => { setRound((value) => Math.min(value + 1, interviewQuestions.length - 1)); setAnswer(""); review.reset() }
  return (
    <>
      <ViewHeader icon={MessageSquareText} eyebrow="第二关 · 专业与综合面试" title="从会背，练到会解释" description="一次 3 轮：先回答，再得到基于实际措辞的反馈和追问。" />
      <div className="mode-switch"><Button variant={mode === "learn" ? "default" : "outline"} onClick={() => setMode("learn")}><BookOpen />学习模式</Button><Button variant={mode === "exam" ? "default" : "outline"} onClick={() => setMode("exam")}><Play />试卷模式</Button><span>第 {round + 1} / {interviewQuestions.length} 轮</span></div>
      <div className="interview-grid">
        <section className="module-card question-panel">
          <div className="module-card-head"><div><Badge variant="outline">数据库系统</Badge><span>专业面试</span></div><button className="citation" onClick={() => openEvidence("E02")}><Link2 />训练范围依据 [E02]</button></div>
          <p className="question-number">QUESTION 0{round + 1}</p><h2>{interviewQuestions[round]}</h2>
          {mode === "learn" && <div className="prep-reason"><strong>准备理由</strong><p>考查概念边界、机制理解与工程取舍。历史经历只说明“有人被追问过项目依据”，答案正确性来自教材知识，不混作同一证据。</p></div>}
          <Textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="用自己的话回答。建议包含：定义 → 机制 → 例子 → 边界……" className="answer-box" />
          <div className="question-actions"><Button onClick={submit} disabled={review.state.loading}><Send />提交本轮回答</Button>{submitted && round < interviewQuestions.length - 1 && <Button variant="outline" onClick={next}>进入追问 <ArrowRight /></Button>}</div>
          {mode === "exam" && !submitted && <p className="hidden-answer"><LockKeyhole />试卷模式：提交前不显示回答要点。</p>}
          {(mode === "learn" || submitted) && <details className="answer-points" open={submitted}><summary>回答要点与常见错误</summary><ul><li>隔离级别约束不同并发异常，不等同于锁的某一种实现。</li><li>可重复读保证同一事务内已读行稳定；串行化要求效果等价于串行执行。</li><li>常见错误：只背四个级别，不解释具体异常与实现差异。</li></ul></details>}
        </section>
        <aside className="round-rail"><h3>本轮路径</h3>{interviewQuestions.map((item, index) => <div key={item} className={index < round ? "done" : index === round ? "current" : ""}><span>{index < round ? <Check /> : index + 1}</span><p>{index === 0 ? "基础解释" : index === 1 ? "故障追问" : "工程取舍"}</p></div>)}</aside>
      </div>
      <FeedbackCard state={review.state} onRetest={() => { review.reset(); setAnswer(""); toast.info("已保留同一知识点，改用故障场景复测") }} />
    </>
  )
}

function ProjectView({ openEvidence }: { openEvidence: (id: string) => void }) {
  const [resume, setResume] = useState("课程项目：实现一个面向校园问答的检索系统。\n本人职责：整理 800 条脱敏问答，完成 BM25 基线与离线评估。\n已提供结果：Recall@10 为 0.72；未进行线上 A/B 测试。")
  const [confirmed, setConfirmed] = useState(false)
  const [answer, setAnswer] = useState("")
  const [retest, setRetest] = useState(false)
  const review = useReview()
  const question = retest ? "如果数据分布发生变化，你会如何监控检索质量，并证明告警有效？" : "为什么选择 Recall@10？如果换成 MRR，结论可能怎样变化？"
  return (
    <>
      <ViewHeader icon={UserRoundCheck} eyebrow="第三关 · 项目追问" title="只追问你真正做过的部分" description="简历事实与导师公开研究分别引用；关联弱时会坦白，不硬蹭关键词。" />
      <div className="project-source-grid">
        <section className="module-card"><div className="source-card-title"><FileText /><div><strong>简历原文片段</strong><span>虚构示例 · 用户待确认</span></div></div><Textarea value={resume} onChange={(event) => { setResume(event.target.value); setConfirmed(false) }} className="resume-box" /><label className="confirm-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>我确认职责、技术方案和指标没有被系统补写</span></label></section>
        <section className="module-card"><div className="source-card-title"><FolderSearch2 /><div><strong>导师研究证据</strong><span>公开研究 · 演示来源</span></div></div><blockquote>“研究关注数据质量评估，以及机器学习系统中的失效分析。”</blockquote><button className="citation" onClick={() => openEvidence("E03")}><Link2 />[E03] 研究方向 · 第 2 项</button><div className="relation-level"><span>技术关联</span><Badge variant="outline">中等</Badge><p>可讨论评估与失效分析；与导师具体项目的关联未知。</p></div></section>
      </div>
      <section className="module-card project-question">
        <div className="module-card-head"><div><Badge>基于公开研究的模拟追问</Badge></div><span>不代表该导师一定参与考核</span></div>
        <h2>{question}</h2>
        <div className="fact-boundary"><span><CheckCircle2 />已提供：800 条数据、BM25、Recall@10=0.72</span><span><AlertTriangle />尚未提供：误差分桶、延迟、对照实验</span></div>
        <Textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="请按‘选择依据—替代方案—实验限制—下一步验证’回答，不要补写没做过的实验。" className="answer-box" />
        <Button disabled={!confirmed || review.state.loading} onClick={() => review.submit({ module: "project", itemId: retest ? "resume-eval-retest" : "resume-eval", question, answer: `${resume}\n\n用户回答：${answer}`, evidenceIds: ["E03"], retestOf: retest ? undefined : review.state.recordId })}><Send />提交项目回答</Button>
        {!confirmed && <p className="hidden-answer"><LockKeyhole />请先确认简历事实，再开始追问。</p>}
      </section>
      <FeedbackCard state={review.state} onRetest={() => { setRetest(true); setAnswer(""); review.reset() }} />
    </>
  )
}

function SourcesView() {
  const [query, setQuery] = useState("虚构理工大学 计算机学院 2027 夏令营")
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("脱敏经验记录")
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [accessCode, setAccessCode] = useState("")
  const [busy, setBusy] = useState("")
  const [result, setResult] = useState<{ kind: string; status: string; message: string } | null>(null)

  const run = async (kind: string, action: () => Promise<unknown>) => {
    setBusy(kind); setResult(null)
    try { const payload = await action() as Record<string, unknown>; setResult({ kind, status: String(payload.status || "success"), message: String(payload.message || (payload.simulated ? "演示结果已返回，未调用真实服务" : "已保存到当前工作区")) }) }
    catch (error) { setResult({ kind, status: "failed", message: error instanceof Error ? error.message : "操作失败" }) }
    finally { setBusy("") }
  }
  return (
    <>
      <ViewHeader icon={Search} eyebrow="资料与来源" title="先拿到原文，再提取证据" description="搜索摘要只用于发现线索；URL 导入会读取正文，失败与部分成功都会明确保留。" action={<Button nativeButton={false} render={<a href="/api/export" />} variant="outline"><Download />导出 Markdown</Button>} />
      <div className="access-strip"><LockKeyhole /><div><strong>真实服务访问码</strong><p>仅保护额度入口，不是 LLM 或 Tavily 密钥；演示模式可留空。</p></div><Input type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="APP_ACCESS_CODE" /><Button variant="outline" onClick={() => { sessionStorage.setItem("baoyan-access-code", accessCode); toast.success("访问码仅保存在当前标签页") }}>保存</Button></div>
      <section className="search-box"><div><Search /><Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="目标搜索词" /></div><Button disabled={busy === "search"} onClick={() => run("search", () => requestJson("/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }) }))}>{busy === "search" ? <LoaderCircle className="spin" /> : <Sparkles />}自动调查</Button><p>预算上限：10 次搜索 / 20 个页面。演示模式仅返回虚构内部来源。</p></section>
      <Tabs defaultValue="url" className="source-tabs">
        <TabsList><TabsTrigger value="url"><Link2 />公开 URL</TabsTrigger><TabsTrigger value="paste"><FilePlus2 />粘贴文字</TabsTrigger><TabsTrigger value="upload"><Upload />上传文件</TabsTrigger></TabsList>
        <TabsContent value="url"><section className="module-card import-card"><h2>读取公开网页</h2><p>仅允许 http/https；阻止本地、内网、元数据地址及重定向绕过。</p><Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://学校官网/通知页面" /><Button disabled={!url || busy === "url"} onClick={() => run("url", () => requestJson("/api/import/url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) }))}>{busy === "url" ? <LoaderCircle className="spin" /> : <ArrowRight />}读取并保存正文</Button></section></TabsContent>
        <TabsContent value="paste"><section className="module-card import-card"><h2>导入脱敏文字</h2><p>适合有权提供的群聊、个人笔记或无法自动抓取的页面。</p><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="来源标题" /><Textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="粘贴至少 20 个字符；请先移除姓名、电话、账号等隐私……" /><Button disabled={text.length < 20 || busy === "paste"} onClick={() => run("paste", () => requestJson("/api/import/text", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, text, kind: "用户粘贴" }) }))}>{busy === "paste" ? <LoaderCircle className="spin" /> : <Save />}私密保存</Button></section></TabsContent>
        <TabsContent value="upload"><section className="module-card import-card"><h2>上传 PDF、TXT 或 Markdown</h2><p>最大 5 MB。扫描件若无法可靠提取，会请求文字或人工确认，不假装成功。</p><label className="file-drop"><Upload /><strong>{file ? file.name : "选择文件"}</strong><span>{file ? `${Math.ceil(file.size / 1024)} KB` : "PDF / TXT / MD"}</span><input type="file" accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label><Button disabled={!file || busy === "file"} onClick={() => run("file", async () => { const form = new FormData(); form.set("file", file!); return requestJson("/api/import/file", { method: "POST", body: form }) })}>{busy === "file" ? <LoaderCircle className="spin" /> : <Upload />}上传并提取</Button></section></TabsContent>
      </Tabs>
      {result && <div className={`import-result ${result.status}`}><span>{result.status === "failed" ? <XCircle /> : result.status === "partial" ? <AlertTriangle /> : <CheckCircle2 />}</span><div><strong>{result.status === "failed" ? "失败" : result.status === "partial" ? "部分完成" : "已完成"}</strong><p>{result.message}</p></div>{result.status === "failed" && <Button variant="outline" onClick={() => setResult(null)}><RefreshCw />重试</Button>}</div>}
      <div className="source-status-grid"><article><span className="source-type official">官</span><div><strong>演示招生说明</strong><p>已读取全文 · 摘录可定位</p></div><Badge>success</Badge></article><article><span className="source-type experience">经</span><div><strong>2025 营员复盘</strong><p>个人回忆 · 待交叉核实</p></div><Badge variant="outline">needs review</Badge></article><article><span className="source-type blocked">限</span><div><strong>受限页面示例</strong><p>未绕过登录 · 等待用户提供</p></div><Badge variant="secondary">restricted</Badge></article></div>
      <section className="danger-zone"><div><strong>删除当前工作区</strong><p>永久删除本会话的数据库记录和上传文件；不会影响其他会话。</p></div><Button variant="destructive" onClick={async () => { if (!window.confirm("确定删除当前工作区及其上传文件吗？此操作不可恢复。")) return; try { await requestJson("/api/workspace", { method: "DELETE" }); window.location.reload() } catch (error) { toast.error(error instanceof Error ? error.message : "删除失败") } }}>删除数据</Button></section>
    </>
  )
}

export function TrainingView({ active, openEvidence }: { active: ActiveView; openEvidence: (id: string) => void }) {
  if (active === "overview") return <OverviewView />
  if (active === "coding") return <CodingView openEvidence={openEvidence} />
  if (active === "interview") return <InterviewView openEvidence={openEvidence} />
  if (active === "project") return <ProjectView openEvidence={openEvidence} />
  return <SourcesView />
}
