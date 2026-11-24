import { doctorConfig } from "../config";
import type { DiagnosticInput, DiagnosticResult, Protocol } from "../types";

const TEST_PROMPT = "Reply with OK only.";
const MAX_TEST_TOKENS = 32;

export function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  const url = new URL(trimmed);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Enter a valid HTTP(S) base URL without credentials or query parameters.");
  }
  if (url.protocol === "http:" && !["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
    throw new Error("HTTPS is required for public endpoints so credentials are not sent in plaintext.");
  }
  return trimmed;
}

function endpoint(input: DiagnosticInput): string {
  const suffix = input.protocol === "chat" ? "chat/completions" : input.protocol === "responses" ? "responses" : "messages";
  if (input.connection === "hefu") return `${doctorConfig.hefuBaseUrl}/api/v1/ext/${suffix}`;
  return `${normalizeBaseUrl(input.baseUrl || "")}/${suffix}`;
}

function requestBody(input: DiagnosticInput): Record<string, unknown> {
  if (input.protocol === "chat") {
    return {
      model: input.model,
      messages: [{ role: "user", content: TEST_PROMPT }],
      max_tokens: MAX_TEST_TOKENS,
      stream: false,
    };
  }
  if (input.protocol === "responses") {
    return { model: input.model, input: TEST_PROMPT, max_output_tokens: MAX_TEST_TOKENS, stream: false };
  }
  return {
    model: input.model,
    messages: [{ role: "user", content: TEST_PROMPT }],
    max_tokens: MAX_TEST_TOKENS,
    stream: false,
  };
}

export function validateDiagnosticInput(input: DiagnosticInput): string | null {
  if (!input.model.trim()) return "Select or enter a model ID.";
  if (input.connection === "hefu" && !input.accessToken) return "Connect with HeFu OAuth first.";
  if (input.connection === "custom") {
    if (!input.apiKey?.trim()) return "Enter the API key for this custom endpoint.";
    if (input.protocol !== "chat") return "Custom endpoints currently support Chat Completions checks.";
    try {
      normalizeBaseUrl(input.baseUrl || "");
    } catch (error) {
      return error instanceof Error ? error.message : "Enter a valid base URL.";
    }
  }
  return null;
}

function validResponseShape(protocol: Protocol, payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Record<string, unknown>;
  if (protocol === "chat") return Array.isArray(value.choices);
  if (protocol === "responses") return value.object === "response" || Array.isArray(value.output);
  return value.type === "message" && Array.isArray(value.content);
}

function rawErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const root = payload as Record<string, unknown>;
  const candidates = [root.error, root.detail, root];
  for (const candidate of candidates) {
    if (typeof candidate === "string") return candidate;
    if (candidate && typeof candidate === "object") {
      const value = candidate as Record<string, unknown>;
      for (const key of ["message_en", "message", "error", "detail"]) {
        if (typeof value[key] === "string") return value[key] as string;
      }
    }
  }
  return "";
}

