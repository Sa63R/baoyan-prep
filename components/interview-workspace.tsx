"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Archive, ArrowLeft, BookOpenText, Bot, ChevronDown, Code2, Download, ExternalLink, FileText,
  FolderOpen, GraduationCap, KeyRound, LoaderCircle, PanelLeftClose, PanelLeftOpen,
  MoreHorizontal, Pencil, Pin, PinOff, Plus, RefreshCw, Search, Settings2, Sparkles, Trash2, Upload, UserRoundSearch, X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import styles from "./interview-workspace.module.css"

type Module = "coding" | "interview" | "project"
type Project = { id: string; name: string; school: string; pinnedAt: string | null; updatedAt: string }
type Target = { id: string; projectId: string; department: string; program: string; direction: string | null; applicationYear: number; batch: "夏令营" | "预推免"; mentor: string | null; customFields: Record<string, string>; isActive: boolean }
type Source = { id: string; projectId: string; origin: "automatic" | "user"; title: string; url: string | null; mimeType: string | null; content: string; status: string; confidence: "high" | "medium" | "low"; sourceType: string; fetchedAt: string; targetIds: string[] }
type Question = { id: string; position: number; theme: string; question: string; summary: string | null; url: string | null; kind: string; tags: string[]; evidenceIds: string[] }
type Version = { id: string; projectId: string; targetId: string; module: Module; title: string; createdAt: string; sourceSnapshot: { id: string; title: string; url: string | null }[]; items: Question[] }
type Resume = { id: string; filename: string | null; content: string; createdAt: string }
type Faculty = { id: string; projectId: string; targetId: string; kind: "faculty" | "group"; name: string; homepage: string | null; description: string | null }
type ResearchRun = { id: string; projectId: string; targetId: string | null; depth: string; status: string; sourceCount: number; detail: string | null; updatedAt: string }
type Snapshot = { projects: Project[]; targets: Target[]; sources: Source[]; versions: Version[]; resume: Resume | null; faculty: Faculty[]; runs: ResearchRun[] }
type Runtime = { demoMode: boolean; integrations: { llmConfigured: boolean; tavilyConfigured: boolean } }

const moduleMeta: Record<Module, { label: string; short: string; eyebrow: string; description: string; icon: typeof Code2 }> = {
  coding: { label: "机试", short: "第一关", eyebrow: "第一关 · 机试", description: "基于目标院校资料生成套卷，题面回到原站，站内完成代码梳理与一次性复盘。", icon: Code2 },
  interview: { label: "面试题单", short: "第二关", eyebrow: "第二关 · 面试题单", description: "从高频主题到具体问法，只保留问题与可追溯依据。", icon: BookOpenText },
  project: { label: "项目追问", short: "第三关", eyebrow: "第三关 · 项目追问", description: "结合当前简历与导师或课题组公开研究方向，生成有针对性的追问题单。", icon: UserRoundSearch },
}

const kindLabel: Record<string, string> = {
  official_past: "官方真题", official_sample: "官方样题", recalled_past: "回忆题", recommended_practice: "证据推断", generated: "AI 补充",
}

const codeTemplates = {
  "C++": "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n\n  return 0;\n}",
  Python: "import sys\n\ndef solve():\n    pass\n\nif __name__ == \"__main__\":\n    solve()",
  Java: "import java.io.*;\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        // write your solution here\n    }\n}",
}

function jsonHeaders(extra?: Record<string, string>) {
  const headers: Record<string, string> = { "content-type": "application/json", ...extra }
  const access = sessionStorage.getItem("baoyan-access-code")
  const deepseek = localStorage.getItem("baoyan-deepseek-key")
  const tavily = localStorage.getItem("baoyan-tavily-key")
  if (access) headers["x-app-access-code"] = access
  if (deepseek) headers["x-deepseek-api-key"] = deepseek
  if (tavily) headers["x-tavily-api-key"] = tavily
  return headers
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `请求失败：HTTP ${response.status}`)
  return payload as T
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className={styles.toggle}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span><i /></span><em>{label}</em></label>
}

function Select({ value, onChange, label, children }: { value: string; onChange: (value: string) => void; label: string; children: React.ReactNode }) {
  return <label className={styles.select}><span className="sr-only">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select><ChevronDown /></label>
}

