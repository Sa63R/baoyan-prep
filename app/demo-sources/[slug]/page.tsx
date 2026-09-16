import Link from "next/link"
import { notFound } from "next/navigation"

const pages = {
  notice: {
    label: "官方通知结构 · 演示", title: "2027 年夏令营招生说明（虚构）", date: "2026-05-20",
    paragraphs: ["本页面为循证保研的内部演示材料，不对应任何真实大学。", "招生对象为计划于 2027 年入学的学生。", "考核包含上机测试与综合面试。上机语言和题量将在后续通知中公布。", "申请材料包括成绩单与个人陈述。", "夏令营、预推免与统考复试是不同批次，本说明不跨批次适用。", "所有安排以正式发布的最新通知为准。"],
  },
  experience: {
    label: "亲历经验 · 演示", title: "一名 2025 年营员的复盘（虚构）", date: "2025-08-11",
    paragraphs: ["这是虚构的脱敏经历，仅用于展示经验来源分级。", "作者称当天先签到再参加考核。", "设备由考场提供。", "具体语言由考生自选。", "题量记忆不清。", "面试在机试后进行。", "作者回忆机试侧重图搜索与动态规划，面试追问了项目中指标的选择依据。", "个人感受是节奏较快。", "个人回忆可能存在偏差，不应视作学校规则。"],
  },
  lab: {
    label: "导师主页结构 · 演示", title: "可信学习组研究页（虚构）", date: "2026-04-03",
    paragraphs: ["本页面与人物完全虚构。", "研究方向包括：一、数据质量评估。二、可解释机器学习与人在环路的可靠决策。三、机器学习系统中的失效分析。", "公开资源包括课程讲义和复现实验说明。", "导师是否参与真实考核未知。"],
  },
} as const

export default async function DemoSourcePage({ params }: PageProps<"/demo-sources/[slug]">) {
  const { slug } = await params
  const page = pages[slug as keyof typeof pages]
  if (!page) notFound()
  return (
    <main className="source-page">
      <Link href="/">← 返回工作台</Link>
      <div className="source-notice">演示来源 · 不对应真实学校、作者或网页</div>
      <p className="source-kicker">{page.label}</p>
      <h1>{page.title}</h1>
      <p className="source-date">发布日期：{page.date}</p>
      <article>{page.paragraphs.map((paragraph, index) => <p key={paragraph} id={slug === "lab" && index === 1 ? "research-2" : `paragraph-${index + 1}`}><span>{index + 1}</span>{paragraph}</p>)}</article>
    </main>
  )
}
