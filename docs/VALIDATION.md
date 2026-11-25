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
