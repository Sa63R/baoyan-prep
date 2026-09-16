"use client"

import { useEffect, useState } from "react"
import {
  Archive, BookOpenCheck, Check, ChevronDown, CircleHelp, Code2, FileSearch,
  FolderSearch2, GraduationCap, Menu, MessageSquareText, PanelLeftClose,
  PanelRightClose, Paperclip, RefreshCw, Search, ShieldCheck, Sparkles, Target,
  UserRoundSearch,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import { toast } from "sonner"
import { TrainingView } from "@/components/training-views"

type Evidence = {
  id: string
  title: string
  kind: string
  date: string
  year: string
  scope: string
  fetched: string
  location: string
  status: string
  quote: string
  url: string
}

const evidence: Record<string, Evidence> = {
  E01: {
    id: "E01", title: "2027 年夏令营招生说明（演示）", kind: "演示材料 · 官方事实结构",
    date: "2026-05-20", year: "2027 入学", scope: "计算机学院 · 夏令营",
    fetched: "2026-09-17 08:42", location: "第 3 段 · 字符 118–176", status: "已读取 · 摘录可定位",
    quote: "考核包含上机测试与综合面试。上机语言和题量将在后续通知中公布。",
    url: "/demo-sources/notice#paragraph-3",
  },
  E02: {
    id: "E02", title: "2025 年营员复盘（演示）", kind: "演示材料 · 亲历经验",
    date: "2025-08-11", year: "2025 考核", scope: "计算机学院 · 夏令营",
    fetched: "2026-09-17 08:44", location: "第 7 段 · 字符 302–361", status: "已读取 · 待交叉核实",
    quote: "作者回忆机试侧重图搜索与动态规划，面试追问了项目中指标的选择依据。",
    url: "/demo-sources/experience#paragraph-7",
  },
  E03: {
    id: "E03", title: "导师实验室研究页（演示）", kind: "演示材料 · 导师主页",
    date: "2026-04-03", year: "持续更新", scope: "鲁言教授 · 可信学习组",
    fetched: "2026-09-17 08:45", location: "研究方向 · 第 2 项", status: "已读取 · 摘录可定位",
    quote: "研究关注可解释机器学习、数据质量评估，以及人在环路的可靠决策。",
    url: "/demo-sources/lab#research-2",
  },
}

const nav = [
  ["overview", "目标概览", Target], ["profile", "调查档案", FolderSearch2],
  ["coding", "机试训练", Code2], ["interview", "专业面试", MessageSquareText],
  ["project", "项目追问", UserRoundSearch], ["sources", "资料与来源", Archive],
] as const

function EvidenceBody({ item }: { item: Evidence }) {
  return (
    <div className="evidence-body">
      <div className="evidence-status"><span className="status-dot" />{item.status}</div>
      <h3>{item.title}</h3>
      <p className="evidence-kind">{item.kind}</p>
      <blockquote>“{item.quote}”</blockquote>
      <dl className="evidence-meta">
        <div><dt>原始日期</dt><dd>{item.date}</dd></div>
        <div><dt>所述年份</dt><dd>{item.year}</dd></div>
        <div><dt>适用范围</dt><dd>{item.scope}</dd></div>
        <div><dt>抓取时间</dt><dd>{item.fetched}</dd></div>
        <div><dt>原文位置</dt><dd>{item.location}</dd></div>
      </dl>
      <Button className="w-full" nativeButton={false} render={<a href={item.url} />}>打开演示原文片段</Button>
      <p className="privacy-note"><ShieldCheck /> 此来源仅存在于当前演示工作区。</p>
    </div>
  )
}

export function Workspace() {
  const [active, setActive] = useState<(typeof nav)[number][0]>("profile")
  const [selectedId, setSelectedId] = useState("E01")
  const [mobileEvidence, setMobileEvidence] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [evidenceCollapsed, setEvidenceCollapsed] = useState(false)
  const [syncState, setSyncState] = useState<"loading" | "ready" | "failed">("loading")
  const selected = evidence[selectedId]

  useEffect(() => {
    fetch("/api/bootstrap", { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error(); return response.json() })
      .then(() => setSyncState("ready"))
      .catch(() => setSyncState("failed"))
  }, [])

  const openEvidence = (id: string) => {
    setSelectedId(id)
    if (window.matchMedia("(max-width: 1023px)").matches) setMobileEvidence(true)
  }

  return (
    <main className={`workspace ${collapsed ? "sidebar-collapsed" : ""} ${evidenceCollapsed ? "evidence-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark"><GraduationCap /></div>
          {!collapsed && <div><strong>循证保研</strong><span>PREP WITH PROOF</span></div>}
          <Button variant="ghost" size="icon-sm" className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label="折叠导航"><PanelLeftClose /></Button>
        </div>
        <div className="demo-card">
          <div className="demo-icon"><Sparkles /></div>
          {!collapsed && <div><strong>演示工作区</strong><span>所有学校、导师与经历均为虚构</span></div>}
        </div>
        <nav aria-label="主导航">
          {nav.map(([id, label, Icon]) => (
            <button key={id} className={active === id ? "active" : ""} onClick={() => { setActive(id); toast.info(`${label}视图已切换`) }}>
              <Icon />{!collapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="scope-progress">
            {!collapsed && <><span>调查覆盖</span><strong>6 / 9 字段</strong></>}
            <Progress value={67} />
          </div>
          {!collapsed && <p>{syncState === "loading" ? "正在恢复当前会话…" : syncState === "failed" ? "会话保存失败，请刷新重试。" : "记录已保存；真实服务未配置。"}</p>}
        </div>
      </aside>

      <header className="topbar">
        <Button variant="ghost" size="icon" className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="打开导航"><Menu /></Button>
        <div className="target-crumb"><span>虚构理工大学</span><i>/</i><span>计算机学院</span><i>/</i><strong>智能科学与技术</strong></div>
        <div className="target-tags">
          <Badge variant="outline">学硕</Badge><Badge variant="outline">夏令营</Badge><Badge variant="secondary">2027 入学</Badge>
          <Button variant="outline" size="sm" onClick={() => toast.info("演示版固定为虚构目标")} >切换目标 <ChevronDown /></Button>
        </div>
      </header>

      <section className="content">
        {active === "profile" ? <>
        <div className="content-head">
          <div>
            <div className="eyebrow"><FileSearch /> 调查档案 · 结论核对</div>
            <h1>先看清规则，再开始刷题</h1>
            <p>每个结论都回到原文。冲突不抹平，未知不猜填。</p>
          </div>
          <div className="head-actions">
            <Button variant="outline" onClick={() => toast.success("演示资料已是最新状态")}><RefreshCw />重新核验</Button>
            <Button onClick={() => { setActive("coding"); toast.success("已生成三关演示题单") }}><BookOpenCheck />确认档案并生成题单</Button>
          </div>
        </div>

        <div className="pipeline" aria-label="调查进度">
          {["确定目标", "发现资料", "读取原文", "提取证据", "核对结论", "生成训练"].map((step, index) => (
            <div key={step} className={index < 4 ? "done" : index === 4 ? "current" : ""}>
              <span>{index < 4 ? <Check /> : index + 1}</span><p>{step}</p>
            </div>
          ))}
        </div>

        <div className="metrics">
          <article><span>有效来源</span><strong>3</strong><small>3 个独立来源</small></article>
          <article><span>已核实字段</span><strong>6</strong><small>共 9 个核心字段</small></article>
          <article><span>待核实</span><strong className="amber">2</strong><small>语言、机试时长</small></article>
          <article><span>来源冲突</span><strong className="red">1</strong><small>机试题量口径不一</small></article>
        </div>

        <div className="section-title"><div><h2>考核方式</h2><p>结论按适用年份与批次分开保存</p></div><Badge variant="secondary">3 条结论</Badge></div>
        <div className="claim-list">
          <article className="claim-card verified">
            <div className="claim-icon"><Check /></div>
            <div className="claim-copy">
              <div className="claim-label"><Badge>官方事实</Badge><span>已核实</span></div>
              <h3>本批次包含上机测试与综合面试</h3>
              <p>适用：计算机学院 · 2027 入学 · 夏令营。通知未说明语言、题量与时长。</p>
              <button className="citation" onClick={() => openEvidence("E01")}><Paperclip />[E01] 招生说明 · 第 3 段</button>
            </div>
          </article>
          <article className="claim-card experience">
            <div className="claim-icon"><MessageSquareText /></div>
            <div className="claim-copy">
              <div className="claim-label"><Badge variant="outline">经验陈述</Badge><span>待交叉核实</span></div>
              <h3>一位 2025 年参与者回忆：机试涉及图搜索与动态规划</h3>
              <p>旧年个人经历，仅用于确定训练主题，不作为 2027 年出题规则。</p>
              <button className="citation" onClick={() => openEvidence("E02")}><Paperclip />[E02] 营员复盘 · 第 7 段</button>
            </div>
          </article>
          <article className="claim-card unknown">
            <div className="claim-icon"><CircleHelp /></div>
            <div className="claim-copy">
              <div className="claim-label"><Badge variant="secondary">未知</Badge><span>信息缺失</span></div>
              <h3>机试语言、题量与真实考试时长尚未公布</h3>
              <p>练习默认值为 90 分钟 / 3 题，会持续保持“练习设置”标识。</p>
              <button className="citation" onClick={() => openEvidence("E03")}><Search />查看相关导师研究证据 [E03]</button>
            </div>
          </article>
        </div>
        </> : <TrainingView active={active} openEvidence={openEvidence} />}
      </section>

      <aside className="evidence-panel">
        <div className="panel-head"><div><span>证据抽屉</span><strong>{selected.id}</strong></div><Button variant="ghost" size="icon-sm" onClick={() => setEvidenceCollapsed(!evidenceCollapsed)} aria-label={evidenceCollapsed ? "展开证据" : "收起证据"}><PanelRightClose /></Button></div>
        <EvidenceBody item={selected} />
      </aside>

      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="w-[min(86vw,320px)] bg-[#111a2d] text-white">
          <SheetHeader><SheetTitle className="text-white">循证保研</SheetTitle><SheetDescription className="text-[#8d9ab5]">演示工作区 · 所有数据均为虚构</SheetDescription></SheetHeader>
          <nav className="mobile-nav" aria-label="移动端主导航">
            {nav.map(([id, label, Icon]) => <button key={id} className={active === id ? "active" : ""} onClick={() => { setActive(id); setMobileNav(false) }}><Icon /><span>{label}</span></button>)}
          </nav>
        </SheetContent>
      </Sheet>

      <Sheet open={mobileEvidence} onOpenChange={setMobileEvidence}>
        <SheetContent className="w-[min(92vw,390px)] sm:max-w-[390px]">
          <SheetHeader><SheetTitle>证据抽屉 · {selected.id}</SheetTitle><SheetDescription>原文摘录与适用范围</SheetDescription></SheetHeader>
          <EvidenceBody item={selected} />
        </SheetContent>
      </Sheet>
    </main>
  )
}