export function InterviewWorkspace() {
  const [runtime, setRuntime] = useState<Runtime | null>(null)
  const [data, setData] = useState<Snapshot | null>(null)
  const [active, setActive] = useState<Module>("coding")
  const [collapsed, setCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [projectId, setProjectId] = useState("")
  const [targetId, setTargetId] = useState("")
  const [model, setModel] = useState<"deepseek-flash" | "deepseek-v4-pro">("deepseek-flash")
  const [thinking, setThinking] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [researching, setResearching] = useState(false)
  const [versionChoice, setVersionChoice] = useState<Partial<Record<Module, string>>>({})
  const [evidenceIds, setEvidenceIds] = useState<string[] | null>(null)
  const [projectDialog, setProjectDialog] = useState<"new-project" | "new-target" | "edit-target" | null>(null)
  const [materialsOpen, setMaterialsOpen] = useState(false)
  const [apiOpen, setApiOpen] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [projectActionBusy, setProjectActionBusy] = useState<string | null>(null)
  const [deepseekKey, setDeepseekKey] = useState("")
  const [tavilyKey, setTavilyKey] = useState("")
  const [customPrompt, setCustomPrompt] = useState("")

  const load = async () => {
    const snapshot = await requestJson<Snapshot>("/api/workbench", { cache: "no-store" })
    setData(snapshot)
    setProjectId((current) => snapshot.projects.some((item) => item.id === current) ? current : snapshot.projects[0]?.id || "")
  }

  useEffect(() => {
    requestJson<Runtime>("/api/bootstrap", { cache: "no-store" })
      .then(async (state) => { setRuntime(state); await load() })
      .catch((error) => toast.error(error instanceof Error ? error.message : "工作台加载失败"))
    const timer = window.setTimeout(() => {
      setDeepseekKey(localStorage.getItem("baoyan-deepseek-key") || "")
      setTavilyKey(localStorage.getItem("baoyan-tavily-key") || "")
      setCustomPrompt(localStorage.getItem("baoyan-workbench-prompt") || "")
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const currentProject = data?.projects.find((item) => item.id === projectId) || null
  const projectTargets = useMemo(() => data?.targets.filter((item) => item.projectId === projectId) || [], [data, projectId])

  const selectedTargetId = projectTargets.some((item) => item.id === targetId) ? targetId : projectTargets.find((item) => item.isActive)?.id || projectTargets[0]?.id || ""
  const currentTarget = projectTargets.find((item) => item.id === selectedTargetId) || null
  const moduleVersions = useMemo(() => (data?.versions || []).filter((item) => item.projectId === projectId && item.targetId === selectedTargetId && item.module === active), [data, projectId, selectedTargetId, active])
  const currentVersion = moduleVersions.find((item) => item.id === versionChoice[active]) || moduleVersions[0] || null
  const projectSources = useMemo(() => (data?.sources || []).filter((item) => item.projectId === projectId), [data, projectId])
  const currentFaculty = data?.faculty.find((item) => item.targetId === selectedTargetId) || null

  const selectTarget = async (next: string) => {
    setTargetId(next)
    try { await requestJson("/api/workbench", { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ action: "activateTarget", projectId, targetId: next }) }) } catch { /* keep local selection */ }
  }

  const generate = async () => {
    if (!projectId || !selectedTargetId) return toast.error("请先创建申请目标")
    setGenerating(true)
    try {
      const result = await requestJson<{ versionId: string; count: number }>("/api/generate", { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ projectId, targetId: selectedTargetId, module: active, model, thinkingEnabled: thinking, customPrompt }) })
      setVersionChoice((current) => ({ ...current, [active]: result.versionId }))
      await load()
      toast.success(`已生成 ${result.count} 道问题`)
    } catch (error) { const message = error instanceof Error ? error.message : "生成失败"; toast.error(message); if (message.includes("Key") || message.includes("密钥")) setApiOpen(true) }
    finally { setGenerating(false) }
  }

  const clearCurrent = async () => {
    if (!currentVersion || !window.confirm("删除当前题单版本？资料库和其他版本不会受影响。")) return
    try { await requestJson(`/api/workbench?type=version&id=${encodeURIComponent(currentVersion.id)}`, { method: "DELETE", headers: jsonHeaders() }); await load(); toast.success("当前版本已删除") }
    catch (error) { toast.error(error instanceof Error ? error.message : "删除失败") }
  }

  const setProjectPinned = async (project: Project) => {
    setProjectActionBusy(project.id)
    try {
      await requestJson("/api/workbench", { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ action: "setProjectPinned", projectId: project.id, pinned: !project.pinnedAt }) })
      await load()
      toast.success(project.pinnedAt ? "已取消置顶" : "项目已置顶")
    } catch (error) { toast.error(error instanceof Error ? error.message : "操作失败") }
    finally { setProjectActionBusy(null) }
  }

  const deleteProject = async (project: Project) => {
    if (!window.confirm(`将删除“${project.name}”下的全部申请目标、资料和题单。建议先在资料库导出 ZIP。是否继续？`)) return
    if (!window.confirm("此操作不可恢复，确认彻底删除？")) return
    setProjectActionBusy(project.id)
    try {
      await requestJson(`/api/workbench?type=project&id=${encodeURIComponent(project.id)}`, { method: "DELETE", headers: jsonHeaders() })
      await load()
      setProjectDialog(null)
      setMaterialsOpen(false)
      setMobileSidebarOpen(false)
      toast.success("备考项目已删除")
    } catch (error) { toast.error(error instanceof Error ? error.message : "删除失败") }
    finally { setProjectActionBusy(null) }
  }

  const saveKeys = () => {
    if (deepseekKey.trim()) localStorage.setItem("baoyan-deepseek-key", deepseekKey.trim()); else localStorage.removeItem("baoyan-deepseek-key")
    if (tavilyKey.trim()) localStorage.setItem("baoyan-tavily-key", tavilyKey.trim()); else localStorage.removeItem("baoyan-tavily-key")
    setApiOpen(false); toast.success("密钥已保存在当前浏览器")
  }

  const navItems = Object.keys(moduleMeta) as Module[]
  const ActiveIcon = moduleMeta[active].icon
  if (!data) return <div className={styles.loading}><LoaderCircle /><span>正在整理你的备考工作台…</span></div>

  return (
    <div className={`${styles.shell} ${collapsed ? styles.shellCollapsed : ""}`}>
      {mobileSidebarOpen && <button className={styles.mobileSideBackdrop} onClick={() => setMobileSidebarOpen(false)} aria-label="关闭侧边栏" />}
      <aside className={`${styles.sidebar} ${mobileSidebarOpen ? styles.mobileSidebarOpen : ""}`}>
        <div className={styles.sideBrand}><span><GraduationCap /></span>{!collapsed && <strong>循证保研</strong>}<button className={styles.mobileSideClose} onClick={() => setMobileSidebarOpen(false)} aria-label="关闭侧边栏"><X /></button></div>
        {data.projects.length > 0 && <button className={styles.sideNewProject} onClick={() => { setMobileSidebarOpen(false); setProjectDialog("new-project") }} title="新建备考项目"><Plus /><span>新建项目</span></button>}
        <section className={styles.projectSection}>
          {!collapsed && <p>项目</p>}
          <div className={styles.projectList}>{data.projects.map((item) => <div key={item.id} className={`${styles.projectRow} ${projectId === item.id ? styles.activeProject : ""}`}>
            <button className={styles.projectSelect} onClick={() => { setProjectId(item.id); setMobileSidebarOpen(false) }} title={item.name}><b>{item.school.slice(0, 1)}</b><span>{item.name}</span>{item.pinnedAt && <Pin className={styles.pinnedMark} />}</button>
            <DropdownMenu>
              <DropdownMenuTrigger className={styles.projectMenuButton} aria-label={`${item.name}项目操作`} disabled={projectActionBusy === item.id}><MoreHorizontal /></DropdownMenuTrigger>
              <DropdownMenuContent className={styles.projectMenu} align="end" side="right" sideOffset={6}>
                <DropdownMenuItem onClick={() => setProjectPinned(item)}>{item.pinnedAt ? <PinOff /> : <Pin />}{item.pinnedAt ? "取消置顶" : "置顶"}</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => deleteProject(item)}><Trash2 />删除</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>)}</div>
        </section>
        <section className={styles.moduleSection}>
          {!collapsed && <p>三关</p>}
          <nav>{navItems.map((item) => { const Icon = moduleMeta[item].icon; return <button key={item} className={active === item ? styles.activeNav : ""} onClick={() => { setActive(item); setMobileSidebarOpen(false) }} title={moduleMeta[item].label}><Icon /><span>{moduleMeta[item].label}</span></button> })}</nav>
        </section>
        <button className={styles.collapseButton} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}<span>收起侧栏</span></button>
      </aside>

      <main className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.mobileBrand}>{data.projects.length > 0 && <button onClick={() => setMobileSidebarOpen(true)} aria-label="打开项目侧边栏"><PanelLeftOpen /></button>}<GraduationCap /><strong>{currentProject?.name || "循证保研"}</strong></div>
          {currentProject && currentTarget && <div className={styles.contextControls}>
            <Select label="申请目标" value={selectedTargetId} onChange={selectTarget}>{projectTargets.map((item) => <option key={item.id} value={item.id}>{item.department} · {item.program}</option>)}</Select>
            <button className={styles.squareButton} onClick={() => setProjectDialog("edit-target")} title="编辑申请目标"><Pencil /></button>
            <button className={styles.materialButton} onClick={() => setMaterialsOpen(true)}><FolderOpen />项目资料<span>{projectSources.length}</span></button>
          </div>}
          <div className={styles.settingsControls}>
            {currentProject && <><Select label="模型" value={model} onChange={(value) => setModel(value as typeof model)}><option value="deepseek-flash">DeepSeek Flash</option><option value="deepseek-v4-pro">DeepSeek V4 Pro</option></Select>
            <Toggle checked={thinking} onChange={setThinking} label="思考模式" /></>}
            <button onClick={() => setApiOpen(true)}><KeyRound />API Key</button>
            {currentProject && <><button onClick={() => setPromptOpen(true)}><Settings2 />Prompt</button>
            <button className={styles.clearButton} onClick={clearCurrent} disabled={!currentVersion}><Trash2 />清空</button></>}
          </div>
        </header>

        <section className={styles.content}>
          {!currentProject || !currentTarget ? <ProjectOnboarding onCreate={() => setProjectDialog("new-project")} /> : <><div className={styles.pageHeader}>
            <div className={styles.pageTitle}><span><ActiveIcon /></span><div><p>{moduleMeta[active].eyebrow}</p><h1>{currentProject?.school || "备考项目"} · {moduleMeta[active].label}</h1><small>{moduleMeta[active].description}</small></div></div>
            <div className={styles.pageActions}>
              {moduleVersions.length > 0 && <Select label="题单版本" value={currentVersion?.id || ""} onChange={(value) => setVersionChoice((current) => ({ ...current, [active]: value }))}>{moduleVersions.map((version, index) => <option key={version.id} value={version.id}>{index === 0 ? "最新 · " : ""}{new Date(version.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</option>)}</Select>}
              <Button variant="outline" onClick={() => window.print()} disabled={!currentVersion}><Download />导出 PDF</Button>
              <Button onClick={generate} disabled={generating}>{generating ? <LoaderCircle className={styles.spin} /> : <Sparkles />}{currentVersion ? "重新生成" : "生成题单"}</Button>
            </div>
          </div>

          <div className={styles.targetStrip}>
            <span>{currentTarget?.department}</span><i /><span>{currentTarget?.program}</span>{currentTarget?.direction && <><i /><span>{currentTarget.direction}</span></>}<i /><span>{currentTarget?.applicationYear} · {currentTarget?.batch}</span>{currentTarget?.mentor && <><i /><span>{currentTarget.mentor}</span></>}
          </div>

          {active === "coding" ? <CodingPage key={currentVersion?.id || "empty-coding"} version={currentVersion} onEvidence={setEvidenceIds} onGenerate={generate} generating={generating} />
            : active === "interview" ? <QuestionPage module="interview" version={currentVersion} onEvidence={setEvidenceIds} onGenerate={generate} generating={generating} />
              : <ProjectPage key={`${selectedTargetId}-${currentFaculty?.id || "none"}-${currentFaculty?.name || ""}`} version={currentVersion} resume={data.resume} faculty={currentFaculty} projectId={projectId} targetId={selectedTargetId} onReload={load} onEvidence={setEvidenceIds} onGenerate={generate} generating={generating} />}</>}
        </section>
      </main>

      <nav className={styles.mobileNav}>{navItems.map((item) => { const Icon = moduleMeta[item].icon; return <button key={item} className={active === item ? styles.activeNav : ""} onClick={() => setActive(item)}><Icon /><span>{moduleMeta[item].label}</span></button> })}</nav>
      <ProjectDialog key={`${projectDialog || "closed"}-${currentTarget?.id || "none"}`} mode={projectDialog} open={Boolean(projectDialog)} onOpenChange={(open) => !open && setProjectDialog(null)} project={currentProject} target={currentTarget} onSaved={async (ids) => { await load(); if (ids?.projectId) setProjectId(ids.projectId); if (ids?.targetId) setTargetId(ids.targetId); setProjectDialog(null); if (ids?.projectId && ids?.targetId) { setResearching(true); requestJson("/api/research", { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ projectId: ids.projectId, targetId: ids.targetId, depth: "standard" }) }).then(async () => { await load(); toast.success("新项目的首次资料研究已完成") }).catch((error) => toast.error(`项目已创建，首次研究未完成：${error instanceof Error ? error.message : "请稍后重试"}`)).finally(() => setResearching(false)) } }} onNewTarget={() => setProjectDialog("new-target")} />
      <MaterialsDialog open={materialsOpen} onOpenChange={setMaterialsOpen} project={currentProject} target={currentTarget} sources={projectSources} latestRun={data.runs.find((item) => item.projectId === projectId) || null} researching={researching} setResearching={setResearching} onReload={load} onEvidence={(ids) => { setMaterialsOpen(false); setEvidenceIds(ids) }} />

      <Dialog open={apiOpen} onOpenChange={setApiOpen}><DialogContent className={styles.dialog}><DialogHeader><DialogTitle>API Key</DialogTitle><DialogDescription>密钥只保存在当前浏览器，随请求发往本机服务，不进入数据库、日志或导出文件。</DialogDescription></DialogHeader><label className={styles.field}>DeepSeek Key<Input type="password" value={deepseekKey} onChange={(event) => setDeepseekKey(event.target.value)} placeholder={runtime?.integrations.llmConfigured ? "服务端已有配置；可留空" : "sk-..."} /></label><label className={styles.field}>Tavily Key<Input type="password" value={tavilyKey} onChange={(event) => setTavilyKey(event.target.value)} placeholder={runtime?.integrations.tavilyConfigured ? "服务端已有配置；可留空" : "tvly-..."} /></label><div className={styles.keyStatus}><span data-ready={Boolean(deepseekKey || runtime?.integrations.llmConfigured)}><i />DeepSeek</span><span data-ready={Boolean(tavilyKey || runtime?.integrations.tavilyConfigured)}><i />Tavily</span></div><DialogFooter><Button variant="outline" onClick={() => { setDeepseekKey(""); setTavilyKey(""); localStorage.removeItem("baoyan-deepseek-key"); localStorage.removeItem("baoyan-tavily-key"); toast.success("浏览器密钥已清除") }}>清除</Button><Button onClick={saveKeys}>保存到浏览器</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={promptOpen} onOpenChange={setPromptOpen}><DialogContent className={styles.dialog}><DialogHeader><DialogTitle>补充生成要求</DialogTitle><DialogDescription>三关共用。它只影响以后生成的新版本，不会改写已保存题单。</DialogDescription></DialogHeader><Textarea className={styles.promptArea} value={customPrompt} onChange={(event) => setCustomPrompt(event.target.value)} placeholder="例如：更关注系统方向；不要加入纯数学竞赛题……" /><DialogFooter><Button variant="outline" onClick={() => { setCustomPrompt(""); localStorage.removeItem("baoyan-workbench-prompt") }}>恢复默认</Button><Button onClick={() => { localStorage.setItem("baoyan-workbench-prompt", customPrompt); setPromptOpen(false); toast.success("补充要求已保存") }}>保存</Button></DialogFooter></DialogContent></Dialog>
      <EvidenceDrawer ids={evidenceIds} sources={data.sources} onClose={() => setEvidenceIds(null)} />
    </div>
  )
}

