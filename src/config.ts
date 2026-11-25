import type { DoctorConfig } from "./types";

const trimSlash = (value: string) => value.replace(/\/+$/, "");
const configuredBase = (import.meta.env.VITE_HEFU_BASE_URL as string | undefined)?.trim();
const baseUrl = trimSlash(configuredBase || window.location.origin);
const redirectUri =
  (import.meta.env.VITE_OAUTH_REDIRECT_URI as string | undefined)?.trim() ||
  `${window.location.origin}${import.meta.env.BASE_URL}`;

export const doctorConfig: DoctorConfig = {
  hefuBaseUrl: baseUrl,
  clientId: (import.meta.env.VITE_OAUTH_CLIENT_ID as string | undefined)?.trim() || "",
  redirectUri,
  toolVersion: "0.2.0",
};

export const oauthConfigured = /^oc_[a-f0-9]{24}$/.test(doctorConfig.clientId);
