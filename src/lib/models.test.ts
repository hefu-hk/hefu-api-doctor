import { describe, expect, it } from "vitest";
import { chatModels, estimateTestCost, modelLabel } from "./models";

describe("model helpers", () => {
  it("only offers chat-capable authorized models", () => {
    const models = [{ id: "chat", api_modes: ["chat"] }, { id: "image", api_modes: ["image"] }];
    expect(chatModels(models).map((item) => item.id)).toEqual(["chat"]);
  });

  it("shows both display and public IDs when different", () => {
    expect(modelLabel({ id: "model-a", display_name: "Model A" })).toBe("Model A (model-a)");
  });

  it("estimates the bounded test list price", () => {
    expect(estimateTestCost({ id: "model-a", currency: "USD", standard_price_input: 1, standard_price_output: 2 })?.amount).toBeCloseTo(0.000076);
  });
});
