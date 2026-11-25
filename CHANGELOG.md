# Changelog

## 0.2.2 — 2026-11-25

- Refocus the hero and bilingual interface copy on direct user outcomes, with a smaller 36/26 px display hierarchy.
- Add concise product FAQs, bilingual dynamic metadata and clearer capability, billing and privacy explanations.
- Add SoftwareApplication and FAQ structured data, a 1200×630 social sharing image and richer Open Graph/Twitter metadata.
- Add an `llms.txt` index and a Markdown product overview for answer engines and coding agents.
- Add browser checks for discovery metadata, structured-data/content consistency and bilingual summaries.

## 0.2.1 — 2026-11-25

- Refine the visual hierarchy with smaller display and interface typography, tighter spacing and quieter surfaces.
- Combine connection and protocol setup into one compact workspace and reduce the empty-result footprint.
- Keep connection choices side by side on mobile while preserving touch-sized controls and overflow-free layouts.
- Add browser regression checks for desktop and mobile information density.

## 0.2.0 — 2026-11-25

- Add custom-endpoint model discovery, Responses checks and keyless loopback support with an Ollama preset.
- Add free local setup validation and protocol choices constrained by authorized model capabilities.
- Carry verified model and protocol settings directly into compatible client configuration.
- Validate non-empty protocol response structures and distinguish Responses output-budget exhaustion from incompatibility.
- Exclude raw provider error text from results and reports; add a specific 60-second timeout result.
- Add ten-minute OAuth callback expiry, model reload and empty states, mobile result scrolling and safer copy fallback.
- Add attributed HeFu links, public source links and a mocked release demonstration.

## 0.1.1 — 2026-11-25

- Add canonical and Open Graph metadata, crawler-readable fallback content and a standalone sitemap.
- Add `api-doctor` UTM attribution to OAuth registration and activation paths.
- Clear OAuth callback parameters on the current origin for compatible self-hosted deployments.

## 0.1.0 — 2026-11-24

Initial validation release:

- HeFu OAuth authorization code flow with PKCE S256 and minimal scopes.
- Authorized model catalog and bounded Chat Completions, Responses and Anthropic Messages diagnostics.
- Basic custom OpenAI-compatible Chat Completions diagnostics.
- Codex CLI, Claude Code, Cline, cURL, Python and Node.js configuration generator.
- Explicit per-request billing confirmation and list-price estimate where available.
- Sanitized JSON report with an allowlisted schema.
- English and Simplified Chinese responsive interface.
- Unit and local Chromium browser tests with all external calls mocked.
