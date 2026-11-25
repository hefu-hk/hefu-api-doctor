import { describe, expect, it } from "vitest";
import { diagnosticModels, estimateTestCost, modelLabel, modelProtocols, supportsProtocol } from "./models";

describe("model helpers", () => {
  it("offers every model with at least one diagnostic protocol", () => {
    const models = [
      { id: "chat", api_modes: ["chat"] },
      { id: "responses", api_modes: ["responses"] },
      { id: "anthropic", api_modes: ["anthropic"] },
      { id: "image", api_modes: ["image"] },
    ];
    expect(diagnosticModels(models).map((item) => item.id)).toEqual(["chat", "responses", "anthropic"]);
  });

  it("uses advertised capabilities to prevent incompatible requests", () => {
    const model = { id: "responses", api_modes: ["responses"] };
    expect(modelProtocols(model)).toEqual(["responses"]);
    expect(supportsProtocol(model, "responses")).toBe(true);
    expect(supportsProtocol(model, "chat")).toBe(false);
  });

  it("shows both display and public IDs when different", () => {
    expect(modelLabel({ id: "model-a", display_name: "Model A" })).toBe("Model A (model-a)");
  });

  it("estimates the bounded test list price", () => {
    expect(estimateTestCost({ id: "model-a", currency: "USD", standard_price_input: 1, standard_price_output: 2 })?.amount).toBeCloseTo(0.000076);
  });
});
