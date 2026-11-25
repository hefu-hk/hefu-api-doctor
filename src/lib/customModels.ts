import { isLoopbackBaseUrl, normalizeBaseUrl } from "./diagnostics";

export async function fetchCustomModelIds(baseUrl: string, apiKey: string): Promise<string[]> {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!isLoopbackBaseUrl(normalized) && !apiKey.trim()) {
    throw new Error("Enter the API key for this public endpoint.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${normalized}/models`, {
      headers: {
        Accept: "application/json",
        ...(apiKey.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : {}),
      },
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Model list request failed (HTTP ${response.status}).`);
    const payload = await response.json().catch(() => null) as { data?: unknown } | null;
    if (!payload || !Array.isArray(payload.data)) throw new Error("The endpoint did not return a standard model list.");
    const ids = payload.data.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const id = (item as Record<string, unknown>).id;
      return typeof id === "string" && id.trim() ? [id.trim()] : [];
    });
    return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
  } catch (error) {
    if (controller.signal.aborted) throw new Error("The model list request timed out after 15 seconds.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
