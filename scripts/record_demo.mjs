import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const baseUrl = "http://127.0.0.1:4173/api-doctor/";
const output = fileURLToPath(new URL("../docs/demo.webm", import.meta.url));
const recordings = `/tmp/api-doctor-demo-${process.pid}`;
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4173", "--strictPort"], {
  cwd: root,
  env: { ...process.env, VITE_OAUTH_CLIENT_ID: "oc_000000000000000000000000" },
  stdio: "ignore",
});

let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error("Demo server did not become ready");

  await mkdir(recordings, { recursive: true });
  const localChromium = "/usr/local/bin/chromium";
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (existsSync(localChromium) ? localChromium : undefined),
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: recordings, size: { width: 960, height: 540 } },
  });
  const page = await context.newPage();
  await page.route("https://provider.example/v1/models", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: [{ id: "demo-chat" }, { id: "demo-responses" }] }),
  }));
  await page.route("https://provider.example/v1/chat/completions", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ choices: [{ message: { role: "assistant", content: "OK" } }] }),
  }));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const badge = document.createElement("div");
    badge.textContent = "Mocked demo · no billable API requests";
    badge.style.cssText = "position:fixed;left:16px;bottom:16px;z-index:100;background:#10242c;color:white;padding:8px 12px;border-radius:8px;font:12px system-ui";
    document.body.appendChild(badge);
  });
  const pause = (ms = 2000) => page.waitForTimeout(ms);
  await pause(4000);
  await page.getByRole("tab", { name: "Client configuration" }).click();
  await pause(3000);
  await page.getByLabel("Model ID").fill("demo-chat");
  await pause();
  await page.locator(".config-controls").getByLabel("Client").selectOption("curl");
  await pause();
  await page.locator(".config-controls").getByLabel("Client").selectOption("codex");
  await pause(3000);
  await page.getByRole("tab", { name: "API diagnostics" }).click();
  await pause();
  await page.getByRole("button", { name: "OpenAI-compatible", exact: true }).click();
  await pause();
  await page.getByLabel("Base URL").fill("https://provider.example/v1");
  await pause();
  await page.getByLabel("API key", { exact: true }).fill("demo-key-not-real");
  await pause(1000);
  await page.getByRole("button", { name: "Load model IDs" }).click();
  await pause(3000);
  await page.getByRole("button", { name: "Run free preflight" }).click();
  await pause(4000);
  await page.getByRole("checkbox").check();
  await pause();
  await page.getByRole("button", { name: "Run one live check" }).click();
  await page.locator(".result-status").waitFor();
  await pause(5000);
  await page.getByRole("button", { name: "Generate client setup" }).click();
  await pause(4000);
  await page.getByRole("button", { name: "中文" }).click();
  await pause(4000);
  await page.locator(".privacy-section").scrollIntoViewIfNeeded();
  await pause(4000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await pause(12000);

  const video = page.video();
  await context.close();
  if (!video) throw new Error("Demo video was not recorded");
  await video.saveAs(output);
  await rm(recordings, { recursive: true, force: true });
  console.log(`Recorded mocked demo: ${output}`);
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
