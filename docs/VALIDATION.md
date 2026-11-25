# Validation record

## 2026-11-24 initial release

- Unit tests: **24 passed** across PKCE, input validation, three protocol response contracts, error guidance, Chinese localization, configuration generation, model pricing estimate and safe report schema.
- TypeScript and Vite production build: passed. Initial JS approximately 254 KB raw / 81 KB gzip; CSS approximately 9 KB / 3 KB gzip.
- Chromium development-server E2E: **5 passed**.
- Chromium production-build preview E2E: **5 passed**.
- Browser coverage: anonymous configuration, Chinese UI, 375 px mobile overflow, custom endpoint success, one-request billing confirmation, report download, OAuth state validation, PKCE exchange without client secret, authorized model loading, OAuth success, rate-limit guidance and secret redaction.
- `npm audit` against the official npm registry: **0 vulnerabilities** at validation time.
- Main nginx integration: production Compose interpolation and `git diff --check` passed. Runtime validation is recorded in the workspace handover after deployment.

All automated external API calls were mocked. No automated test incurred model charges.

## 2026-11-25 version 0.1.1 growth audit

- Added canonical/Open Graph metadata, crawler-readable fallback body and `/api-doctor/sitemap.xml`.
- OAuth authorization URLs now carry `utm_source=api-doctor`, `utm_medium=open-source` and `utm_campaign=api-doctor-activation` while preserving PKCE and minimal scopes.
- Unit tests: **24 passed**. Development and production-preview Chromium suites: **6 passed each**, including the new attribution assertion.
- Main sitemap includes the tool only for HK hosts; CN is unchanged.

## 2026-11-24 HK production acceptance

- Production URL: `https://hefu.hk/api-doctor/`; homepage, models, health and static assets return 200, missing assets return 404, and the bare path redirects to the trailing-slash URL.
- The independent CSP contains no analytics or advertising script source. OAuth and ext API calls are same-origin.
- Real Chromium authorization completed with the official public client and PKCE. Model: `deepseek-v4-flash`.
- Chat Completions, Responses and Anthropic Messages each passed one real minimal request. All three returned valid protocol response shapes.
- Production accounting recorded exactly three model calls, all successful, with approximately **0.000102 USD** user cost.
- The test grant was revoked successfully; the former ext token then received 401 from `ext/models`.
- No OAuth token was found in localStorage or sessionStorage. The 375 px production viewport had no horizontal overflow.
- Main backend stayed healthy and was not restarted. Nginx was recreated alone with `--no-deps` after confirming zero in-flight model requests.

## 2026-11-25 version 0.2.0 release candidate

- Product and release audit completed with external research into API integration failures, local OpenAI-compatible servers, current Codex protocol requirements and competing compatibility checkers.
- Added custom model discovery, custom Responses checks, keyless loopback support, free setup validation, capability-constrained protocol selection and verified-result configuration handoff.
- Strengthened response contracts, raw-error privacy, output-budget guidance, timeout classification and OAuth transaction expiry.
- Clean dependency installation: **88 packages added** from the lockfile.
- Unit tests: **39 passed** across six test files. TypeScript and Vite production build: passed.
- Development-server Chromium E2E: **9 passed**. Production-build preview Chromium E2E: **9 passed**.
- Browser coverage includes configuration generation, English and Chinese UI, custom model discovery, keyless local Responses checks, no-generation preflight, one-request billing confirmation, safe reports, OAuth state and transaction expiry, PKCE, model capability restrictions, success handoff and actionable failures.
- Visual production-build checks at **320, 375, 768, 1024 and 1440 px** found no horizontal overflow. Mobile results scroll into view and no browser page errors were observed.
- Mocked demo: **60.8 seconds**, 960×540, approximately **4.1 MB**, with an explicit no-billable-request badge.
- `npm audit` against the official npm registry: **0 vulnerabilities** at validation time.
- All external requests in automated tests and the demo were mocked. **No real model request was made and no model cost was incurred** for this release-candidate audit. Real OAuth and three-protocol production acceptance remains a separate release gate.

## 2026-11-25 version 0.2.0 production acceptance

- HK static release `20261125T052803` passed anonymous production checks, including English and Chinese UI, configuration generation, responsive layouts, static assets and error routes.
- Real OAuth/PKCE and authorized model discovery passed. Chat Completions, Responses and Anthropic Messages each ran exactly once against `deepseek-v4-flash` with a 32-token output cap; all three passed without retries.
- Production billing recorded exactly **3 requests and 102 tokens**, with a user cost of **0.000113 USD**.

## 2026-11-25 version 0.2.1 compact workspace

- Reduced desktop display typography from at most 62 px to 44 px and mobile display typography from 37 px to 30 px; tightened header, panel, form and result spacing.
- Combined connection and protocol setup into one workspace, reduced the empty-result footprint and kept connection choices side by side on mobile.
- Unit tests: **39 passed**. Development-server Chromium E2E: **10 passed**. Production-build preview Chromium E2E: **10 passed**, including new desktop/mobile information-density checks.
- English and Chinese visual checks at **320, 375, 768, 1024 and 1440 px** found no horizontal overflow or browser page errors. Custom-endpoint results and configuration generation were also visually reviewed.
- At 1440×1000 and 375×812, the Chinese page height decreased from approximately **1781 to 1256 px** and **2395 to 1716 px**, respectively, in the final production-build visual matrix.
- Refreshed mocked demo: **60.68 seconds**, 960×540, approximately **4.52 MB**, with an explicit no-billable-request badge.
- `npm audit` against the official npm registry: **0 vulnerabilities** at validation time.
- This release changes presentation and layout tests only. Automated checks and the refreshed demo used mocks; **no additional real model request or cost was incurred**.

## 2026-11-25 version 0.2.2 content and discovery refinement

- Refocused the hero on the direct user outcome: “Verify your AI API before you run into issues.” / “在你遇到问题前，先验证 AI API。” Reduced display typography to **36 px desktop / 26 px mobile** and balanced mobile wrapping.
- Refined bilingual interface copy and added four compact, answer-ready FAQs covering verification scope, privacy, billing and supported protocols/clients.
- Added bilingual dynamic metadata, SoftwareApplication and FAQ structured data, complete Open Graph/Twitter fields and a reviewed **1200×630** social image.
- Added `/api-doctor/llms.txt` and `/api-doctor/index.md` using the current llms.txt proposal’s `describedby` and Markdown alternate links. Content states capabilities and limitations without unsupported ranking or quality claims.
- Unit tests: **39 passed**. Development-server Chromium E2E: **11 passed**. Production-build preview Chromium E2E: **11 passed**, including structured-data/visible-content consistency, bilingual metadata and static discovery resources.
- English and Chinese visual checks at **320, 375, 768, 1024 and 1440 px** found no horizontal overflow or browser page errors. FAQ expansion was exercised.
- Refreshed mocked demo: **60.68 seconds**, 960×540, approximately **4.31 MB**. `npm audit` against the official npm registry: **0 vulnerabilities**.
- Automated checks and the demo used mocks. **No real model request or model cost was incurred** for this release.
