import "server-only"

export type ReviewInput = { module: "coding" | "interview" | "project"; answer: string; evidenceIds: string[]; question: string }

export async function reviewWithModel(input: ReviewInput) {
  const base = process.env.LLM_BASE_URL
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL
  if (!base || !apiKey || !model) throw new Error("未完整配置 LLM_BASE_URL、LLM_API_KEY 和 LLM_MODEL，真实模型没有执行")
  const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "你是循证保研训练反馈器。只能引用用户提供的 Evidence ID；不得制造 URL、作者、日期、经历、实验或指标。明确区分 AI 审查与真实判题。输出三段：主要缺口、可执行改进、复测题。" },
        { role: "user", content: JSON.stringify(input) },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`模型请求失败：HTTP ${response.status}`)
  const payload = await response.json() as { choices?: { message?: { content?: string } }[] }
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error("模型返回内容为空")
  return { content, modelCalled: true, model }
}

export function demoReview(input: ReviewInput) {
  const short = input.answer.trim().length < 40
  const content = input.module === "coding"
    ? `${short ? "主要缺口：当前代码或思路过短，尚未说明边界条件与复杂度。" : "主要缺口：需要补充对不可达节点与重复入队的处理说明。"}\n可执行改进：写出 O((n+m)log n) 的复杂度，并用一个含环图的自测样例核对。\n复测题：若边权允许为 0，你的实现是否仍然正确？为什么？`
    : input.module === "project"
      ? `${short ? "主要缺口：还没有把本人职责与团队工作分开。" : "主要缺口：指标选择的依据和失败场景还不够具体。"}\n可执行改进：只使用简历中已经给出的事实，按“目标—本人动作—证据—局限”重写。\n复测题：如果离线指标提升但线上延迟恶化，你会怎样定位？`
      : `${short ? "主要缺口：回答缺少定义、机制和例子的完整链条。" : "主要缺口：结论清楚，但没有解释替代方案为何不合适。"}\n可执行改进：先给一句定义，再用一个反例检验边界。\n复测题：换一个不同场景，说明同一机制何时会失效。`
  return { content, modelCalled: false, model: "固定演示反馈" }
}
