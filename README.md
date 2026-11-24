# HeFu API Doctor

A local-first browser tool for AI API configuration and controlled compatibility diagnostics.

- Live tool: https://hefu.hk/api-doctor/
- Repository: https://github.com/hefu-hk/hefu-api-doctor

## What it does

- Generates configuration for Codex CLI, Claude Code, Cline, cURL, Python and Node.js.
- Connects to HeFu AI with OAuth authorization code flow and PKCE S256.
- Reads only the models available to the current user and application.
- Runs one explicitly confirmed live request for OpenAI Chat Completions, OpenAI Responses or Anthropic Messages.
- Supports basic Chat Completions checks for custom OpenAI-compatible endpoints.
- Exports a safe JSON report without credentials, endpoint URLs, prompts or model output.

The software is open source. Model API usage is not necessarily free: every live check requires explicit confirmation and may be billed by the selected provider.

## Privacy and security

- No backend is required for the hosted static version.
- OAuth uses a public client and PKCE. Never configure a `client_secret` in this application.
- OAuth access and refresh tokens remain in page memory only. Leaving or reloading the page clears them.
- Only the short-lived PKCE transaction uses `sessionStorage`; it is removed after the callback.
- Custom API keys remain in React page memory and are not included in reports.
- Requests use `credentials: "omit"` and reject redirects.
- Reports use an explicit field allowlist.
- There are no analytics scripts, hidden batch runs or automatic model retries.

Leaving or reloading the page clears session credentials. Disconnecting clears the current page's OAuth data. Revoking the application's access entirely is done in HeFu Console → Authorized apps.

## Development

Requirements: Node.js 22 or later.

```bash
npm ci
cp .env.example .env.local
# Set the public OAuth client ID and exact callback for your deployment.
npm run dev
```

The Vite base path is `/api-doctor/`. The default hosted callback is derived from the current origin and base path. For an external self-hosted deployment, the API provider must permit browser CORS; do not weaken a provider's global CORS policy just for this tool.

```bash
npm test          # Unit tests, mocked network only
npm run build     # TypeScript and production build
npm run test:e2e # Local Chromium, all external requests mocked
```

Set `CHROMIUM_PATH` if Chromium is not at `/usr/local/bin/chromium`.

## Hosted configuration

Only public browser values are supported:

```dotenv
VITE_HEFU_BASE_URL=https://hefu.hk
VITE_OAUTH_CLIENT_ID=oc_your_public_client_id
VITE_OAUTH_REDIRECT_URI=https://hefu.hk/api-doctor/
```

The OAuth application must be a `public` client, allow `ext_api` and `ext_models:read`, and register the exact callback URL. Never place API keys or client secrets in Vite environment variables: all `VITE_*` values are public build output.

## Current scope

This initial release checks one protocol and one small text request at a time. It does not claim to prove multimodal support, model quality, streaming behavior or production reliability. Multimodal contract suites, batch evaluation and team reports are future considerations, not current features.

## License

Apache-2.0. HeFu names and logos are not granted as general trademark rights by the code license.
