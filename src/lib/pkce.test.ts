// @vitest-environment node
import { describe, expect, it } from "vitest";
import { base64UrlEncode, createPkcePair, randomToken } from "./pkce";

describe("PKCE", () => {
  it("uses URL-safe base64 without padding", () => {
    expect(base64UrlEncode(new Uint8Array([251, 255, 190]))).toBe("-_--");
  });

  it("creates unique high entropy state tokens", () => {
    expect(randomToken()).not.toBe(randomToken());
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("creates a standards-compliant S256 pair", async () => {
    const pair = await createPkcePair();
    expect(pair.method).toBe("S256");
    expect(pair.verifier.length).toBeGreaterThanOrEqual(43);
    expect(pair.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pair.challenge).not.toBe(pair.verifier);
  });
});