function ProjectOnboarding({ onCreate }: { onCreate: () => void }) {
  return <div className={styles.onboarding}><span><FolderOpen /></span><h1>建立你的第一个备考项目</h1><p>一个学校对应一个项目。该校的申请目标、公开资料和三关题单都会放在一起，不会和其他学校混在一起。</p><Button size="lg" onClick={onCreate}><Plus />新建备考项目</Button><div className={styles.onboardingFlow}><div><b>1</b><span><strong>填写申请目标</strong><small>学校、院系、专业与批次</small></span></div><div><b>2</b><span><strong>收集项目资料</strong><small>联网查找，或上传自己的资料</small></span></div><div><b>3</b><span><strong>生成三关题单</strong><small>机试、面试与项目追问</small></span></div></div></div>
}

function EmptyState({ module, onGenerate, generating }: { module: Module; onGenerate: () => void; generating: boolean }) {
  const Icon = moduleMeta[module].icon
  return <div className={styles.empty}><span><Icon /></span><p>{moduleMeta[module].short}</p><h2>资料会被整理成一份只读题单</h2><small>AI 会依据当前学校、申请目标和项目资料自主决定题量与结构；证据不足的内容会明确标为补充题。</small><Button onClick={onGenerate} disabled={generating}>{generating ? <LoaderCircle className={styles.spin} /> : <Sparkles />}开始生成</Button></div>
}

