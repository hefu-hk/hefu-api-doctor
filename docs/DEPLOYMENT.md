# Deployment

## Architecture

API Doctor is a standalone static SPA. Production is served at `https://hefu.hk/api-doctor/` through the existing main-site nginx origin. OAuth and ext calls remain same-origin and go directly to the main public API. There is no API Doctor backend, database or client secret.

The source repository is independent. Only `dist/` is deployed into a separate versioned directory in the frontend static volume. The main user, admin and tools portals are not copied or rebuilt.

## Build

```bash
npm ci
npm test
npm run test:e2e
VITE_HEFU_BASE_URL=https://hefu.hk \
VITE_OAUTH_CLIENT_ID=<public-client-id> \
VITE_OAUTH_REDIRECT_URI=https://hefu.hk/api-doctor/ \
npm run build
```

`VITE_OAUTH_CLIENT_ID` is public by design. Never put a client secret in any Vite variable.

## Publish

On the Docker host with the main frontend volume:

```bash
scripts/deploy_static.sh /absolute/path/to/dist "$(date -u +%Y%m%dT%H%M%S)"
```

The script copies a complete release into `.oss-releases/`, validates it and atomically replaces the `api-doctor` symlink. It keeps the current and previous API Doctor release and does not touch the main portal release directories.

The initial nginx route must point `/api-doctor/` to `/usr/share/nginx/api-doctor/`. Changing nginx requires the main project's normal review and force-recreate procedure. Subsequent API Doctor-only releases require neither backend restart nor nginx reload.

## OAuth public client

Register a public OAuth client in the main admin application manager with:

- Exact callback: `https://hefu.hk/api-doctor/`
- Client type: `public`
- Payer mode: `user`
- Scopes: `ext_api`, `ext_models:read`
- Platform visibility and approved status for the official hosted tool
- Only the intended public model pools

Do not record or distribute a client secret for this application. The generated model pool limits which models can be diagnosed.

## Rollback

List the symlink and releases in the static volume. Point `api-doctor` back to the previous `.oss-releases/api-doctor-*` directory with an atomic `mv -Tf` symlink replacement. Keep the previous release until the new version passes anonymous, OAuth and live diagnostic checks.

## Verification

- Anonymous page and assets return 200; unknown asset paths return a real error rather than HTML.
- Configuration generation works without login.
- OAuth callback includes PKCE and never a client secret.
- Model list is limited to the application pool.
- Each live click produces exactly one selected-protocol request.
- Exported JSON has no token, key, URL, prompt, response or supplier data.
- OAuth tokens never enter web storage; leaving or reloading clears them, and revocation in the main console blocks subsequent calls.
- Mobile and desktop have no horizontal overflow.
