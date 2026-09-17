import { expect, test, type Page } from "@playwright/test"

test.use({ actionTimeout: 10_000 })

async function workspace(page: Page) {
  const snapshot = { projects: [] as object[], targets: [] as object[], sources: [], versions: [], resume: null, faculty: [], runs: [] }
  await page.route("**/api/bootstrap", (route) => route.fulfill({ json: { demoMode: true, integrations: { llmConfigured: true, tavilyConfigured: true } } }))
  await page.route("**/api/workbench", async (route) => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON()
      snapshot.projects = [{ id: "project-test", school: input.school, name: input.school, pinnedAt: null }]
      snapshot.targets = [{ ...input.target, id: "target-test", projectId: "project-test", isActive: true }]
      await route.fulfill({ json: { projectId: "project-test", targetId: "target-test" } })
    } else await route.fulfill({ json: snapshot })
  })
  await page.goto("/")
  await page.getByRole("button", { name: "新建备考项目", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("学校", { exact: true }).fill("清华大学")
  await dialog.getByLabel("院系", { exact: true }).fill("人工智能学院")
  await dialog.getByLabel("项目 / 专业", { exact: true }).fill("计算机科学与技术")
  await dialog.getByLabel("申请年份", { exact: true }).fill("2027")
  await dialog.getByRole("combobox", { name: "批次", exact: true }).selectOption("夏令营")
  await dialog.getByRole("button", { name: "保存", exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole("button", { name: /^项目资料/ }).click()
  await page.getByRole("button", { name: "联网收集", exact: true }).click()
}

test("creating a project and selecting depth never starts collection; explicit start uses selected depth", async ({ page }) => {
  const requests: { depth: string }[] = []
  await page.route("**/api/research", async (route) => {
    requests.push(route.request().postDataJSON())
    await route.fulfill({ contentType: "application/x-ndjson", body: `${JSON.stringify({ type: "complete", result: { added: 2, duplicates: 0 } })}\n` })
  })
  await workspace(page)
  expect(requests).toHaveLength(0)
  await page.getByRole("button", { name: /^深度/ }).click()
  await expect(page.getByRole("button", { name: /^深度/ })).toHaveAttribute("aria-pressed", "true")
  expect(requests).toHaveLength(0)
  await page.getByRole("button", { name: "开始联网收集", exact: true }).click()
  await expect(page.getByText("新增 2 条资料，合并 0 条重复")).toBeVisible()
  expect(requests).toEqual([expect.objectContaining({ depth: "deep" })])
})

test("failed collection stops loading and can be retried", async ({ page }) => {
  let count = 0
  await page.route("**/api/research", (route) => {
    count++
    return route.fulfill({ contentType: "application/x-ndjson", body: count === 1
      ? '{"type":"progress","detail":"正在审核资料（2/4）"}\n{"type":"error","error":"审核服务超时，请重试"}\n'
      : '{"type":"complete","result":{"added":1,"duplicates":0}}\n' })
  })
  await workspace(page)
  await page.getByRole("button", { name: "开始联网收集", exact: true }).click()
  await expect(page.getByRole("alert").filter({ hasText: "审核服务超时，请重试" })).toBeVisible()
  await expect(page.getByRole("button", { name: "重试收集", exact: true })).toBeEnabled()
  await page.getByRole("button", { name: "重试收集", exact: true }).click()
  await expect(page.getByText("新增 1 条资料，合并 0 条重复")).toBeVisible()
  expect(count).toBe(2)
})

test("a pending request can be cancelled and depth becomes selectable again", async ({ page }) => {
  let release: () => void = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  await page.route("**/api/research", async (route) => {
    await pending
    await route.abort().catch(() => {})
  })
  try {
    await workspace(page)
    await page.getByRole("button", { name: "开始联网收集", exact: true }).click()
    await expect(page.getByRole("button", { name: /^深度/ })).toBeDisabled()
    await expect(page.getByRole("status")).toHaveText("正在连接…")
    await page.getByRole("button", { name: "取消收集", exact: true }).click()
    await expect(page.getByRole("button", { name: "开始联网收集", exact: true })).toBeEnabled()
    await expect(page.getByRole("button", { name: /^深度/ })).toBeEnabled()
  } finally { release() }
})

test("mobile collection settings fit without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await workspace(page)
  await expect(page.getByRole("button", { name: "开始联网收集", exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
})