function QuestionPage({ module, version, onEvidence, onGenerate, generating }: { module: Module; version: Version | null; onEvidence: (ids: string[]) => void; onGenerate: () => void; generating: boolean }) {
  if (!version) return <EmptyState module={module} onGenerate={onGenerate} generating={generating} />
  const themes = [...new Set(version.items.map((item) => item.theme))]
  return <div className={styles.questionSheet}><div className={styles.sheetIntro}><div><p>只读版本</p><h2>{version.title}</h2></div><span>{version.items.length} 道问题 · {themes.length} 个主题</span></div>{themes.map((theme, themeIndex) => <section className={styles.themeSection} key={theme}><div className={styles.themeTitle}><span>{String(themeIndex + 1).padStart(2, "0")}</span><h3>{theme}</h3></div><div className={styles.questionGrid}>{version.items.filter((item) => item.theme === theme).map((item) => <QuestionCard key={item.id} item={item} onEvidence={onEvidence} />)}</div></section>)}</div>
}

function QuestionCard({ item, onEvidence, selected, onSelect }: { item: Question; onEvidence: (ids: string[]) => void; selected?: boolean; onSelect?: () => void }) {
  const historical = item.kind === "official_past" || item.kind === "official_sample" || item.kind === "recalled_past"
  return <article className={`${styles.questionCard} ${selected ? styles.selectedQuestion : ""}`} onClick={onSelect}><div className={styles.questionMeta}><span className={styles.kind}>{kindLabel[item.kind] || "补充题"}</span>{item.tags.slice(0, 3).map((tag) => <em key={tag}>{tag}</em>)}<small>#{String(item.position + 1).padStart(2, "0")}</small></div><h4>{item.question}</h4>{item.summary && <p>{item.summary}</p>}<div className={styles.cardActions}>{item.url && <a href={item.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><ExternalLink />{historical ? "查看原题/回忆来源" : "查看推荐依据"}</a>}{item.evidenceIds.length > 0 ? <button onClick={(event) => { event.stopPropagation(); onEvidence(item.evidenceIds) }}><FileText />查看依据 · {item.evidenceIds.length}</button> : <span><Bot />无直接来源，已明确标注</span>}</div></article>
}

