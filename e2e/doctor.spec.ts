import { expect, test } from "@playwright/test";

const model = {
  id: "demo-chat",
  display_name: "Demo Chat",
  model_category: "chat",
  api_modes: ["chat", "anthropic", "responses"],
  currency: "USD",
  standard_price_input: 1,
  standard_price_output: 2,
};

const chatBody = { choices: [{ message: { role: "assistant", content: "OK" } }] };
const responsesBody = { object: "response", status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "OK" }] }] };

async function selectCustom(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "OpenAI-compatible", exact: true }).click();
}

test("generates configuration without login and supports Chinese and mobile", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Verify your AI API before your users do." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Source", exact: true })).toHaveAttribute("href", "https://github.com/hefu-hk/hefu-api-doctor");
  await expect(page.getByRole("link", { name: "API docs" })).toHaveAttribute("href", /utm_source=api-doctor/);
  await page.getByRole("tab", { name: "Configuration generator" }).click();
  await page.getByLabel("Model ID").fill("demo-chat");
  await expect(page.locator("pre")).toContainText('model = "demo-chat"');
  await expect(page.locator("pre")).toContainText('wire_api = "responses"');
  await expect(page.getByText("Current Codex CLI supports only the Responses API")).toBeVisible();
  await expect(page.locator("pre")).not.toContainText("access_token");
  await page.getByRole("button", { name: "中文" }).click();
  await expect(page.getByRole("heading", { name: "在你的用户遇到问题前，先验证 AI API。" })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("custom endpoint check sends one request and exports a credential-free report", async ({ page }) => {
  let calls = 0;
  await page.route("https://provider.example/v1/chat/completions", async (route) => {
    calls += 1;
    expect(route.request().headers()["authorization"]).toBe("Bearer test-custom-key");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(chatBody) });
  });
  await page.goto("./");
  await selectCustom(page);
  await page.getByLabel("Base URL").fill("https://provider.example/v1");
  await page.getByLabel("API key", { exact: true }).fill("test-custom-key");
  await page.getByLabel("Model", { exact: true }).fill("demo-chat");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Run one live check" }).click();
  await expect(page.locator(".result-status")).toHaveText("PASSED");
  expect(calls).toBe(1);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download safe JSON report" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const content = await (await import("node:fs/promises")).readFile(path!, "utf8");
  expect(content).not.toContain("test-custom-key");
  expect(content).not.toContain("provider.example");
  expect(content).not.toContain("Reply with OK");
  expect(content).not.toContain("OK");
  expect(JSON.parse(content).status).toBe("passed");
});

test("discovers local models, preflights without generation and checks Responses", async ({ page }) => {
  let modelListCalls = 0;
  let generationCalls = 0;
  await page.route("http://localhost:11434/v1/models", async (route) => {
    modelListCalls += 1;
    expect(route.request().headers()["authorization"]).toBeUndefined();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [{ id: "local-responses" }, { id: "local-chat" }] }) });
  });
  await page.route("http://localhost:11434/v1/responses", async (route) => {
    generationCalls += 1;
    expect(route.request().headers()["authorization"]).toBeUndefined();
    expect(route.request().postDataJSON().max_output_tokens).toBe(32);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(responsesBody) });
  });
  await page.goto("./");
  await selectCustom(page);
  await page.getByRole("button", { name: "Use local Ollama" }).click();
  await expect(page.getByLabel("API key (optional for localhost)")).toHaveValue("");
  await page.getByRole("button", { name: "Load model IDs" }).click();
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("local-chat");
  expect(modelListCalls).toBe(1);
  await page.getByLabel("Model", { exact: true }).fill("local-responses");
  await page.getByRole("combobox", { name: "Protocol", exact: true }).selectOption("responses");
  await page.getByRole("button", { name: "Validate setup — free" }).click();
  await expect(page.getByText("Setup checks passed. No network or model request was sent.")).toBeVisible();
  expect(generationCalls).toBe(0);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Run one live check" }).click();
  await expect(page.locator(".result-status")).toHaveText("PASSED");
  expect(generationCalls).toBe(1);
  await page.getByRole("button", { name: "Generate client setup" }).click();
  await page.getByLabel("Client").selectOption("codex");
  await expect(page.locator("pre")).toContainText('model_provider = "custom"');
  await expect(page.locator("pre")).toContainText('wire_api = "responses"');
  await expect(page.locator("pre")).toContainText('base_url = "http://localhost:11434/v1"');
});

