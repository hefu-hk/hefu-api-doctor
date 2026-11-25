import { doctorConfig } from "../config";
import type { OAuthSession } from "../types";
import { createPkcePair, randomToken } from "./pkce";

const LEGACY_SESSION_KEY = "hefu-api-doctor.oauth.session";
const TRANSACTION_KEY = "hefu-api-doctor.oauth.transaction";
const SCOPES = "ext_api ext_models:read";
let activeSession: OAuthSession | null = null;

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  detail?: unknown;
  error?: unknown;
}

function storage(): Storage {
  return window.sessionStorage;
}

export function loadOAuthSession(): OAuthSession | null {
  return activeSession;
}

function saveOAuthSession(session: OAuthSession): void {
  activeSession = session;
}

export function clearOAuthSession(): void {
  activeSession = null;
  storage().removeItem(LEGACY_SESSION_KEY);
  storage().removeItem(TRANSACTION_KEY);
}

function errorMessage(payload: TokenResponse, fallback: string): string {
  const detail = payload.detail || payload.error;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail) {
    return String((detail as { message: unknown }).message);
  }
  return fallback;
}

async function tokenRequest(body: Record<string, string>): Promise<OAuthSession> {
  const response = await fetch(`${doctorConfig.hefuBaseUrl}/api/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
  });
  const payload = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(errorMessage(payload, `Authorization failed (${response.status})`));
  }
  const session: OAuthSession = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: Date.now() + (payload.expires_in || 7200) * 1000,
    scope: payload.scope || SCOPES,
  };
  saveOAuthSession(session);
  return session;
}

export async function beginOAuth(): Promise<void> {
  const { verifier, challenge, method } = await createPkcePair();
  const state = randomToken(32);
  storage().setItem(TRANSACTION_KEY, JSON.stringify({ verifier, state, created_at: Date.now() }));
  const query = new URLSearchParams({
    client_id: doctorConfig.clientId,
    redirect_uri: doctorConfig.redirectUri,
    state,
    scope: SCOPES,
    utm_source: "api-doctor",
    utm_medium: "open-source",
    utm_campaign: "api-doctor-activation",
    code_challenge: challenge,
    code_challenge_method: method,
  });
  window.location.assign(`${doctorConfig.hefuBaseUrl}/oauth/authorize?${query}`);
}

export async function completeOAuth(search: string): Promise<OAuthSession | null> {
  const params = new URLSearchParams(search);
  const oauthError = params.get("error");
  if (oauthError) throw new Error(oauthError);
  const code = params.get("code");
  if (!code) return loadOAuthSession();
  const state = params.get("state") || "";
  const transaction = JSON.parse(storage().getItem(TRANSACTION_KEY) || "null") as {
    verifier?: string;
    state?: string;
    created_at?: number;
  } | null;
  if (!transaction?.verifier || !transaction.state || transaction.state !== state) {
    throw new Error("OAuth state validation failed. Start authorization again.");
  }
  if (!transaction.created_at || transaction.created_at > Date.now() || Date.now() - transaction.created_at > 10 * 60_000) {
    throw new Error("Authorization session expired. Start authorization again.");
  }
  storage().removeItem(TRANSACTION_KEY);
  const session = await tokenRequest({
    grant_type: "authorization_code",
    client_id: doctorConfig.clientId,
    code,
    redirect_uri: doctorConfig.redirectUri,
    code_verifier: transaction.verifier,
  });
  window.history.replaceState({}, document.title, new URL(doctorConfig.redirectUri).pathname);
  return session;
}

export async function validOAuthSession(): Promise<OAuthSession | null> {
  const session = loadOAuthSession();
  if (!session) return null;
  if (session.expires_at - Date.now() > 60_000) return session;
  if (!session.refresh_token) {
    clearOAuthSession();
    return null;
  }
  try {
    return await tokenRequest({
      grant_type: "refresh_token",
      client_id: doctorConfig.clientId,
      refresh_token: session.refresh_token,
    });
  } catch {
    clearOAuthSession();
    return null;
  }
}

export async function fetchAuthorized(path: string): Promise<Response> {
  const session = await validOAuthSession();
  if (!session) throw new Error("Authorization expired. Connect again.");
  return fetch(`${doctorConfig.hefuBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${session.access_token}`, Accept: "application/json" },
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
  });
}
