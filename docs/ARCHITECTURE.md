# Architecture and trust boundaries

## Components

- Standalone React + TypeScript static SPA, built by Vite at `/api-doctor/`.
- Main HeFu OAuth authorization server and public ext API, unchanged.
- Independent versioned static release directory in the existing frontend volume.
- No API Doctor server, database, analytics, service worker or persistent credential store.

## OAuth flow

1. The browser generates a random state and PKCE S256 verifier/challenge.
2. Only the transaction is stored in `sessionStorage` so it survives the authorization redirect.
3. The user authorizes `ext_api` and `ext_models:read` on the main site.
4. The callback validates state before exchanging the one-time code.
5. The token request contains the verifier and no client secret.
6. Access and refresh tokens remain in JavaScript page memory. Leaving or reloading requires authorization again.
7. The authorization code and transaction are removed from the URL and session storage.

## Live diagnostic flow

1. The user selects one model and protocol and confirms possible billing.
2. The app sends one non-streaming request with a fixed harmless prompt and a 32-token output cap.
3. The app records only HTTP status, elapsed time and whether the protocol-level response shape is valid.
4. Errors are reduced to safe guidance. URLs, credentials, IP addresses and supplier-specific sentences are removed.
5. Report export uses an explicit allowlist, not a blocklist.

The main platform may perform its documented routing and failover inside its own API. API Doctor itself never launches additional model requests or protocol batch runs.

## Trust boundaries

- The hosted API Doctor page has a restrictive self-only script CSP and no third-party analytics.
- OAuth pages on the main site are a separate trust boundary; only the PKCE transaction is shared through browser session storage.
- Custom endpoint requests originate in the user's browser. Public endpoints require HTTPS; HTTP is allowed only for loopback development.
- Custom endpoints must permit CORS. The app never routes custom keys through HeFu infrastructure.
- A model ID is public metadata. Prompt and response bodies are never added to application state or reports.

## Current limitations

- Text-only, one protocol per click.
- No quality score, streaming test, multimodal test or production SLA claim.
- Browser storage is not used for long-lived login convenience by design.
- A valid response shape does not prove that every model parameter or business workload is supported.
