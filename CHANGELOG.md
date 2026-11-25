# Changelog

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
