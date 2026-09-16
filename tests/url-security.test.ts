import { describe, expect, it } from "vitest"
import { isBlockedAddress, validatePublicUrl } from "../lib/security/url"

describe("external URL protection", () => {
  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.3", "::1", "fd00::1", "::ffff:192.168.1.1"])("blocks private address %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true)
  })

  it.each(["file:///etc/passwd", "ftp://example.com/a", "http://localhost:3000", "http://169.254.169.254/latest/meta-data"])("rejects dangerous URL %s", (url) => {
    expect(() => validatePublicUrl(url)).toThrow()
  })

  it("accepts a normal public https URL", () => {
    expect(validatePublicUrl("https://example.com/path").hostname).toBe("example.com")
  })
})