test("OAuth callback uses PKCE without a client secret and loads authorized models", async ({ page }) => {
  let tokenBody: Record<string, unknown> = {};
  await page.addInitScript(() => {
    sessionStorage.setItem("hefu-api-doctor.oauth.transaction", JSON.stringify({ state: "known-state", verifier: "a".repeat(43), created_at: Date.now() }));
  });
  await page.route("**/api/v1/oauth/token", async (route) => {
    tokenBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "test-access-token", refresh_token: "test-refresh-token", expires_in: 7200, scope: "ext_api ext_models:read" }) });
  });
  await page.route("**/api/v1/ext/models", async (route) => {
    expect(route.request().headers()["authorization"]).toBe("Bearer test-access-token");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ object: "list", data: [model] }) });
  });
  await page.route("**/api/v1/ext/chat/completions", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(chatBody) });
  });
  await page.goto("./?code=one-time-code&state=known-state");
  await expect(page.getByText("Connected for this tab")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Model", exact: true })).toHaveValue("demo-chat");
  expect(tokenBody.client_secret).toBeUndefined();
  expect(tokenBody.code_verifier).toBe("a".repeat(43));
  await expect(page).not.toHaveURL(/code=/);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Run one live check" }).click();
  await expect(page.locator(".result-status")).toHaveText("PASSED");
  await page.getByRole("button", { name: "Generate client setup" }).click();
  await expect(page.locator("pre")).toContainText('"model":"demo-chat"');
  const stored = await page.evaluate(() => sessionStorage.getItem("hefu-api-doctor.oauth.session"));
  expect(stored).toBeNull();
});

test("selects only protocols advertised by the authorized model", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("hefu-api-doctor.oauth.transaction", JSON.stringify({ state: "known-state", verifier: "a".repeat(43), created_at: Date.now() }));
  });
  await page.route("**/api/v1/oauth/token", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "test-access-token", expires_in: 7200 }) });
  });
  await page.route("**/api/v1/ext/models", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [{ ...model, id: "responses-only", api_modes: ["responses"] }] }) });
  });
  await page.goto("./?code=one-time-code&state=known-state");
  await expect(page.getByRole("combobox", { name: "Protocol", exact: true })).toHaveValue("responses");
  await expect(page.getByRole("combobox", { name: "Protocol", exact: true }).locator("option")).toHaveCount(1);
  await expect(page.locator(".capability-row")).toContainText("responses");
});

test("rejects OAuth state mismatch before token exchange", async ({ page }) => {
  let tokenCalls = 0;
  await page.route("**/api/v1/oauth/token", async (route) => {
    tokenCalls += 1;
    await route.fulfill({ status: 400, body: "{}" });
  });
  await page.goto("./?code=one-time-code&state=wrong-state");
  await expect(page.getByRole("alert")).toContainText("OAuth state validation failed");
  expect(tokenCalls).toBe(0);
});

test("rejects expired OAuth transactions before token exchange", async ({ page }) => {
  let tokenCalls = 0;
  await page.addInitScript(() => {
    sessionStorage.setItem("hefu-api-doctor.oauth.transaction", JSON.stringify({ state: "known-state", verifier: "a".repeat(43), created_at: Date.now() - 11 * 60_000 }));
  });
  await page.route("**/api/v1/oauth/token", async (route) => {
    tokenCalls += 1;
    await route.fulfill({ status: 400, body: "{}" });
  });
  await page.goto("./?code=one-time-code&state=known-state");
  await expect(page.getByRole("alert")).toContainText("Authorization session expired");
  expect(tokenCalls).toBe(0);
});

test("failed responses remain actionable and never expose raw output", async ({ page }) => {
  await page.route("https://provider.example/v1/chat/completions", async (route) => {
    await route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: { message: "Private prompt at https://upstream.example with sk-secret" } }) });
  });
  await page.goto("./");
  await selectCustom(page);
  await page.getByLabel("Base URL").fill("https://provider.example/v1");
  await page.getByLabel("API key", { exact: true }).fill("test-custom-key");
  await page.getByLabel("Model", { exact: true }).fill("demo-chat");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Run one live check" }).click();
  await expect(page.locator(".result-status")).toHaveText("FAILED");
  await expect(page.locator(".result-detail")).toContainText("RPM, TPM, concurrency and daily limits separately");
  await expect(page.locator(".result-detail")).not.toContainText("Private prompt");
  await expect(page.locator(".result-detail")).not.toContainText("sk-secret");
  await expect(page.locator(".result-detail")).not.toContainText("upstream.example");
});

test("OAuth start preserves PKCE and adds source attribution", async ({ page }) => {
  await page.route("**/oauth/authorize?*", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>OAuth test destination</body></html>" });
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Connect with HeFu" }).click();
  await page.waitForURL(/\/oauth\/authorize/);
  const url = new URL(page.url());
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("code_challenge")).toBeTruthy();
  expect(url.searchParams.get("scope")).toBe("ext_api ext_models:read");
  expect(url.searchParams.get("utm_source")).toBe("api-doctor");
  expect(url.searchParams.get("utm_medium")).toBe("open-source");
  expect(url.searchParams.get("utm_campaign")).toBe("api-doctor-activation");
});
