import { afterEach, describe, expect, it, vi } from "vitest";
import { isLoopbackBaseUrl, normalizeBaseUrl, runDiagnostic, sanitizeDiagnosticText, validateDiagnosticInput } from "./diagnostics";
import type { DiagnosticInput, Protocol } from "../types";

function input(protocol: Protocol = "chat"): DiagnosticInput {
  return { connection: "hefu", protocol, model: "test-model", accessToken: "secret-access-token" };
}

function validBody(protocol: Protocol): Record<string, unknown> {
  if (protocol === "chat") return { choices: [{ message: { role: "assistant", content: "OK" } }] };
  if (protocol === "responses") return { object: "response", status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "OK" }] }] };
  return { type: "message", content: [{ type: "text", text: "OK" }] };
}

afterEach(() => vi.useRealTimers());

describe("diagnostic input", () => {
  it("normalizes endpoint trailing slashes", () => {
    expect(normalizeBaseUrl("https://example.com/v1///")).toBe("https://example.com/v1");
  });

  it("rejects credentials and non-HTTP endpoints", () => {
    expect(() => normalizeBaseUrl("")).toThrow("Enter a valid HTTP(S) base URL");
    expect(() => normalizeBaseUrl("https://user:pass@example.com/v1")).toThrow();
    expect(() => normalizeBaseUrl("file:///tmp/api")).toThrow();
  });

  it("requires HTTPS for public endpoints but allows local development", () => {
    expect(() => normalizeBaseUrl("http://example.com/v1")).toThrow("HTTPS");
    expect(normalizeBaseUrl("http://127.0.0.1:8000/v1")).toBe("http://127.0.0.1:8000/v1");
    expect(normalizeBaseUrl("http://[::1]:11434/v1")).toBe("http://[::1]:11434/v1");
    expect(isLoopbackBaseUrl("http://[::1]:11434/v1")).toBe(true);
  });

  it("requires public credentials but allows keyless localhost checks", () => {
    expect(validateDiagnosticInput({ ...input(), accessToken: "" })).toContain("OAuth");
    expect(validateDiagnosticInput({ connection: "custom", protocol: "chat", model: "m", baseUrl: "https://example.com/v1", apiKey: "" })).toContain("API key");
    expect(validateDiagnosticInput({ connection: "custom", protocol: "chat", model: "m", baseUrl: "http://localhost:11434/v1", apiKey: "" })).toBeNull();
  });

  it("supports custom Responses but not custom Anthropic checks", () => {
    const custom = { connection: "custom" as const, model: "m", baseUrl: "https://example.com/v1", apiKey: "k" };
    expect(validateDiagnosticInput({ ...custom, protocol: "responses" })).toBeNull();
    expect(validateDiagnosticInput({ ...custom, protocol: "anthropic" })).toContain("Chat Completions and Responses");
  });

  it("localizes preflight validation", () => {
    expect(validateDiagnosticInput({ ...input(), model: "", language: "zh-CN" })).toContain("模型");
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

  it.each(["chat", "responses", "anthropic"] as const)("validates the %s response contract without storing output", async (protocol) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(validBody(protocol)), { status: 200 }));
    const result = await runDiagnostic(input(protocol));
    expect(result.status).toBe("passed");
    expect(result.response_shape_valid).toBe(true);
    expect(JSON.stringify(result)).not.toContain("Reply with OK");
    expect(JSON.stringify(result)).not.toContain("secret-access-token");
    expect(JSON.stringify(result)).not.toContain("OK");
    const request = fetchMock.mock.calls[0][1];
    expect(request?.credentials).toBe("omit");
    expect(request?.redirect).toBe("error");
  });

  it("rejects empty protocol envelopes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    const result = await runDiagnostic(input());
    expect(result.status).toBe("failed");
    expect(result.error_code).toBe("invalid_response");
  });

  it.each([
    ["chat" as const, { choices: [{ finish_reason: "length", message: { role: "assistant", content: "" } }] }],
    ["responses" as const, { object: "response", status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [{ type: "reasoning" }] }],
    ["anthropic" as const, { type: "message", stop_reason: "max_tokens", content: [{ type: "thinking", thinking: "private" }] }],
  ])("distinguishes an exhausted %s output budget from incompatibility", async (protocol, body) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    const result = await runDiagnostic(input(protocol));
    expect(result.status).toBe("failed");
    expect(result.error_code).toBe("output_budget");
    expect(result.recommendation).toContain("larger output budget");
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("does not treat HTTP 200 alone as a successful protocol check", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ unexpected: true }), { status: 200 }));
    const result = await runDiagnostic(input());
    expect(result.status).toBe("failed");
    expect(result.error_code).toBe("invalid_response");
  });

  it("returns actionable quota guidance without copying provider error content", async () => {
    const body = { error: { message: "Private prompt and sk-live-secret must not be copied" } };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status: 402 }));
    const result = await runDiagnostic(input());
    expect(result.status).toBe("failed");
    expect(result.message).toBe("The account has insufficient usable balance for this model.");
    expect(result.recommendation).toContain("wallet currency");
    expect(JSON.stringify(result)).not.toContain("Private prompt");
    expect(JSON.stringify(result)).not.toContain("sk-live-secret");
  });

  it("turns network and CORS failures into safe guidance", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await runDiagnostic(input());
    expect(result.error_code).toBe("network_error");
    expect(result.recommendation).toContain("CORS");
  });

  it("classifies request timeouts separately", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const pending = runDiagnostic(input());
    await vi.advanceTimersByTimeAsync(60_000);
    const result = await pending;
    expect(result.error_code).toBe("timeout");
    expect(result.recommendation).toContain("billing stopped");
  });

  it("omits the Authorization header for keyless local endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(validBody("chat")), { status: 200 }));
    await runDiagnostic({ connection: "custom", protocol: "chat", model: "local", baseUrl: "http://localhost:11434/v1", apiKey: "" });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("authorization")).toBeNull();
  });

  it("localizes standard guidance and successful results", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(validBody("chat")), { status: 200 }));
    const result = await runDiagnostic({ ...input(), language: "zh-CN" });
    expect(result.message).toContain("符合该协议");
    expect(result.recommendation).toContain("生产使用前");
  });
});
