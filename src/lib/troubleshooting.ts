import type { Language, Protocol } from "../types";
import type { ClientTarget } from "./configGenerator";

export type TroubleshootingClient = "codex" | "n8n";
export type TroubleshootingSymptom = "not-found" | "auth" | "rate-limit" | "client-only";

export interface TroubleshootingAdvice {
  title: string;
  summary: string;
  steps: string[];
  guidePath: string;
  configTarget: ClientTarget;
  configProtocol: Protocol;
}

interface AdviceCopy {
  title: string;
  summary: string;
  steps: string[];
}

const advice: Record<TroubleshootingClient, Record<TroubleshootingSymptom, Record<Language, AdviceCopy>>> = {
  codex: {
    "not-found": {
      en: {
        title: "Codex returns 404 with a custom provider",
        summary: "Codex custom model providers use the Responses API. A Chat-only endpoint can work in cURL and still fail in Codex.",
        steps: [
          "Set base_url to the provider base, usually ending in /v1—not the full /responses or /chat/completions path.",
          "Set wire_api = \"responses\" and enter the exact public model ID. Changing it to Chat Completions is not a supported Codex workaround.",
          "Check the Responses endpoint separately. If the provider does not offer /responses, use a provider or model that supports the client you need.",
        ],
      },
      "zh-CN": {
        title: "Codex 使用自定义 Provider 时返回 404",
        summary: "Codex 自定义模型提供方使用 Responses API。仅支持 Chat 的端点即使能被 cURL 调用，也可能无法在 Codex 中使用。",
        steps: [
          "base_url 应填写服务端点，通常以 /v1 结尾，不要填入完整的 /responses 或 /chat/completions 路径。",
          "设置 wire_api = \"responses\" 并输入准确的公开模型 ID。改成 Chat Completions 并不是 Codex 支持的规避方式。",
          "单独检查 Responses 端点。如果服务商不提供 /responses，应更换支持该客户端所需协议的服务商或模型。",
        ],
      },
    },
    auth: {
      en: {
        title: "Codex returns 401 or 403",
        summary: "Check the credential visible to the Codex process before changing the endpoint.",
        steps: [
          "Set the environment variable named by env_key in the same terminal, container or service runtime that starts Codex. Keep the actual key out of TOML and tickets.",
          "For 401, renew or replace the key. For 403, check model access, application pools and account permissions; a Base URL change does not grant permission.",
          "Start a new Codex process after correcting the environment so it does not retain the previous credential.",
        ],
      },
      "zh-CN": {
        title: "Codex 返回 401 或 403",
        summary: "先检查 Codex 进程实际读取到的凭据，不要先修改端点。",
        steps: [
          "在启动 Codex 的同一终端、容器或服务环境中设置 env_key 指向的环境变量。真实 Key 不要写入 TOML 或工单。",
          "401 应更新或更换 Key；403 应检查模型权限、应用模型池和账号权限，修改 Base URL 不会增加权限。",
          "修正环境后重新启动 Codex，避免进程继续使用旧凭据。",
        ],
      },
    },
    "rate-limit": {
      en: {
        title: "Codex reaches a rate or usage limit",
        summary: "Separate provider limits from client retries before running another request.",
        steps: [
          "Check the provider's rate limit, usable balance and Retry-After guidance. RPM, TPM, concurrency and daily quota are different limits.",
          "Review Codex request and stream retry settings. Repeated manual attempts can add more load and may increase charges.",
          "Wait for the indicated interval, then run one controlled request instead of repeatedly restarting the client.",
        ],
      },
      "zh-CN": {
        title: "Codex 触发速率或用量限制",
        summary: "重试前先区分服务商限制与客户端重试。",
        steps: [
          "检查服务商速率限制、可用余额和 Retry-After 提示。RPM、TPM、并发和每日额度是不同限制。",
          "检查 Codex 的请求与流式重试设置。反复手动重试会继续增加负载，也可能增加费用。",
          "按提示等待后只执行一次受控请求，不要连续重启客户端。",
        ],
      },
    },
    "client-only": {
      en: {
        title: "cURL works but Codex fails",
        summary: "Compare the protocol and effective request, not only the API key and HTTP status.",
        steps: [
          "Confirm that the working cURL request and Codex both use Responses. A successful Chat Completions request does not prove Codex compatibility.",
          "Use the same base URL and exact model ID, then try one minimal Codex prompt before adding custom tools or MCP servers.",
          "Validate non-streaming Responses first, then test streaming and required tools in your own integration. A basic API Doctor pass does not prove those capabilities.",
        ],
      },
      "zh-CN": {
        title: "cURL 成功但 Codex 失败",
        summary: "需要比较协议和实际请求，不能只比较 API Key 与 HTTP 状态。",
        steps: [
          "确认成功的 cURL 请求与 Codex 都使用 Responses。Chat Completions 成功不能证明 Codex 兼容。",
          "使用相同 Base URL 和准确模型 ID，先用一个最小 Codex 提示词测试，再接入自定义工具或 MCP Server。",
          "先验证非流式 Responses，再在自己的集成中验证流式和所需工具。API Doctor 的基础检查通过不代表这些能力均已验证。",
        ],
      },
    },
  },
  n8n: {
    "not-found": {
      en: {
        title: "The n8n model node returns 404",
        summary: "Check the effective Base URL, exact model ID and whether the node is using Chat Completions or Responses.",
        steps: [
          "In the OpenAI credential, use the provider base including /v1. Check Options → Base URL on the OpenAI Chat Model node too; a node override can replace the credential value.",
          "Enter the exact model ID directly if GET /models is unavailable or the desired model is not listed.",
          "Disable Use Responses API unless the provider supports /responses. Inspect the effective path for missing or doubled /v1 and endpoint segments.",
        ],
      },
      "zh-CN": {
        title: "n8n 模型节点返回 404",
        summary: "检查实际生效的 Base URL、准确模型 ID，以及节点使用 Chat Completions 还是 Responses。",
        steps: [
          "OpenAI 凭据中的 Base URL 通常应包含 /v1，同时检查 OpenAI Chat Model 节点的 Options → Base URL；节点覆盖项可能取代凭据值。",
          "如果 GET /models 不可用或列表没有目标模型，直接输入准确的模型 ID。",
          "除非服务商支持 /responses，否则关闭 Use Responses API。检查实际路径是否缺少或重复 /v1 和端点片段。",
        ],
      },
    },
    auth: {
      en: {
        title: "The n8n model node returns 401 or 403",
        summary: "Verify the selected credential and any node-level endpoint override.",
        steps: [
          "Put the provider key in the OpenAI credential's API Key field. For a non-OpenAI provider, leave Organization ID empty unless the provider explicitly requires it.",
          "Confirm that the node uses that credential and that Options → Base URL does not send the same key to a different provider.",
          "For 401, replace the key. For 403, check model and account permissions. Never paste the credential into a workflow or support ticket.",
        ],
      },
      "zh-CN": {
        title: "n8n 模型节点返回 401 或 403",
        summary: "核对节点选择的凭据以及节点级端点覆盖项。",
        steps: [
          "将服务商 Key 填入 OpenAI 凭据的 API Key 字段。非 OpenAI 服务商通常应将 Organization ID 留空，除非对方明确要求。",
          "确认节点使用该凭据，并检查 Options → Base URL 是否把同一个 Key 发往了不同服务商。",
          "401 应更换 Key；403 应检查模型和账号权限。不要把凭据粘贴到工作流或支持工单中。",
        ],
      },
    },
    "rate-limit": {
      en: {
        title: "n8n reaches a rate or usage limit",
        summary: "Retries in the node, workflow and gateway can multiply one logical operation.",
        steps: [
          "Check the provider limit and Retry-After value before changing n8n settings.",
          "Review the model node's Max Retries, the node's Retry On Fail setting and any gateway retries. Temporarily disable extra retries while isolating the failure.",
          "Restore only intentional retry behavior after the underlying limit is fixed, and account for possible charges from every attempt.",
        ],
      },
      "zh-CN": {
        title: "n8n 触发速率或用量限制",
        summary: "节点、工作流和网关的重试可能把一次逻辑操作放大成多个请求。",
        steps: [
          "修改 n8n 设置前，先检查服务商限制和 Retry-After 值。",
          "检查模型节点的 Max Retries、节点 Retry On Fail 设置和网关重试。定位故障时暂时关闭额外重试。",
          "解决根本限制后只恢复确有需要的重试，并将每次尝试可能产生的费用纳入考虑。",
        ],
      },
    },
    "client-only": {
      en: {
        title: "The HTTP Request node works but the model node fails",
        summary: "Reduce the workflow to one comparable text request before debugging an AI Agent.",
        steps: [
          "Use the same base URL, exact model ID, credential and API surface in both nodes. A full chat URL in an HTTP Request node is not the same field as a model node's Base URL.",
          "Test the model in a simple text chain with streaming, tools and structured output disabled before using an AI Agent.",
          "Reintroduce tools, JSON output and streaming one at a time. A plain text pass does not prove support for those features.",
        ],
      },
      "zh-CN": {
        title: "HTTP Request 节点成功但模型节点失败",
        summary: "先将工作流缩减为一个可对照的文本请求，再排查 AI Agent。",
        steps: [
          "两个节点应使用相同 Base URL、准确模型 ID、凭据和 API 协议。HTTP Request 中的完整聊天 URL 与模型节点的 Base URL 不是同一个字段。",
          "先在简单文本链中测试模型，关闭流式、工具和结构化输出，再接入 AI Agent。",
          "每次只恢复工具、JSON 输出或流式中的一项。普通文本通过不代表这些能力均受支持。",
        ],
      },
    },
  },
};

export function troubleshootingAdvice(
  client: TroubleshootingClient,
  symptom: TroubleshootingSymptom,
  language: Language,
): TroubleshootingAdvice {
  const guide = client === "codex" ? "codex-responses-404" : "n8n-openai-compatible-404";
  return {
    ...advice[client][symptom][language],
    guidePath: `${language === "zh-CN" ? "zh-cn/" : ""}guides/${guide}/`,
    configTarget: client,
    configProtocol: client === "codex" ? "responses" : "chat",
  };
}

export function isTroubleshootingClient(value: string | null): value is TroubleshootingClient {
  return value === "codex" || value === "n8n";
}

export function isTroubleshootingSymptom(value: string | null): value is TroubleshootingSymptom {
  return value === "not-found" || value === "auth" || value === "rate-limit" || value === "client-only";
}
