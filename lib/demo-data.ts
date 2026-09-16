export const demoSources = [
  {
    suffix: "source-notice", title: "2027 年夏令营招生说明（演示）", url: "/demo-sources/notice#paragraph-3",
    author: "虚构理工大学计算机学院", publishedAt: "2026-05-20", statedYear: "2027 入学",
    scope: "计算机学院 · 夏令营", sourceType: "演示材料", accessStatus: "success", contentRange: "全文 6 段",
    content: "本页面为循证保研的虚构演示材料，不对应任何真实学校。\n招生对象为计划于 2027 年入学的学生。\n考核包含上机测试与综合面试。上机语言和题量将在后续通知中公布。\n申请材料包括成绩单与个人陈述。\n不同批次安排可能不同。\n请以正式通知为准。",
  },
  {
    suffix: "source-experience", title: "2025 年营员复盘（演示）", url: "/demo-sources/experience#paragraph-7",
    author: "演示用户 A", publishedAt: "2025-08-11", statedYear: "2025 考核",
    scope: "计算机学院 · 夏令营", sourceType: "演示材料", accessStatus: "success", contentRange: "全文 9 段",
    content: "这是虚构的脱敏经历，仅用于展示来源分级。作者称当天先签到再参加考核。作者回忆机试侧重图搜索与动态规划，面试追问了项目中指标的选择依据。个人回忆可能存在偏差，不应视作学校规则。",
  },
  {
    suffix: "source-lab", title: "可信学习组研究页（演示）", url: "/demo-sources/lab#research-2",
    author: "鲁言教授（虚构）", publishedAt: "2026-04-03", statedYear: "持续更新",
    scope: "鲁言教授 · 可信学习组", sourceType: "演示材料", accessStatus: "success", contentRange: "研究方向栏目",
    content: "本页面与人物完全虚构。研究关注可解释机器学习、数据质量评估，以及人在环路的可靠决策。研究方向包括：一、数据质量评估。二、可解释机器学习与人在环路的可靠决策。三、机器学习系统中的失效分析。",
  },
] as const

export const demoEvidences = [
  { suffix: "E01", sourceSuffix: "source-notice", quote: "考核包含上机测试与综合面试。上机语言和题量将在后续通知中公布。", locator: "第 3 段 · 字符 118–176", located: true },
  { suffix: "E02", sourceSuffix: "source-experience", quote: "作者回忆机试侧重图搜索与动态规划，面试追问了项目中指标的选择依据。", locator: "第 7 段 · 字符 302–361", located: true },
  { suffix: "E03", sourceSuffix: "source-lab", quote: "研究关注可解释机器学习、数据质量评估，以及人在环路的可靠决策。", locator: "研究方向 · 第 2 项", located: true },
] as const

export const demoClaims = [
  { suffix: "C01", content: "本批次包含上机测试与综合面试", claimType: "官方事实", evidenceSuffixes: ["E01"], scope: "2027 入学 · 夏令营", verification: "verified", conflictSuffixes: [] },
  { suffix: "C02", content: "一位 2025 年参与者回忆机试涉及图搜索与动态规划", claimType: "他人经验陈述", evidenceSuffixes: ["E02"], scope: "2025 考核 · 夏令营", verification: "needs_review", conflictSuffixes: [] },
  { suffix: "C03", content: "机试语言、题量与真实考试时长尚未公布", claimType: "未知", evidenceSuffixes: ["E01"], scope: "2027 入学 · 夏令营", verification: "unknown", conflictSuffixes: [] },
] as const