export function sanitizeDiagnosticText(value: string): string {
  const safeSentences = value
    .split(/(?<=[.!?。！？])\s+/)
    .filter((sentence) => !/(?:channel|provider|upstream|渠道|上游)/i.test(sentence))
    .join(" ");
  return safeSentences
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[endpoint]")
    .replace(/\b(?:sk|key|token|oc|os)[_-][A-Za-z0-9._~-]+/gi, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[address]")
    .trim()
    .slice(0, 500);
}

function guidance(
  status: number | null,
  errorCode?: string,
  language: "en" | "zh-CN" = "en",
): { message: string; recommendation: string } {
  const zh = language === "zh-CN";
  if (status === 400 || status === 422) {
    return {
      message: zh ? "端点拒绝了请求参数。" : "The endpoint rejected the request parameters.",
      recommendation: zh ? "检查公开模型 ID 和该协议的必填字段，核对 max_tokens 或 max_output_tokens，并移除不支持的参数。" : "Check the public model ID and required fields for this protocol. Review max_tokens or max_output_tokens and remove unsupported parameters.",
    };
  }
  if (status === 401) {
    return {
      message: zh ? "身份验证未通过。" : "Authentication was rejected.",
      recommendation: zh ? "重新连接 OAuth 或更换 API Key。不要在支持工单中提交真实 Key。" : "Reconnect OAuth or replace the API key. Do not share the key in a support request.",
    };
  }
  if (status === 402) {
    return {
      message: zh ? "账户可用于该模型的余额不足。" : "The account has insufficient usable balance for this model.",
      recommendation: zh ? "检查钱包币种和可用余额，充值后重试，或选择可负担的模型。" : "Check the wallet currency and available balance, then retry after adding funds or selecting an affordable model.",
    };
  }
  if (status === 403) {
    return {
      message: zh ? "当前凭据没有执行该请求的权限。" : "The credential does not have permission for this request.",
      recommendation: zh ? "检查 OAuth scope、应用模型池、账号审批和模型权限。" : "Check the OAuth scopes, application model pool, account approval and model permissions.",
    };
  }
  if (status === 404) {
    return {
      message: zh ? "未找到模型或接口端点。" : "The model or endpoint was not found.",
      recommendation: zh ? "检查 Base URL、协议路径，以及模型清单返回的准确公开模型 ID。" : "Check the base URL, protocol path and exact public model ID returned by the model list.",
    };
  }
  if (status === 429 || errorCode === "rate_limit") {
    return {
      message: zh ? "已达到速率或用量限制。" : "A rate or usage limit was reached.",
      recommendation: zh ? "按提示间隔后重试。调整接入前，分别检查 RPM、TPM、并发和日限额，不要混为一谈。" : "Retry after the indicated interval. Check RPM, TPM, concurrency and daily limits separately before changing your integration.",
    };
  }
  if (status !== null && status >= 500) {
    return {
      message: zh ? "服务暂时无法完成该请求。" : "The service could not complete the request.",
      recommendation: zh ? "稍后使用相同请求重试。若持续失败，向技术支持提供脱敏报告、请求时间和模型 ID。" : "Retry later with the same request. If it persists, share the sanitized report, request time and model ID with support.",
    };
  }
  if (errorCode === "invalid_response") {
    return {
      message: zh ? "端点返回了成功 HTTP 状态，但响应结构不符合协议。" : "The endpoint returned a successful HTTP status with an unexpected response shape.",
      recommendation: zh ? "对照所选协议契约检查响应，不要仅凭 HTTP 200 判定兼容。" : "Compare the response with the selected protocol contract. Do not treat a 200 response alone as proof of compatibility.",
    };
  }
  if (errorCode === "network_error") {
    return {
      message: zh ? "浏览器无法连接该端点。" : "The browser could not reach the endpoint.",
      recommendation: zh ? "检查 URL、网络、TLS 和浏览器 CORS 策略。报告未包含请求内容或凭据。" : "Check the URL, network, TLS and browser CORS policy. No request content or credentials were included in this report.",
    };
  }
  return {
    message: zh ? "诊断请求失败。" : "The diagnostic request failed.",
    recommendation: zh ? "查看 HTTP 状态和安全错误信息，修正配置后再执行一次请求。" : "Review the HTTP status and safe error message, correct the configuration, then run one request again.",
  };
}

export async function runDiagnostic(input: DiagnosticInput): Promise<DiagnosticResult> {
  const validation = validateDiagnosticInput(input);
  if (validation) throw new Error(validation);
  const startedAt = performance.now();
  let status: number | null = null;
  let responseShapeValid = false;
  let payload: unknown = null;
  let networkError: unknown = null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(endpoint(input), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${input.connection === "hefu" ? input.accessToken : input.apiKey}`,
        ...(input.protocol === "anthropic" ? { "anthropic-version": "2023-06-01" } : {}),
      },
      body: JSON.stringify(requestBody(input)),
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    status = response.status;
    const text = await response.text();
    if (text.length <= 1_000_000) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }
    responseShapeValid = response.ok && validResponseShape(input.protocol, payload);
  } catch (error) {
    networkError = error;
  } finally {
    clearTimeout(timeout);
  }
  const latency = Math.round(performance.now() - startedAt);
  const errorCode = networkError
    ? "network_error"
    : status !== null && status >= 200 && status < 300 && !responseShapeValid
      ? "invalid_response"
      : status === 429
        ? "rate_limit"
        : undefined;
  const passed = status !== null && status >= 200 && status < 300 && responseShapeValid;
  const fallback = guidance(status, errorCode, input.language);
  const safeDetail = sanitizeDiagnosticText(rawErrorMessage(payload));
  return {
    schema_version: "1.0",
    tool: "hefu-api-doctor",
    tool_version: doctorConfig.toolVersion,
    timestamp: new Date().toISOString(),
    connection: input.connection,
    protocol: input.protocol,
    model: input.model.trim(),
    status: passed ? "passed" : "failed",
    http_status: status,
    latency_ms: latency,
    response_shape_valid: responseShapeValid,
    error_code: passed ? undefined : errorCode || "request_failed",
    message: passed
      ? input.language === "zh-CN"
        ? "端点返回了符合该协议的有效响应。"
        : "The endpoint returned a valid response for this protocol."
      : safeDetail || fallback.message,
    recommendation: passed
      ? input.language === "zh-CN"
        ? "本次检查已通过。生产使用前，请分别验证自己的提示词、流式响应和所需能力。"
        : "This check passed. Test your own prompts, streaming and required features separately before production rollout."
      : fallback.recommendation,
  };
}
