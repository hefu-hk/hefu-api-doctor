import { describe, expect, it } from "vitest";
import { effectiveClientProtocol, generateClientConfig } from "./configGenerator";

describe("client configuration", () => {
  it("generates Codex Responses configuration without credentials", () => {
    const value = generateClientConfig({ target: "codex", protocol: "responses", model: "model-a", connection: "hefu" });
    expect(value).toContain('wire_api = "responses"');
    expect(value).toContain('model = "model-a"');
    expect(value).toContain('env_key = "HEFU_API_KEY"');
    expect(value).not.toContain("access_token");
  });

  it("uses the required protocol for fixed clients", () => {
    expect(effectiveClientProtocol("codex", "chat")).toBe("responses");
    expect(effectiveClientProtocol("claude-code", "chat")).toBe("anthropic");
    expect(effectiveClientProtocol("cline", "responses")).toBe("chat");
    expect(effectiveClientProtocol("curl", "responses")).toBe("responses");
  });

  it("generates custom Codex Responses configuration with a neutral provider name", () => {
    const value = generateClientConfig({ target: "codex", protocol: "chat", model: "local-model", connection: "custom", customBaseUrl: "http://localhost:11434/v1" });
    expect(value).toContain('model_provider = "custom"');
    expect(value).toContain("[model_providers.custom]");
    expect(value).toContain('wire_api = "responses"');
    expect(value).toContain('base_url = "http://localhost:11434/v1"');
  });

  it("uses the Anthropic root URL for Claude Code", () => {
    const value = generateClientConfig({ target: "claude-code", protocol: "anthropic", model: "model-b", connection: "hefu" });
    expect(value).toContain("ANTHROPIC_BASE_URL");
    expect(value).not.toContain("/v1\"");
  });

  it("supports custom endpoints without inserting the supplied key", () => {
    const value = generateClientConfig({ target: "python", protocol: "chat", model: "model-c", connection: "custom", customBaseUrl: "https://example.com/v1/" });
    expect(value).toContain('base_url="https://example.com/v1"');
    expect(value).toContain('os.environ["AI_API_KEY"]');
  });

  it("generates protocol-specific curl requests", () => {
    const value = generateClientConfig({ target: "curl", protocol: "anthropic", model: "model-d", connection: "hefu" });
    expect(value).toContain("/messages");
    expect(value).toContain("anthropic-version: 2023-06-01");
  });
});
