import { describe, expect, it, vi } from "vitest";
import { fetchCustomModelIds } from "./customModels";

describe("custom model discovery", () => {
  it("loads and deduplicates standard model IDs", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "model-b" }, { id: "model-a" }, { id: "model-a" }] }), { status: 200 }));
    const ids = await fetchCustomModelIds("https://provider.example/v1/", "secret-key");
    expect(ids).toEqual(["model-a", "model-b"]);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://provider.example/v1/models");
    expect(new Headers(request?.headers).get("authorization")).toBe("Bearer secret-key");
    expect(request?.credentials).toBe("omit");
    expect(request?.redirect).toBe("error");
  });

  it("supports keyless localhost discovery", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "local-model" }] }), { status: 200 }));
    await expect(fetchCustomModelIds("http://localhost:11434/v1", "")).resolves.toEqual(["local-model"]);
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("authorization")).toBeNull();
  });

  it("rejects public discovery without a key before any request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(fetchCustomModelIds("https://provider.example/v1", "")).rejects.toThrow("API key");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses safe status errors and rejects nonstandard payloads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "private detail" }), { status: 401 }));
    await expect(fetchCustomModelIds("https://provider.example/v1", "key")).rejects.toThrow("HTTP 401");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not json", { status: 200 }));
    await expect(fetchCustomModelIds("https://provider.example/v1", "key")).rejects.toThrow("standard model list");
  });
});
