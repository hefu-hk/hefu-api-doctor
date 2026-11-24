export type Protocol = "chat" | "responses" | "anthropic";
export type ConnectionKind = "hefu" | "custom";
export type Language = "en" | "zh-CN";

export interface ModelInfo {
  id: string;
  model_id?: string;
  display_name?: string;
  vendor?: string;
  model_category?: string;
  quality_score?: number;
  api_modes?: string[];
  features?: string[];
  tiers?: string[];
  currency?: string;
  standard_price_input?: number;
  standard_price_output?: number;
}

export interface OAuthSession {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope: string;
}

export interface DiagnosticInput {
  connection: ConnectionKind;
  protocol: Protocol;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  accessToken?: string;
  language?: Language;
}

export interface DiagnosticResult {
  schema_version: "1.0";
  tool: "hefu-api-doctor";
  tool_version: string;
  timestamp: string;
  connection: ConnectionKind;
  protocol: Protocol;
  model: string;
  status: "passed" | "failed";
  http_status: number | null;
  latency_ms: number;
  response_shape_valid: boolean;
  error_code?: string;
  message: string;
  recommendation: string;
}

export interface DoctorConfig {
  hefuBaseUrl: string;
  clientId: string;
  redirectUri: string;
  toolVersion: string;
}
