import type { ModelInfo } from "../types";

export function chatModels(models: ModelInfo[]): ModelInfo[] {
  return models.filter((model) => (model.api_modes || []).includes("chat"));
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
