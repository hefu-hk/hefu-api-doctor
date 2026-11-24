import type { DiagnosticResult } from "../types";

export function createSafeReport(result: DiagnosticResult): string {
  return JSON.stringify(
    {
      schema_version: result.schema_version,
      tool: result.tool,
      tool_version: result.tool_version,
      timestamp: result.timestamp,
      connection: result.connection,
      protocol: result.protocol,
      model: result.model,
      status: result.status,
      http_status: result.http_status,
      latency_ms: result.latency_ms,
      response_shape_valid: result.response_shape_valid,
      error_code: result.error_code,
      message: result.message,
      recommendation: result.recommendation,
    },
    null,
    2,
  );
}

export function reportFilename(result: DiagnosticResult): string {
  const date = result.timestamp.slice(0, 10);
  return `api-doctor-${result.protocol}-${result.status}-${date}.json`;
}
