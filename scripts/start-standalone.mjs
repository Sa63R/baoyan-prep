import { cpSync, existsSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const projectRoot = process.cwd()
const localEnv = resolve(projectRoot, ".env.local")
if (existsSync(localEnv)) process.loadEnvFile(localEnv)
process.env.DATABASE_URL = resolve(projectRoot, (process.env.DATABASE_URL || "data/baoyan-prep.db").replace(/^file:/, ""))
process.env.UPLOAD_DIR = resolve(projectRoot, process.env.UPLOAD_DIR || "data/uploads")

const standalone = resolve(".next/standalone")
if (!existsSync(resolve(standalone, "server.js"))) {
  throw new Error("生产构建不存在，请先运行 pnpm build")
}

if (existsSync("public")) cpSync("public", resolve(standalone, "public"), { recursive: true })
mkdirSync(resolve(standalone, ".next"), { recursive: true })
cpSync(".next/static", resolve(standalone, ".next/static"), { recursive: true })

await import(pathToFileURL(resolve(standalone, "server.js")).href)
