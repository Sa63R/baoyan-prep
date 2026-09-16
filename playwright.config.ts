import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
