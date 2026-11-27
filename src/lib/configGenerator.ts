import { doctorConfig } from "../config";
import type { ConnectionKind, Protocol } from "../types";

export type ClientTarget = "curl" | "python" | "nodejs" | "codex" | "claude-code" | "cline" | "n8n";

export interface ConfigInput {
  target: ClientTarget;
  protocol: Protocol;
  model: string;
  connection: ConnectionKind;
  customBaseUrl?: string;
}

export function effectiveClientProtocol(target: ClientTarget, requested: Protocol): Protocol {
  if (target === "codex") return "responses";
  if (target === "claude-code") return "anthropic";
  if (target === "cline") return "chat";
  if (target === "n8n" && requested === "anthropic") return "chat";
  return requested;
}

function baseUrl(input: ConfigInput): string {
  return input.connection === "custom"
    ? (input.customBaseUrl || "https://provider.example/v1").replace(/\/+$/, "")
    : `${doctorConfig.hefuBaseUrl}/v1`;
}

function rootUrl(input: ConfigInput): string {
  return baseUrl(input).replace(/\/v1$/, "");
}

export function generateClientConfig(input: ConfigInput): string {
  const base = baseUrl(input);
  const root = rootUrl(input);
  const model = input.model.trim() || "your-model-id";
  const key = input.connection === "hefu" ? "HEFU_API_KEY" : "AI_API_KEY";
  const bearer = `$${key}`;
  if (input.target === "codex") {
    const provider = input.connection === "hefu" ? "hefu" : "custom";
    const providerName = input.connection === "hefu" ? "HeFu AI" : "Custom OpenAI-compatible";
    return `model = "${model}"\nmodel_provider = "${provider}"\n\n[model_providers.${provider}]\nname = "${providerName}"\nbase_url = "${base}"\nwire_api = "responses"\nenv_key = "${key}"`;
  }
  if (input.target === "claude-code") {
    return `export ANTHROPIC_BASE_URL="${root}"\nexport ANTHROPIC_AUTH_TOKEN="$${key}"\nexport ANTHROPIC_MODEL="${model}"`;
  }
  if (input.target === "cline") {
    return JSON.stringify({ apiProvider: "openai", openAiBaseUrl: base, openAiApiKey: `<${key}>`, openAiModelId: model }, null, 2);
  }
  if (input.target === "n8n") {
    const responses = input.protocol === "responses";
    return `OpenAI credential\n  API Key: <${key}>\n  Base URL: ${base}\n  Organization ID: leave empty unless your provider requires it\n\nOpenAI Chat Model\n  Model: By ID → ${model}\n  Options → Base URL: leave empty to inherit the credential\n  Use Responses API: ${responses ? "On (only if /responses is supported)" : "Off (use Chat Completions)"}\n\nStart with a simple text chain. Add tools, structured output and streaming one at a time.`;
  }
  const path = input.protocol === "chat" ? "chat/completions" : input.protocol === "responses" ? "responses" : "messages";
  const body = input.protocol === "chat"
    ? { model, messages: [{ role: "user", content: "Hello" }] }
    : input.protocol === "responses"
      ? { model, input: "Hello" }
      : { model, max_tokens: 1024, messages: [{ role: "user", content: "Hello" }] };
  if (input.target === "curl") {
    return `export ${key}="your-api-key"\n\ncurl "${base}/${path}" \\\n  -H "Authorization: Bearer ${bearer}" \\\n  -H "Content-Type: application/json"${input.protocol === "anthropic" ? ' \\\n  -H "anthropic-version: 2023-06-01"' : ""} \\\n  -d '${JSON.stringify(body)}'`;
  }
  if (input.target === "python") {
    if (input.protocol === "anthropic") {
      return `import os\nfrom anthropic import Anthropic\n\nclient = Anthropic(api_key=os.environ["${key}"], base_url="${root}")\nresponse = client.messages.create(model="${model}", max_tokens=1024, messages=[{"role": "user", "content": "Hello"}])\nprint(response.content)`;
    }
    const method = input.protocol === "responses" ? "responses" : "chat.completions";
    const args = input.protocol === "responses" ? 'input="Hello"' : 'messages=[{"role": "user", "content": "Hello"}]';
    return `import os\nfrom openai import OpenAI\n\nclient = OpenAI(api_key=os.environ["${key}"], base_url="${base}")\nresponse = client.${method}.create(model="${model}", ${args})\nprint(response)`;
  }
  if (input.protocol === "anthropic") {
    return `import Anthropic from "@anthropic-ai/sdk";\n\nconst client = new Anthropic({ apiKey: process.env.${key}, baseURL: "${root}" });\nconst response = await client.messages.create({ model: "${model}", max_tokens: 1024, messages: [{ role: "user", content: "Hello" }] });\nconsole.log(response.content);`;
  }
  const method = input.protocol === "responses" ? "responses" : "chat.completions";
  const args = input.protocol === "responses" ? 'input: "Hello"' : 'messages: [{ role: "user", content: "Hello" }]';
  return `import OpenAI from "openai";\n\nconst client = new OpenAI({ apiKey: process.env.${key}, baseURL: "${base}" });\nconst response = await client.${method}.create({ model: "${model}", ${args} });\nconsole.log(response);`;
}
