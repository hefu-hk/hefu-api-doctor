import { useEffect, useMemo, useRef, useState } from "react";
import { doctorConfig, oauthConfigured } from "./config";
import { generateClientConfig } from "./lib/configGenerator";
import type { ClientTarget } from "./lib/configGenerator";
import { runDiagnostic, sanitizeDiagnosticText } from "./lib/diagnostics";
import { initialLanguage, translate } from "./lib/i18n";
import type { TranslationKey } from "./lib/i18n";
import { chatModels, estimateTestCost, modelLabel } from "./lib/models";
import { beginOAuth, clearOAuthSession, completeOAuth, fetchAuthorized, validOAuthSession } from "./lib/oauth";
import { createSafeReport, reportFilename } from "./lib/report";
import type { ConnectionKind, DiagnosticResult, Language, ModelInfo, OAuthSession, Protocol } from "./types";

const clients: { id: ClientTarget; label: string }[] = [
  { id: "codex", label: "Codex CLI" },
  { id: "claude-code", label: "Claude Code" },
  { id: "cline", label: "Cline" },
  { id: "curl", label: "cURL" },
  { id: "python", label: "Python" },
  { id: "nodejs", label: "Node.js" },
];

export default function App() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const t = (key: TranslationKey) => translate(language, key);
  const [tab, setTab] = useState<"diagnose" | "configure">("diagnose");
  const [connection, setConnection] = useState<ConnectionKind>("hefu");
  const [session, setSession] = useState<OAuthSession | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [protocol, setProtocol] = useState<Protocol>("chat");
  const [consent, setConsent] = useState(false);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [configModel, setConfigModel] = useState("");
  const [configConnection, setConfigConnection] = useState<ConnectionKind>("hefu");
  const [configProtocol, setConfigProtocol] = useState<Protocol>("chat");
  const [configBaseUrl, setConfigBaseUrl] = useState("");
  const [client, setClient] = useState<ClientTarget>("codex");
  const oauthStarted = useRef(false);

  const availableModels = useMemo(() => chatModels(models), [models]);
  const activeModel = connection === "hefu" ? selectedModel : customModel;
  const selectedModelInfo = availableModels.find((item) => item.id === activeModel);
  const estimatedCost = estimateTestCost(selectedModelInfo);
  const generatedConfig = useMemo(
    () => generateClientConfig({ target: client, protocol: configProtocol, model: configModel, connection: configConnection, customBaseUrl: configBaseUrl }),
    [client, configProtocol, configModel, configConnection, configBaseUrl],
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === "zh-CN" ? "合富宝 API Doctor — AI API 兼容性诊断" : "HeFu API Doctor — Verify your AI API before your users do";
  }, [language]);

  useEffect(() => {
    if (oauthStarted.current) return;
    oauthStarted.current = true;
    completeOAuth(window.location.search)
      .then((value) => {
        setSession(value);
        if (window.location.search.includes("code=")) setNotice(t("connected"));
      })
      .catch((error: unknown) => {
        clearOAuthSession();
        setNotice(error instanceof Error ? sanitizeDiagnosticText(error.message) : t("authCallbackError"));
      });
  }, []);

  useEffect(() => {
    if (!session) {
      setModels([]);
      setSelectedModel("");
      return;
    }
    setModelsLoading(true);
    setNotice("");
    fetchAuthorized("/api/v1/ext/models")
      .then(async (response) => {
        if (!response.ok) throw new Error(`${t("modelLoadFailed")} HTTP ${response.status}`);
        const payload = (await response.json()) as { data?: ModelInfo[] };
        const items = Array.isArray(payload.data) ? payload.data : [];
        setModels(items);
        const first = chatModels(items)[0];
        if (first) {
          setSelectedModel(first.id);
          setConfigModel((current) => current || first.id);
        }
      })
      .catch((error: unknown) => setNotice(error instanceof Error ? sanitizeDiagnosticText(error.message) : t("modelLoadFailed")))
      .finally(() => setModelsLoading(false));
  }, [session]);

  const connect = async () => {
    setNotice(t("oauthPending"));
    try {
      await beginOAuth();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("authCallbackError"));
    }
  };

  const disconnect = () => {
    clearOAuthSession();
    setSession(null);
    setResult(null);
    setConsent(false);
    setNotice("");
  };

  const selectConnection = (value: ConnectionKind) => {
    setConnection(value);
    setProtocol("chat");
    setResult(null);
    setConsent(false);
    setNotice("");
  };

  const runCheck = async () => {
    setRunning(true);
    setResult(null);
    setNotice("");
    try {
      let accessToken: string | undefined;
      if (connection === "hefu") {
        const valid = await validOAuthSession();
        if (!valid) {
          setSession(null);
          throw new Error("Authorization expired. Connect again.");
        }
        accessToken = valid.access_token;
      }
      setResult(await runDiagnostic({
        connection,
        protocol,
        model: activeModel,
        baseUrl: customBaseUrl,
        apiKey: customApiKey,
        accessToken,
        language,
      }));
      setConsent(false);
    } catch (error) {
      setNotice(error instanceof Error ? sanitizeDiagnosticText(error.message) : t("unexpectedError"));
    } finally {
      setRunning(false);
    }
  };

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const downloadReport = () => {
    if (!result) return;
    const blob = new Blob([createSafeReport(result)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = reportFilename(result);
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label={t("brand")}>
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="34" height="34" />
          <span>{t("brand")}</span>
          <span className="source-badge">{t("openSource")}</span>
        </a>
        <nav className="header-nav" aria-label="Primary">
          <a href="/docs">{t("docs")}</a>
          <a href="/">{t("mainSite")}</a>
          <button className="language-button" onClick={() => setLanguage(language === "en" ? "zh-CN" : "en")}>{t("language")}</button>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">{t("heroEyebrow")}</span>
            <h1>{t("heroTitle")}</h1>
            <p>{t("heroDescription")}</p>
          </div>
          <div className="trust-row" aria-label="Product principles">
            <span>{t("noBatch")}</span><span>{t("noStorage")}</span><span>{t("pkce")}</span>
          </div>
        </section>

        <div className="workspace-tabs" role="tablist" aria-label="Tools">
          <button role="tab" aria-selected={tab === "diagnose"} className={tab === "diagnose" ? "active" : ""} onClick={() => setTab("diagnose")}>{t("diagnoseTab")}</button>
          <button role="tab" aria-selected={tab === "configure"} className={tab === "configure" ? "active" : ""} onClick={() => setTab("configure")}>{t("configureTab")}</button>
        </div>

        {tab === "diagnose" ? (
          <div className="diagnostic-layout">
            <div className="control-stack">
              <section className="panel">
                <h2>{t("connectionTitle")}</h2>
                <div className="segmented">
                  <button className={connection === "hefu" ? "active" : ""} onClick={() => selectConnection("hefu")}>{t("hefuConnection")}</button>
                  <button className={connection === "custom" ? "active" : ""} onClick={() => selectConnection("custom")}>{t("customConnection")}</button>
                </div>
                <p className="muted">{connection === "hefu" ? t("hefuConnectionDescription") : t("customConnectionDescription")}</p>
                {connection === "hefu" ? (
                  <div className="oauth-box">
                    {session ? (
                      <>
                        <div className="connected-line"><span className="status-dot" />{t("connected")}</div>
                        <div className="button-row">
                          <button className="button secondary" onClick={disconnect}>{t("disconnect")}</button>
                          <a className="text-link" href="/dashboard/oauth" target="_blank" rel="noreferrer">{t("revokeHint")}</a>
                        </div>
                        {modelsLoading && <p className="muted">{t("loadingModels")}</p>}
                        {!modelsLoading && models.length > 0 && <p className="success-text">{models.length} {t("modelsLoaded")}</p>}
                      </>
                    ) : (
                      <button className="button primary" onClick={connect} disabled={!oauthConfigured}>{t("connect")}</button>
                    )}
                    {!oauthConfigured && <p className="notice">{t("oauthNotConfigured")}</p>}
                  </div>
                ) : (
                  <div className="form-grid">
                    <label>{t("baseUrl")}<input value={customBaseUrl} onChange={(event) => setCustomBaseUrl(event.target.value)} placeholder="https://provider.example/v1" autoComplete="url" /></label>
                    <label>{t("apiKey")}<input type="password" value={customApiKey} onChange={(event) => setCustomApiKey(event.target.value)} placeholder={t("apiKeyPlaceholder")} autoComplete="off" /></label>
                    <p className="muted small">{t("corsHint")}</p>
                  </div>
                )}
              </section>

              <section className="panel">
                <h2>{t("protocolTitle")}</h2>
                <div className="form-grid">
                  {connection === "hefu" ? (
                    <label>{t("model")}
                      <select value={selectedModel} onChange={(event) => { setSelectedModel(event.target.value); setConfigModel(event.target.value); }} disabled={!session || modelsLoading}>
                        <option value="">{t("selectModel")}</option>
                        {availableModels.map((model) => <option key={model.id} value={model.id}>{modelLabel(model)}</option>)}
                      </select>
                    </label>
                  ) : (
                    <label>{t("model")}<input value={customModel} onChange={(event) => setCustomModel(event.target.value)} placeholder={t("modelPlaceholder")} /></label>
                  )}
                  <label>{t("protocol")}
                    <select value={protocol} onChange={(event) => setProtocol(event.target.value as Protocol)}>
                      <option value="chat">{t("chatProtocol")}</option>
                      {connection === "hefu" && <option value="responses">{t("responsesProtocol")}</option>}
                      {connection === "hefu" && <option value="anthropic">{t("anthropicProtocol")}</option>}
                    </select>
                  </label>
                </div>
              </section>

              <section className="panel live-panel">
                <h2>{t("testTitle")}</h2>
                <p className="muted">{t("freeCheck")}</p>
                <div className="cost-note">
                  {connection === "custom" ? t("customPriceUnknown") : estimatedCost ? <><strong>{t("estimatedCost")}: ≈ {estimatedCost.amount.toFixed(6)} {estimatedCost.currency}</strong><span>{t("priceUnknown")}</span></> : t("priceUnknown")}
                </div>
                <label className="consent-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>{t("consent")}</span></label>
                <button className="button primary full" disabled={!consent || running || !activeModel || (connection === "hefu" && !session)} onClick={runCheck}>{running ? t("runningCheck") : t("runCheck")}</button>
                <p className="muted small centered">{t("noAutoRun")}</p>
              </section>
              {notice && <div className="notice" role="alert">{notice}</div>}
            </div>

            <section className={`panel result-panel ${result?.status || "empty"}`} aria-live="polite">
              <div className="result-heading"><h2>{t("resultTitle")}</h2>{result && <span className={`result-status ${result.status}`}>{t(result.status === "passed" ? "passed" : "failed")}</span>}</div>
              {!result ? <div className="empty-state"><div className="pulse-ring" /><p>{t("emptyResult")}</p></div> : (
                <>
                  <div className="metric-grid">
                    <div><span>{t("httpStatus")}</span><strong>{result.http_status ?? "—"}</strong></div>
                    <div><span>{t("latency")}</span><strong>{result.latency_ms} ms</strong></div>
                    <div><span>{t("responseShape")}</span><strong>{t(result.response_shape_valid ? "validShape" : "invalidShape")}</strong></div>
                  </div>
                  <div className="result-detail"><span className="label">{result.protocol} · {result.model}</span><h3>{result.message}</h3><p><strong>{t("recommendation")}: </strong>{result.recommendation}</p></div>
                  <div className="button-row result-actions">
                    <button className="button primary" onClick={downloadReport}>{t("downloadReport")}</button>
                    <button className="button secondary" onClick={() => copyText(createSafeReport(result))}>{copied ? t("copied") : t("copyResult")}</button>
                  </div>
                  <p className="muted small">{t("safeReportHint")}</p>
                </>
              )}
            </section>
          </div>
        ) : (
          <section className="panel config-panel">
            <div className="config-intro"><h2>{t("configTitle")}</h2><p className="muted">{t("configDescription")}</p></div>
            <div className="config-layout">
              <div className="form-grid config-controls">
                <label>{t("client")}<select value={client} onChange={(event) => setClient(event.target.value as ClientTarget)}>{clients.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
                <label>{t("configModel")}<input value={configModel} onChange={(event) => setConfigModel(event.target.value)} placeholder="your-model-id" /></label>
                <label>{t("configConnection")}<select value={configConnection} onChange={(event) => setConfigConnection(event.target.value as ConnectionKind)}><option value="hefu">{t("useHefu")}</option><option value="custom">{t("useCustom")}</option></select></label>
                {configConnection === "custom" && <label>{t("configCustomBase")}<input value={configBaseUrl} onChange={(event) => setConfigBaseUrl(event.target.value)} placeholder="https://provider.example/v1" /></label>}
                {client !== "codex" && client !== "claude-code" && client !== "cline" && <label>{t("protocol")}<select value={configProtocol} onChange={(event) => setConfigProtocol(event.target.value as Protocol)}><option value="chat">{t("chatProtocol")}</option><option value="responses">{t("responsesProtocol")}</option><option value="anthropic">{t("anthropicProtocol")}</option></select></label>}
              </div>
              <div className="code-panel">
                <div className="code-heading"><span>{t("generatedCode")}</span><button className="button secondary small-button" onClick={() => copyText(generatedConfig)}>{copied ? t("copied") : t("copyConfig")}</button></div>
                <pre tabIndex={0}><code>{generatedConfig}</code></pre>
              </div>
            </div>
            <p className="notice">{t("configNote")}</p>
          </section>
        )}

        <section className="privacy-section">
          <h2>{t("privacyTitle")}</h2>
          <div className="privacy-grid"><p>{t("privacyOne")}</p><p>{t("privacyTwo")}</p><p>{t("privacyThree")}</p></div>
        </section>
      </main>

      <footer><span>© {new Date().getFullYear()} {t("brand")}. {t("footer")}</span><span>{doctorConfig.toolVersion}</span></footer>
    </div>
  );
}
