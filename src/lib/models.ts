import type { ModelInfo, Protocol } from "../types";

const diagnosticProtocols: Protocol[] = ["chat", "responses", "anthropic"];

export function modelProtocols(model: ModelInfo | undefined): Protocol[] {
  if (!model) return [];
  return diagnosticProtocols.filter((protocol) => (model.api_modes || []).includes(protocol));
}

export function supportsProtocol(model: ModelInfo | undefined, protocol: Protocol): boolean {
  return modelProtocols(model).includes(protocol);
}

export function diagnosticModels(models: ModelInfo[]): ModelInfo[] {
  return models.filter((model) => modelProtocols(model).length > 0);
}

export function modelLabel(model: ModelInfo): string {
  const name = model.display_name || model.id;
  return name === model.id ? name : `${name} (${model.id})`;
}

export function estimateTestCost(model: ModelInfo | undefined): { currency: string; amount: number } | null {
  if (!model?.currency) return null;
  const input = Number(model.standard_price_input || 0);
  const output = Number(model.standard_price_output || 0);
  if (input <= 0 && output <= 0) return null;
  return { currency: model.currency, amount: (input * 12 + output * 32) / 1_000_000 };
}
