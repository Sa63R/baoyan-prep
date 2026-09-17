export type ResponsesPayload = {
  output_text?: string
  output?: { content?: { type?: string; text?: string }[] }[]
}

/** Extract only final answer blocks; reasoning_text is never application data. */
export function extractResponseOutputText(payload: ResponsesPayload) {
  if (payload.output_text) return payload.output_text
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text || "")
    .join("")
}
