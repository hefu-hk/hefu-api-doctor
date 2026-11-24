import { describe, expect, it } from "vitest";
import { createSafeReport, reportFilename } from "./report";
import type { DiagnosticResult } from "../types";

const result: DiagnosticResult = {
  schema_version: "1.0",
  tool: "hefu-api-doctor",
  tool_version: "0.1.0",
  timestamp: "2026-11-24T00:00:00.000Z",
  connection: "hefu",
  protocol: "chat",
  model: "public-model",
  status: "failed",
  http_status: 400,
  latency_ms: 25,
  response_shape_valid: false,
  error_code: "request_failed",
  message: "Safe message",
  recommendation: "Safe recommendation",
};

describe("safe report", () => {
  it("uses an explicit safe field allowlist", () => {
    const input = { ...result, accessToken: "secret", prompt: "private", response: "private", baseUrl: "https://internal.example" };
    const report = createSafeReport(input as DiagnosticResult);
    expect(report).not.toContain("secret");
    expect(report).not.toContain("private");
    expect(report).not.toContain("internal.example");
    expect(JSON.parse(report).model).toBe("public-model");
  });

  it("creates a content-free filename", () => {
    expect(reportFilename(result)).toBe("api-doctor-chat-failed-2026-11-24.json");
  });
});