function CodingPage({ version, onEvidence, onGenerate, generating }: { version: Version | null; onEvidence: (ids: string[]) => void; onGenerate: () => void; generating: boolean }) {
  const [selectedId, setSelectedId] = useState(version?.items[0]?.id || "")
  const [language, setLanguage] = useState<keyof typeof codeTemplates>("C++")
  const [code, setCode] = useState(codeTemplates["C++"])
  const [submission, setSubmission] = useState("")
  const [review, setReview] = useState("")
  const [reviewing, setReviewing] = useState(false)
  if (!version) return <EmptyState module="coding" onGenerate={onGenerate} generating={generating} />
  const selected = version.items.find((item) => item.id === selectedId) || version.items[0]
  const changeLanguage = (next: keyof typeof codeTemplates) => { setLanguage(next); setCode(codeTemplates[next]); setReview("") }
  const runReview = async () => { setReviewing(true); setReview(""); try { const result = await requestJson<{ review: string }>("/api/code-review", { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ question: selected.question, code, submission }) }); setReview(result.review) } catch (error) { toast.error(error instanceof Error ? error.message : "复盘失败") } finally { setReviewing(false) } }
  return <div className={styles.codingLayout}><section className={styles.paperList}><div className={styles.sheetIntro}><div><p>最新套卷</p><h2>{version.title}</h2></div><span>{version.items.length} 题</span></div>{version.items.map((item) => <QuestionCard key={item.id} item={item} selected={selected.id === item.id} onSelect={() => { setSelectedId(item.id); setReview("") }} onEvidence={onEvidence} />)}</section><section className={styles.codeDesk}><div className={styles.deskHeader}><div><span>当前题目</span><strong>{selected.question}</strong></div>{selected.url && <a href={selected.url} target="_blank" rel="noreferrer"><ExternalLink />前往原 OJ</a>}</div><div className={styles.languageTabs}>{(Object.keys(codeTemplates) as (keyof typeof codeTemplates)[]).map((item) => <button key={item} className={language === item ? styles.activeLanguage : ""} onClick={() => changeLanguage(item)}>{item}</button>)}<small>仅编辑与静态复盘，不在服务器执行</small></div><Textarea className={styles.codeEditor} value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} /><Textarea className={styles.submission} value={submission} onChange={(event) => setSubmission(event.target.value)} placeholder="可选：粘贴 OJ 提交链接、错误信息或测试结果（不会保存）" /><div className={styles.reviewBar}><span>本次代码和结果不会写入历史记录。</span><Button onClick={runReview} disabled={reviewing || !code.trim()}>{reviewing ? <LoaderCircle className={styles.spin} /> : <Sparkles />}一次性 AI 复盘</Button></div>{review && <div className={styles.reviewResult}><strong>静态复盘</strong><p>{review}</p></div>}</section></div>
}

