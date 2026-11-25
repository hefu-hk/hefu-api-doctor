# HeFu API Doctor

[![CI](https://github.com/hefu-hk/hefu-api-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/hefu-hk/hefu-api-doctor/actions/workflows/ci.yml)

A local-first browser tool for AI API configuration, model discovery and controlled compatibility diagnostics.

- Live tool: https://hefu.hk/api-doctor/
- GitHub: https://github.com/hefu-hk/hefu-api-doctor
- Gitee mirror: https://gitee.com/hefu-oss/hefu-api-doctor
- 60-second mocked demo: [docs/demo.webm](docs/demo.webm)

## What it does

- Discovers public model IDs through HeFu OAuth or an explicit custom-endpoint `GET /models` request.
- Validates required fields and advertised model capabilities without sending a network or generation request.
- Runs one explicitly confirmed live request for OpenAI Chat Completions, OpenAI Responses or Anthropic Messages on HeFu.
- Supports Chat Completions and Responses checks for custom OpenAI-compatible endpoints, including keyless localhost servers such as Ollama.
- Limits HeFu protocol choices to the capabilities advertised by the authorized model metadata.
- Generates configuration for Codex CLI, Claude Code, Cline, cURL, Python and Node.js.
- Carries a verified model and protocol into the configuration generator without copying OAuth tokens or custom API keys.
- Exports a safe JSON report without credentials, endpoint URLs, prompts, model output or raw provider error messages.

The software is open source. Model API usage is not necessarily free: every live check requires explicit confirmation and may be billed by the selected provider. Model discovery and local setup validation do not send a generation request.

## Quick start

### Custom or local endpoint

1. Select **OpenAI-compatible** and enter the provider base URL, usually ending in `/v1`.
2. Enter an API key for a public provider. For a local Ollama server, use **Use local Ollama**; the key can remain empty.
3. Optionally select **Load model IDs**, or enter the exact model ID manually.
4. Select Chat Completions or Responses, then run **Validate setup — free**.
5. Review the provider's price, explicitly consent and run one live check.
6. Select **Generate client setup** after a successful check.

Custom endpoints must permit browser CORS. Public endpoints require HTTPS; HTTP is accepted only for literal loopback hosts.

### HeFu OAuth

1. Select **Connect with HeFu** and authorize only `ext_api` and `ext_models:read`.
2. Choose a model returned for the current user and application. Unsupported protocols are not offered for that model.
3. Run the free setup check, review the estimated list price and explicitly consent to one live request.
4. Generate a client configuration or open HeFu Console. OAuth tokens are never inserted into generated code.

## Why check the response contract?

HTTP 200 alone does not prove compatibility. API Doctor checks for a non-empty, protocol-appropriate response:

- Chat Completions: a choice containing a valid assistant message.
- Responses: a response object containing a message with an `output_text` part.
- Anthropic Messages: a message containing a valid text or tool-use content block.

A request can exhaust the fixed 32-token test budget before producing a visible message, especially with reasoning models. API Doctor reports this separately from an incompatible response and never sends an automatic follow-up request.

## Privacy and security

- No backend is required for the hosted static version.
- OAuth uses a public client and PKCE S256. Never configure a `client_secret` in this application.
- OAuth access and refresh tokens remain in page memory only. Leaving or reloading the page clears them.
- OAuth callback transactions expire after ten minutes; only that short-lived transaction uses `sessionStorage`.
- Custom API keys remain in React page memory and are not included in reports.
- Requests use `credentials: "omit"` and reject redirects.
- Reports use an explicit field allowlist and generated safe guidance rather than raw provider error text.
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
npm audit        # Dependency vulnerability review
```

Set `CHROMIUM_PATH` if Chromium is not at `/usr/local/bin/chromium`.

To record the 60-second demonstration with mocked external requests:

```bash
npm run demo:record
```

## Hosted configuration

Only public browser values are supported:

```dotenv
VITE_HEFU_BASE_URL=https://hefu.hk
VITE_OAUTH_CLIENT_ID=oc_your_public_client_id
VITE_OAUTH_REDIRECT_URI=https://hefu.hk/api-doctor/
```

The OAuth application must be a `public` client, allow `ext_api` and `ext_models:read`, and register the exact callback URL. Never place API keys or client secrets in Vite environment variables: all `VITE_*` values are public build output.

## Troubleshooting

- **401:** reconnect OAuth or replace the custom API key.
- **404:** check whether the base URL needs `/v1`, the protocol path and the exact model ID.
- **429:** inspect RPM, TPM, concurrency and daily limits separately.
- **CORS/network failure:** verify the URL, TLS, local server and browser CORS policy.
- **Output budget:** retest in your own integration with a larger output budget; the tool will not add another billable request automatically.

## Current scope

This release checks one protocol and one small non-streaming text request at a time. Custom endpoints support Chat Completions and Responses; Anthropic Messages is currently available through HeFu OAuth. The tool does not claim to prove multimodal support, tool calling, model quality, streaming behavior or production reliability. Multimodal suites, batch evaluation and team reports are future considerations, not current features.

## License

Apache-2.0. HeFu names and logos are not granted as general trademark rights by the code license.
