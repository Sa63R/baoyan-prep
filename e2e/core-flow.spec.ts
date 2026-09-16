import { expect, test } from "@playwright/test"
import { mkdirSync } from "node:fs"

test("desktop evidence and all three training loops persist", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "先看清规则，再开始刷题" })).toBeVisible()
  await page.getByRole("button", { name: /\[E02\] 营员复盘/ }).click()
  await expect(page.getByText("2025 年营员复盘（演示）").last()).toBeVisible()

  await page.getByRole("button", { name: "机试训练" }).click()
  await expect(page.getByRole("heading", { name: "可信路径" })).toBeVisible()
  await page.getByLabel("代码编辑器").fill("int main(){ /* Dijkstra: handle stale heap entries */ return 0; }")
  await page.getByRole("button", { name: "AI 代码审查" }).click()
  await expect(page.getByText("固定演示 · 未调用模型")).toBeVisible()

  await page.getByRole("button", { name: "专业面试" }).click()
  await page.getByRole("button", { name: "试卷模式" }).click()
  await expect(page.getByText("回答要点与常见错误")).toBeHidden()
  await page.getByPlaceholder(/用自己的话回答/).fill("隔离性限制并发事务的相互可见性，可重复读与串行化对幻读等异常的约束不同。")
  await page.getByRole("button", { name: "提交本轮回答" }).click()
  await expect(page.getByText("回答要点与常见错误")).toBeVisible()

  await page.getByRole("button", { name: "项目追问" }).click()
  await page.getByText("我确认职责、技术方案和指标没有被系统补写").click()
  await page.getByPlaceholder(/选择依据/).fill("我选择 Recall@10 是因为候选集需要覆盖答案；MRR 更关注正确答案的首个排序位置，两者结论可能不同。")
  await page.getByRole("button", { name: "提交项目回答" }).click()
  await expect(page.getByText("固定演示 · 未调用模型")).toBeVisible()

  const before = await page.evaluate(async () => (await (await fetch("/api/records")).json()).records.length)
  expect(before).toBeGreaterThanOrEqual(3)
  await page.reload()
  const after = await page.evaluate(async () => (await (await fetch("/api/records")).json()).records.length)
  expect(after).toBe(before)
  mkdirSync("test-results/screenshots", { recursive: true })
  await page.screenshot({ path: "test-results/screenshots/desktop-1440.png", fullPage: true })
})

test("mobile opens evidence in a sheet without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page.getByRole("button", { name: /\[E01\] 招生说明/ }).click()
  await expect(page.getByRole("heading", { name: /证据抽屉 · E01/ })).toBeVisible()
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(hasOverflow).toBe(false)
  mkdirSync("test-results/screenshots", { recursive: true })
  await page.screenshot({ path: "test-results/screenshots/mobile-390.png", fullPage: true })
})

test("sessions cannot read each other's records", async ({ browser }) => {
  const a = await browser.newContext()
  const b = await browser.newContext()
  const pa = await a.newPage(); const pb = await b.newPage()
  await pa.goto("/"); await pb.goto("/")
  await pa.getByRole("button", { name: "专业面试" }).click()
  await pa.getByPlaceholder(/用自己的话回答/).fill("这是会话 A 的隔离测试回答，长度足够触发保存。")
  await pa.getByRole("button", { name: "提交本轮回答" }).click()
  await expect(pa.getByText("固定演示 · 未调用模型")).toBeVisible()
  const aCount = await pa.evaluate(async () => (await (await fetch("/api/records")).json()).records.length)
  const bCount = await pb.evaluate(async () => (await (await fetch("/api/records")).json()).records.length)
  expect(aCount).toBe(1)
  expect(bCount).toBe(0)
  await a.close(); await b.close()
})
