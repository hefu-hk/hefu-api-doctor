# Validation record

## 2026-11-24 initial release

- Unit tests: **24 passed** across PKCE, input validation, three protocol response contracts, error guidance, Chinese localization, configuration generation, model pricing estimate and safe report schema.
- TypeScript and Vite production build: passed. Initial JS approximately 254 KB raw / 81 KB gzip; CSS approximately 9 KB / 3 KB gzip.
- Chromium development-server E2E: **5 passed**.
- Chromium production-build preview E2E: **5 passed**.
- Browser coverage: anonymous configuration, Chinese UI, 375 px mobile overflow, custom endpoint success, one-request billing confirmation, report download, OAuth state validation, PKCE exchange without client secret, authorized model loading, OAuth success, rate-limit guidance and secret redaction.
- `npm audit` against the official npm registry: **0 vulnerabilities** at validation time.
- Main nginx integration: production Compose interpolation and `git diff --check` passed. Runtime validation is recorded in the workspace handover after deployment.

All automated external API calls were mocked. No automated test incurred model charges. Real production OAuth and minimal live API verification are separate deployment acceptance steps and must be recorded before handoff.
