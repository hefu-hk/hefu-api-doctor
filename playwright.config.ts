import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const localChromium = "/usr/local/bin/chromium";
const executablePath = process.env.CHROMIUM_PATH || (existsSync(localChromium) ? localChromium : undefined);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173/api-doctor/",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath,
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: process.env.E2E_WEB_COMMAND || "npm run dev -- --port 4173",
    url: "http://127.0.0.1:4173/api-doctor/",
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_OAUTH_CLIENT_ID: "oc_000000000000000000000000",
    },
  },
});