function ProjectPage({ version, resume, faculty, projectId, targetId, onReload, onEvidence, onGenerate, generating }: { version: Version | null; resume: Resume | null; faculty: Faculty | null; projectId: string; targetId: string; onReload: () => Promise<void>; onEvidence: (ids: string[]) => void; onGenerate: () => void; generating: boolean }) {
  const [resumeText, setResumeText] = useState("")
  const [resumeBusy, setResumeBusy] = useState(false)
  const [facultyKind, setFacultyKind] = useState<"faculty" | "group">(faculty?.kind || "faculty")
  const [facultyName, setFacultyName] = useState(faculty?.name || "")
  const [facultyHomepage, setFacultyHomepage] = useState(faculty?.homepage || "")
  const [facultyDescription, setFacultyDescription] = useState(faculty?.description || "")
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadResume = async (file?: File) => { if (!file && resumeText.trim().length < 40) return toast.error("请粘贴至少 40 个字符"); setResumeBusy(true); try { let init: RequestInit; if (file) { const form = new FormData(); form.set("file", file); const headers = jsonHeaders(); delete headers["content-type"]; init = { method: "POST", headers, body: form } } else init = { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ text: resumeText }) }; await requestJson("/api/resume", init); setResumeText(""); await onReload(); toast.success("当前简历已替换") } catch (error) { toast.error(error instanceof Error ? error.message : "简历保存失败") } finally { setResumeBusy(false) } }
  const saveFaculty = async () => { if (!facultyName.trim()) return toast.error("请填写导师或课题组名称"); try { await requestJson("/api/workbench", { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ action: "saveFaculty", projectId, targetId, kind: facultyKind, name: facultyName, homepage: facultyHomepage, description: facultyDescription }) }); await onReload(); toast.success("研究对象已保存") } catch (error) { toast.error(error instanceof Error ? error.message : "保存失败") } }
  return <div className={styles.projectPage}><div className={styles.projectSetup}><section><div className={styles.setupTitle}><FileText /><div><strong>当前简历</strong><span>{resume ? `${resume.filename || "文本简历"} · ${resume.content.length} 字` : "尚未提供"}</span></div></div><div className={styles.dropResume} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) uploadResume(file) }} onClick={() => fileRef.current?.click()}><Upload /><strong>{resume ? "拖入新 PDF 直接替换" : "拖入简历 PDF"}</strong><span>或点击选择文件</span><input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(event) => uploadResume(event.target.files?.[0])} /></div><Textarea value={resumeText} onChange={(event) => setResumeText(event.target.value)} placeholder="也可以粘贴简历全文，新内容会直接替换当前简历……" /><div className={styles.setupActions}>{resume && <Button variant="outline" onClick={async () => { if (!window.confirm("删除当前简历？已有题单版本仍会保留。")) return; await requestJson("/api/resume", { method: "DELETE", headers: jsonHeaders() }); await onReload() }}><Trash2 />删除</Button>}<Button variant="outline" disabled={resumeBusy || resumeText.trim().length < 40} onClick={() => uploadResume()}>{resumeBusy ? <LoaderCircle className={styles.spin} /> : <FileText />}保存粘贴文本</Button></div></section><section><div className={styles.setupTitle}><UserRoundSearch /><div><strong>导师或课题组</strong><span>{faculty ? `当前：${faculty.name}` : "选择一种研究对象"}</span></div></div><div className={styles.segmented}><button className={facultyKind === "faculty" ? styles.segmentActive : ""} onClick={() => setFacultyKind("faculty")}>单独导师</button><button className={facultyKind === "group" ? styles.segmentActive : ""} onClick={() => setFacultyKind("group")}>整个课题组</button></div><Input value={facultyName} onChange={(event) => setFacultyName(event.target.value)} placeholder={facultyKind === "faculty" ? "导师姓名" : "实验室 / 课题组名称"} /><Input value={facultyHomepage} onChange={(event) => setFacultyHomepage(event.target.value)} placeholder="主页链接（可选）" /><Textarea value={facultyDescription} onChange={(event) => setFacultyDescription(event.target.value)} placeholder="已知研究方向或补充说明（可选）" /><Button variant="outline" onClick={saveFaculty}>保存研究对象</Button></section></div>{version ? <QuestionPage module="project" version={version} onEvidence={onEvidence} onGenerate={onGenerate} generating={generating} /> : <EmptyState module="project" onGenerate={onGenerate} generating={generating} />}</div>
}

