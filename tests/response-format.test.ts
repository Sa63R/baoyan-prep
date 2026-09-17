import { describe, expect, it } from "vitest"
import { extractResponseOutputText } from "../lib/response-format"

describe("DeepSeek Responses output parsing", () => {
  it("ignores reasoning text and reads only the structured final answer", () => {
    const result = extractResponseOutputText({
      output: [
        { content: [{ type: "reasoning_text", text: "internal analysis that is not JSON" }] },
        { content: [{ type: "output_text", text: "{\"reviews\":[]}" }] },
      ],
    })
    expect(result).toBe("{\"reviews\":[]}")
  })

  it("prefers a top-level output_text when provided", () => {
    expect(extractResponseOutputText({ output_text: "{\"ok\":true}" })).toBe("{\"ok\":true}")
  })
})
