import { describe, expect, it, vi } from "vitest";
import { normalizeBaseUrl, runDiagnostic, sanitizeDiagnosticText, validateDiagnosticInput } from "./diagnostics";
import type { DiagnosticInput, Protocol } from "../types";

function input(protocol: Protocol = "chat"): DiagnosticInput {
  return { connection: "hefu", protocol, model: "test-model", accessToken: "secret-access-token" };
}

describe("diagnostic input", () => {
  it("normalizes endpoint trailing slashes", () => {
    expect(normalizeBaseUrl("https://example.com/v1///")).toBe("https://example.com/v1");
  });

  it("rejects credentials and non-HTTP endpoints", () => {
    expect(() => normalizeBaseUrl("https://user:pass@example.com/v1")).toThrow();
    expect(() => normalizeBaseUrl("file:///tmp/api")).toThrow();
  });

  it("requires HTTPS for public endpoints but allows local development", () => {
    expect(() => normalizeBaseUrl("http://example.com/v1")).toThrow("HTTPS");
    expect(normalizeBaseUrl("http://127.0.0.1:8000/v1")).toBe("http://127.0.0.1:8000/v1");
  });

  it("requires explicit credentials for the selected connection", () => {
    expect(validateDiagnosticInput({ ...input(), accessToken: "" })).toContain("OAuth");
    expect(validateDiagnosticInput({ connection: "custom", protocol: "responses", model: "m", baseUrl: "https://example.com/v1", apiKey: "k" })).toContain("Chat");
  });
});

describe("safe diagnostics", () => {
  it("removes URLs, credentials, addresses and supplier-specific sentences", () => {
    const value = sanitizeDiagnosticText("Check https://private.example/v1 with Bearer abc.def.ghi and sk-live-secret. Contact upstream channel oc_123456. Check max_tokens.");
    expect(value).not.toContain("private.example");
    expect(value).not.toContain("abc.def.ghi");
    expect(value).not.toContain("sk-live-secret");
    expect(value).not.toContain("upstream");
    expect(value).not.toContain("oc_123456");
    expect(value).toContain("Check max_tokens");
  });

  it.each([
    ["chat" as const, { choices: [{ message: { content: "OK" } }] }],
    ["responses" as const, { object: "response", output: [] }],
    ["anthropic" as const, { type: "message", content: [] }],
  ])("validates the %s response contract without storing output", async (protocol, responseBody) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 }));
    const result = await runDiagnostic(input(protocol));
    expect(result.status).toBe("passed");
    expect(result.response_shape_valid).toBe(true);
    expect(JSON.stringify(result)).not.toContain("Reply with OK");
    expect(JSON.stringify(result)).not.toContain("secret-access-token");
    const request = fetchMock.mock.calls[0][1];
    expect(request?.credentials).toBe("omit");
    expect(request?.redirect).toBe("error");
  });

  it("does not treat HTTP 200 alone as a successful protocol check", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ unexpected: true }), { status: 200 }));
    const result = await runDiagnostic(input());
    expect(result.status).toBe("failed");
    expect(result.error_code).toBe("invalid_response");
  });

  it("returns actionable quota guidance", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { message: "Insufficient wallet balance" } }), { status: 402 }));
    const result = await runDiagnostic(input());
    expect(result.status).toBe("failed");
    expect(result.message).toBe("Insufficient wallet balance");
    expect(result.recommendation).toContain("wallet currency");
  });

  it("turns network and CORS failures into safe guidance", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await runDiagnostic(input());
    expect(result.error_code).toBe("network_error");
    expect(result.recommendation).toContain("CORS");
  });

  it("localizes standard guidance and successful results", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    const result = await runDiagnostic({ ...input(), language: "zh-CN" });
    expect(result.message).toContain("符合该协议");
    expect(result.recommendation).toContain("生产使用前");
  });
});
