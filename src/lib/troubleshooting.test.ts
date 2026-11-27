import { describe, expect, it } from "vitest";
import { isTroubleshootingClient, isTroubleshootingSymptom, troubleshootingAdvice } from "./troubleshooting";

const clients = ["codex", "n8n"] as const;
const symptoms = ["not-found", "auth", "rate-limit", "client-only"] as const;

describe("client troubleshooting", () => {
  it("provides bilingual checklists for every client and symptom", () => {
    for (const client of clients) {
      for (const symptom of symptoms) {
        for (const language of ["en", "zh-CN"] as const) {
          const result = troubleshootingAdvice(client, symptom, language);
          expect(result.title.length).toBeGreaterThan(10);
          expect(result.summary.trim().length).toBeGreaterThan(0);
          expect(result.steps).toHaveLength(3);
          expect(result.steps.every((step) => step.trim().length > 0)).toBe(true);
          expect(result.guidePath).toContain(`guides/${client === "codex" ? "codex-responses-404" : "n8n-openai-compatible-404"}/`);
        }
      }
    }
  });

  it("keeps Codex guidance on Responses and n8n guidance on comparable requests", () => {
    const codex = troubleshootingAdvice("codex", "not-found", "en");
    expect(codex.configProtocol).toBe("responses");
    expect(codex.steps.join(" ")).toContain("wire_api");
    expect(codex.summary).toContain("Responses API");

    const n8n = troubleshootingAdvice("n8n", "client-only", "en");
    expect(n8n.configTarget).toBe("n8n");
    expect(n8n.steps.join(" ")).toContain("simple text chain");
    expect(n8n.steps.join(" ")).toContain("one at a time");
  });

  it("uses localized guide paths and allowlisted URL values", () => {
    expect(troubleshootingAdvice("n8n", "not-found", "zh-CN").guidePath).toBe("zh-cn/guides/n8n-openai-compatible-404/");
    expect(isTroubleshootingClient("codex")).toBe(true);
    expect(isTroubleshootingClient("other")).toBe(false);
    expect(isTroubleshootingSymptom("not-found")).toBe(true);
    expect(isTroubleshootingSymptom("other")).toBe(false);
  });
});
