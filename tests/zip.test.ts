import { describe, expect, it } from "vitest"
import { createStoredZip } from "../lib/zip"

describe("material archive", () => {
  it("creates a standards-shaped zip with UTF-8 filenames and a central directory", () => {
    const archive = createStoredZip([
      { name: "来源清单.tsv", data: Buffer.from("标题\t链接\n招生简章\thttps://example.com", "utf8") },
      { name: "text/资料.txt", data: Buffer.from("可追溯正文", "utf8") },
    ])
    expect(archive.subarray(0, 4).toString("hex")).toBe("504b0304")
    expect(archive.includes(Buffer.from("来源清单.tsv", "utf8"))).toBe(true)
    expect(archive.includes(Buffer.from("可追溯正文", "utf8"))).toBe(true)
    expect(archive.subarray(-22, -18).toString("hex")).toBe("504b0506")
  })
})
