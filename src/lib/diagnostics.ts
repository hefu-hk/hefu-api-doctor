import { doctorConfig } from "../config";
import type { DiagnosticInput, DiagnosticResult, Protocol } from "../types";

const TEST_PROMPT = "Reply with OK only.";
const MAX_TEST_TOKENS = 32;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function loopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

export function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid HTTP(S) base URL without credentials or query parameters.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Enter a valid HTTP(S) base URL without credentials or query parameters.");
  }
  if (url.protocol === "http:" && !loopbackHostname(url.hostname)) {
    throw new Error("HTTPS is required for public endpoints so credentials are not sent in plaintext.");
  }
  return trimmed;
}

export function isLoopbackBaseUrl(value: string): boolean {
  try {
    return loopbackHostname(new URL(normalizeBaseUrl(value)).hostname);
  } catch {
    return false;
  }
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
  const zh = input.language === "zh-CN";
  if (!input.model.trim()) return zh ? "请选择或输入模型 ID。" : "Select or enter a model ID.";
  if (input.connection === "hefu" && !input.accessToken) return zh ? "请先通过合富宝 OAuth 连接。" : "Connect with HeFu OAuth first.";
  if (input.connection === "custom") {
    try {
      normalizeBaseUrl(input.baseUrl || "");
    } catch (error) {
      if (zh) {
        const httpsRequired = error instanceof Error && error.message.includes("HTTPS");
        return httpsRequired ? "公网端点必须使用 HTTPS，避免凭据被明文传输。" : "请输入不含凭据和查询参数的有效 HTTP(S) Base URL。";
      }
      return error instanceof Error ? error.message : "Enter a valid base URL.";
    }
    if (!isLoopbackBaseUrl(input.baseUrl || "") && !input.apiKey?.trim()) {
      return zh ? "请输入此公网端点的 API Key。" : "Enter the API key for this public endpoint.";
    }
    if (!["chat", "responses"].includes(input.protocol)) {
      return zh ? "自定义端点目前支持 Chat Completions 和 Responses 检查。" : "Custom endpoints currently support Chat Completions and Responses checks.";
    }
  }
  return null;
}

function validChatShape(value: Record<string, unknown>): boolean {
  if (!Array.isArray(value.choices) || value.choices.length === 0) return false;
  return value.choices.some((choice) => {
    if (!isRecord(choice) || !isRecord(choice.message) || typeof choice.message.role !== "string") return false;
    const message = choice.message;
    return (typeof message.content === "string" && message.content.length > 0)
      || (Array.isArray(message.content) && message.content.length > 0 && message.content.every(isRecord))
      || (message.content === null && (typeof message.refusal === "string" || Array.isArray(message.tool_calls)));
  });
}

function validResponsesShape(value: Record<string, unknown>): boolean {
  if (value.object !== "response" || !Array.isArray(value.output)) return false;
  return value.output.some((item) => {
    if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) return false;
    return item.content.some((part) => isRecord(part) && part.type === "output_text" && typeof part.text === "string" && part.text.length > 0);
  });
}

function validAnthropicShape(value: Record<string, unknown>): boolean {
  if (value.type !== "message" || !Array.isArray(value.content) || value.content.length === 0) return false;
  return value.content.some((part) => {
    if (!isRecord(part)) return false;
    return (part.type === "text" && typeof part.text === "string" && part.text.length > 0)
      || (part.type === "tool_use" && typeof part.name === "string" && isRecord(part.input));
  });
}

function validResponseShape(protocol: Protocol, payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  if (protocol === "chat") return validChatShape(payload);
  if (protocol === "responses") return validResponsesShape(payload);
  return validAnthropicShape(payload);
}

function outputBudgetExhausted(protocol: Protocol, payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  if (protocol === "chat" && Array.isArray(payload.choices)) {
    return payload.choices.some((choice) => isRecord(choice) && choice.finish_reason === "length");
  }
  if (protocol === "anthropic") return payload.stop_reason === "max_tokens";
  return payload.status === "incomplete"
    && isRecord(payload.incomplete_details)
    && payload.incomplete_details.reason === "max_output_tokens";
}

function providerRateLimit(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  const error = payload.error;
  if (!isRecord(error)) return false;
  return [error.code, error.type].some((code) => typeof code === "string" && /^(rate_limit|rate_limit_error|insufficient_quota)$/i.test(code));
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
      recommendation: zh ? "检查 Base URL 是否包含所需的 /v1、协议路径，以及模型清单返回的准确公开模型 ID。" : "Check whether the base URL needs /v1, the protocol path and the exact public model ID returned by the model list.",
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
  if (errorCode === "output_budget") {
    return {
      message: zh ? "模型在生成可见消息前用完了本次 32-token 测试预算。" : "The model used the 32-token test budget before producing a visible message.",
      recommendation: zh ? "这不等于协议不兼容。请在自己的集成中用更大的输出预算复测；本工具不会自动追加计费请求。" : "This does not prove protocol incompatibility. Retest in your own integration with a larger output budget; this tool will not send an automatic follow-up request.",
    };
  }
  if (errorCode === "invalid_response") {
    return {
      message: zh ? "端点返回了成功 HTTP 状态，但响应结构不符合协议。" : "The endpoint returned a successful HTTP status with an unexpected response shape.",
      recommendation: zh ? "对照所选协议契约检查响应，不要仅凭 HTTP 200 判定兼容。" : "Compare the response with the selected protocol contract. Do not treat a 200 response alone as proof of compatibility.",
    };
  }
  if (errorCode === "timeout") {
    return {
      message: zh ? "请求在 60 秒内未完成。" : "The request did not complete within 60 seconds.",
      recommendation: zh ? "检查服务和模型负载后再手动重试。浏览器超时不能证明服务端已停止计费或处理。" : "Check service and model load before manually retrying. A browser timeout does not prove that server-side processing or billing stopped.",
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
  let timedOut = false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (input.connection === "hefu") headers.Authorization = `Bearer ${input.accessToken}`;
    else if (input.apiKey?.trim()) headers.Authorization = `Bearer ${input.apiKey.trim()}`;
    if (input.protocol === "anthropic") headers["anthropic-version"] = "2023-06-01";
    const response = await fetch(endpoint(input), {
      method: "POST",
      headers,
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
    timedOut = controller.signal.aborted;
  } finally {
    clearTimeout(timeout);
  }
  const latency = Math.round(performance.now() - startedAt);
  const successfulStatus = status !== null && status >= 200 && status < 300;
  const budgetExhausted = successfulStatus && outputBudgetExhausted(input.protocol, payload);
  const errorCode = timedOut
    ? "timeout"
    : networkError
      ? "network_error"
      : status === 429 || providerRateLimit(payload)
        ? "rate_limit"
        : budgetExhausted
          ? "output_budget"
          : successfulStatus && !responseShapeValid
            ? "invalid_response"
            : undefined;
  const passed = successfulStatus && responseShapeValid && !budgetExhausted;
  const fallback = guidance(status, errorCode, input.language);
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
      : fallback.message,
    recommendation: passed
      ? input.language === "zh-CN"
        ? "本次检查已通过。生产使用前，请分别验证自己的提示词、流式响应和所需能力。"
        : "This check passed. Test your own prompts, streaming and required features separately before production rollout."
      : fallback.recommendation,
  };
}