function ProjectDialog({ mode, open, onOpenChange, project, target, onSaved, onNewTarget }: { mode: "new-project" | "new-target" | "edit-target" | null; open: boolean; onOpenChange: (value: boolean) => void; project: Project | null; target: Target | null; onSaved: (ids?: { projectId?: string; targetId?: string }) => Promise<void>; onNewTarget: () => void }) {
  const editing = mode === "edit-target" && Boolean(target)
  const [school, setSchool] = useState(editing || mode === "new-target" ? project?.school || "" : "")
  const [department, setDepartment] = useState(editing ? target?.department || "" : "")
  const [program, setProgram] = useState(editing ? target?.program || "" : "")
  const [direction, setDirection] = useState(editing ? target?.direction || "" : "")
  const [year, setYear] = useState<number | "">(editing ? target?.applicationYear || "" : "")
  const [batch, setBatch] = useState<"" | "夏令营" | "预推免">(editing ? target?.batch || "" : "")
  const [mentor, setMentor] = useState(editing ? target?.mentor || "" : "")
  const [customText, setCustomText] = useState(editing ? Object.entries(target?.customFields || {}).map(([key, value]) => `${key}=${value}`).join("\n") : "")
  const [busy, setBusy] = useState(false)
  const save = async () => { if (!school.trim() || !department.trim() || !program.trim() || !year || !batch) return toast.error("请填写学校、院系、项目/专业、申请年份和批次"); const customFields = Object.fromEntries(customText.split(/\r?\n/).map((line) => line.split("=")).filter((parts) => parts.length >= 2 && parts[0].trim()).map(([key, ...value]) => [key.trim(), value.join("=").trim()])); const targetPayload = { department, program, direction, applicationYear: year, batch, mentor, customFields }; const body = mode === "new-project" ? { action: "createProject", school, target: targetPayload } : mode === "new-target" ? { action: "createTarget", projectId: project?.id, target: targetPayload } : { action: "updateTarget", projectId: project?.id, targetId: target?.id, target: targetPayload }; setBusy(true); try { const result = await requestJson<{ projectId?: string; targetId?: string }>("/api/workbench", { method: "POST", headers: jsonHeaders(), body: JSON.stringify(body) }); await onSaved(result); toast.success(mode === "edit-target" ? "申请目标已更新" : "已创建") } catch (error) { toast.error(error instanceof Error ? error.message : "保存失败") } finally { setBusy(false) } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className={`${styles.dialog} ${styles.projectDialog}`}><DialogHeader><DialogTitle>{mode === "new-project" ? "新建备考项目" : mode === "new-target" ? `为 ${project?.school || "当前学校"} 新增目标` : "编辑申请目标"}</DialogTitle><DialogDescription>填写实际申请信息；学校特有内容可以放入自定义字段。</DialogDescription></DialogHeader><div className={styles.formGrid}><label className={styles.field}>学校<Input value={school} disabled={mode !== "new-project"} onChange={(event) => setSchool(event.target.value)} /></label><label className={styles.field}>院系<Input value={department} onChange={(event) => setDepartment(event.target.value)} /></label><label className={styles.field}>项目 / 专业<Input value={program} onChange={(event) => setProgram(event.target.value)} /></label><label className={styles.field}>研究方向<Input value={direction} onChange={(event) => setDirection(event.target.value)} /></label><label className={styles.field}>申请年份<Input type="number" value={year} onChange={(event) => setYear(event.target.value ? Number(event.target.value) : "")} /></label><label className={styles.field}>批次<select value={batch} onChange={(event) => setBatch(event.target.value as typeof batch)}><option value="" disabled></option><option>夏令营</option><option>预推免</option></select></label><label className={styles.field}>导师<Input value={mentor} onChange={(event) => setMentor(event.target.value)} /></label><label className={`${styles.field} ${styles.fullField}`}>自定义字段<Textarea value={customText} onChange={(event) => setCustomText(event.target.value)} /></label></div><DialogFooter>{mode === "edit-target" && <Button variant="outline" onClick={onNewTarget}><Plus />新增申请目标</Button>}<Button onClick={save} disabled={busy}>{busy && <LoaderCircle className={styles.spin} />}保存</Button></DialogFooter></DialogContent></Dialog>
}

function MaterialsDialog({ open, onOpenChange, project, target, sources, latestRun, researching, setResearching, onReload, onEvidence }: { open: boolean; onOpenChange: (value: boolean) => void; project: Project | null; target: Target | null; sources: Source[]; latestRun: ResearchRun | null; researching: boolean; setResearching: (value: boolean) => void; onReload: () => Promise<void>; onEvidence: (ids: string[]) => void }) {
  const [view, setView] = useState<"list" | "research" | "add">("list")
  const [tab, setTab] = useState<"all" | "automatic" | "user">("all")
  const [depth, setDepth] = useState("standard")
  const [importMode, setImportMode] = useState<"url" | "text" | "file">("url")
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const visible = sources.filter((item) => tab === "all" || item.origin === tab)
  const research = async () => { if (!project || !target) return; setResearching(true); try { const result = await requestJson<{ added: number; duplicates: number }>("/api/research", { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ projectId: project.id, targetId: target.id, depth }) }); await onReload(); setView("list"); toast.success(`新增 ${result.added} 条资料，合并 ${result.duplicates} 条重复`) } catch (error) { toast.error(error instanceof Error ? error.message : "研究失败") } finally { setResearching(false) } }
  const importSource = async () => { if (!project || !target) return; setBusy(true); try { if (importMode === "file") { if (!file) throw new Error("请选择文件"); const form = new FormData(); form.set("file", file); form.set("projectId", project.id); form.set("targetId", target.id); const headers = jsonHeaders(); delete headers["content-type"]; await requestJson("/api/materials/import", { method: "POST", headers, body: form }) } else await requestJson("/api/materials/import", { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ projectId: project.id, targetId: target.id, mode: importMode, title, url, text }) }); setUrl(""); setTitle(""); setText(""); setFile(null); await onReload(); setView("list"); toast.success("资料已添加") } catch (error) { toast.error(error instanceof Error ? error.message : "导入失败") } finally { setBusy(false) } }
  const clearSources = async () => { if (!project || !sources.length || !window.confirm(`将删除“${project.name}”中的全部 ${sources.length} 条资料，包括联网资料和你添加的资料。已有题单不会删除，但其中的来源将无法查看。是否继续？`)) return; setBusy(true); try { await requestJson(`/api/workbench?type=sources&projectId=${encodeURIComponent(project.id)}`, { method: "DELETE", headers: jsonHeaders() }); await onReload(); toast.success("当前项目的资料已全部删除") } catch (error) { toast.error(error instanceof Error ? error.message : "删除失败") } finally { setBusy(false) } }
  const titleText = view === "list" ? `${project?.name || "项目"} · 项目资料` : view === "research" ? "联网收集资料" : "添加资料"
  const description = view === "list" ? "这里的内容会作为三关题单的共同依据。" : view === "research" ? "系统会查找当前申请目标的公开招生信息、机试与面试经验。" : "添加链接、粘贴文字，或上传本地文件。"
  return <Dialog open={open} onOpenChange={(value) => { if (!value) setView("list"); onOpenChange(value) }}><DialogContent className={`${styles.dialog} ${styles.materialDialog}`}><DialogHeader><div className={styles.materialHeading}>{view !== "list" && <button className={styles.backButton} onClick={() => setView("list")} aria-label="返回资料列表"><ArrowLeft /></button>}<div><DialogTitle>{titleText}</DialogTitle><DialogDescription>{description}</DialogDescription></div></div></DialogHeader>
    {view === "list" && <>{sources.length > 0 ? <><div className={styles.materialToolbar}><div><Button variant="outline" onClick={() => setView("research")}><Search />联网收集</Button><Button onClick={() => setView("add")}><Plus />添加资料</Button></div><div className={styles.materialActions}><a href={project ? `/api/materials/export?projectId=${encodeURIComponent(project.id)}` : "#"}><Archive />导出全部</a><button onClick={clearSources} disabled={busy}>{busy ? <LoaderCircle className={styles.spin} /> : <Trash2 />}清空资料</button></div></div><div className={styles.materialTabs}><div>{(["all", "automatic", "user"] as const).map((item) => <button key={item} className={tab === item ? styles.activeTab : ""} onClick={() => setTab(item)}>{item === "all" ? "全部" : item === "automatic" ? "联网资料" : "我的资料"}<span>{sources.filter((source) => item === "all" || source.origin === item).length}</span></button>)}</div></div><div className={styles.sourceList}>{visible.length ? visible.map((source) => <article key={source.id}><span className={source.origin === "automatic" ? styles.autoSource : styles.userSource}>{source.origin === "automatic" ? <Search /> : <Upload />}</span><button className={styles.sourceMain} onClick={() => onEvidence([source.id])}><strong>{source.title}</strong><small>{source.origin === "automatic" ? "联网资料" : "你添加的资料"} · {source.status === "snippet" ? "搜索摘要" : "已读取"}</small></button><div>{source.url && <a href={source.url} target="_blank" rel="noreferrer" title="打开原链接"><ExternalLink /></a>}<a href={`/api/materials/download?id=${encodeURIComponent(source.id)}`} title="下载"><Download /></a><button title="删除" onClick={async () => { if (!window.confirm(`删除“${source.title}”？`)) return; await requestJson(`/api/workbench?type=source&id=${encodeURIComponent(source.id)}`, { method: "DELETE", headers: jsonHeaders() }); await onReload() }}><Trash2 /></button></div></article>) : <div className={styles.noSource}>这里还没有资料</div>}</div></> : <div className={styles.materialEmpty}><span><FolderOpen /></span><h3>还没有项目资料</h3><p>让系统联网收集公开信息，或者添加你手上的通知、面经和文件。</p><div><Button variant="outline" onClick={() => setView("research")}><Search />联网收集</Button><Button onClick={() => setView("add")}><Plus />添加资料</Button></div></div>}</>}
    {view === "research" && <section className={styles.researchPanel}><div className={styles.depthChoices}>{([{ value: "quick", label: "快速", note: "先找到最关键的官方信息" }, { value: "standard", label: "标准", note: "兼顾官方信息与经验资料" }, { value: "deep", label: "深度", note: "扩大检索范围，耗时更久" }] as const).map((item) => <button key={item.value} className={depth === item.value ? styles.activeDepth : ""} onClick={() => setDepth(item.value)}><span>{item.label}</span><small>{item.note}</small></button>)}</div>{latestRun && <p className={styles.lastRun}><RefreshCw />上次收集：{new Date(latestRun.updatedAt).toLocaleString("zh-CN")} · {latestRun.sourceCount} 条资料</p>}<Button size="lg" onClick={research} disabled={researching}>{researching ? <LoaderCircle className={styles.spin} /> : <Search />}{researching ? "正在收集…" : "开始联网收集"}</Button></section>}
    {view === "add" && <section className={styles.addPanel}><div className={styles.importTabs}>{(["url", "text", "file"] as const).map((item) => <button key={item} className={importMode === item ? styles.activeImport : ""} onClick={() => setImportMode(item)}>{item === "url" ? "链接" : item === "text" ? "粘贴文字" : "上传文件"}</button>)}</div>{importMode === "url" && <><Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="粘贴公开网页链接" /><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="资料名称（可选）" /></>}{importMode === "text" && <><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="资料名称" /><Textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="粘贴通知、面经或个人笔记" /></>}{importMode === "file" && <label className={styles.fileDrop} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setFile(event.dataTransfer.files[0] || null) }}><Upload /><strong>{file?.name || "拖入文件，或点击选择"}</strong><span>PDF、文本或图片，最大 10 MB</span><input type="file" accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>}<Button size="lg" onClick={importSource} disabled={busy}>{busy ? <LoaderCircle className={styles.spin} /> : <Plus />}{busy ? "正在添加…" : "添加到当前项目"}</Button></section>}
  </DialogContent></Dialog>
}

