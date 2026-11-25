# Changelog

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