function EvidenceDrawer({ ids, sources, onClose }: { ids: string[] | null; sources: Source[]; onClose: () => void }) {
  const selected = sources.filter((item) => ids?.includes(item.id))
  return <div className={`${styles.drawerLayer} ${ids ? styles.drawerOpen : ""}`} aria-hidden={!ids}><button className={styles.drawerBackdrop} onClick={onClose} aria-label="关闭证据" /><aside className={styles.drawer}><div className={styles.drawerHeader}><div><p>证据与来源</p><h2>{selected.length ? `${selected.length} 条可追溯资料` : "暂无直接来源"}</h2></div><button onClick={onClose}><X /></button></div><div className={styles.drawerContent}>{selected.map((source) => <article key={source.id}><div className={styles.drawerMeta}><span>{source.origin === "automatic" ? "自动采集" : "用户上传"}</span><em>{source.confidence === "high" ? "高可信" : source.confidence === "medium" ? "中可信" : "待核验"}</em></div><h3>{source.title}</h3><p>{source.content.slice(0, 1200)}{source.content.length > 1200 ? "…" : ""}</p><div>{source.url && <a href={source.url} target="_blank" rel="noreferrer"><ExternalLink />打开原链接</a>}<a href={`/api/materials/download?id=${encodeURIComponent(source.id)}`}><Download />下载</a></div></article>)}</div></aside></div>
}
