import { useEffect, useMemo, useRef, useState } from "react";
import { doctorConfig, oauthConfigured } from "./config";
import { effectiveClientProtocol, generateClientConfig } from "./lib/configGenerator";
import type { ClientTarget } from "./lib/configGenerator";
import { fetchCustomModelIds } from "./lib/customModels";
import { isLoopbackBaseUrl, runDiagnostic, sanitizeDiagnosticText, validateDiagnosticInput } from "./lib/diagnostics";
import { initialLanguage, translate } from "./lib/i18n";
import type { TranslationKey } from "./lib/i18n";
import { hefuLink, sourceLinks } from "./lib/links";
import { diagnosticModels, estimateTestCost, modelLabel, modelProtocols, supportsProtocol } from "./lib/models";
import { beginOAuth, clearOAuthSession, completeOAuth, fetchAuthorized, validOAuthSession } from "./lib/oauth";
import { createSafeReport, reportFilename } from "./lib/report";
import type { ConnectionKind, DiagnosticInput, DiagnosticResult, Language, ModelInfo, OAuthSession, Protocol } from "./types";

const clients: { id: ClientTarget; label: string }[] = [
  { id: "codex", label: "Codex CLI" },
  { id: "claude-code", label: "Claude Code" },
  { id: "cline", label: "Cline" },
  { id: "curl", label: "cURL" },
  { id: "python", label: "Python" },
  { id: "nodejs", label: "Node.js" },
];

type NoticeTone = "info" | "success" | "error";
type CopyTarget = "config" | "report" | null;

export default function App() {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const t = (key: TranslationKey) => translate(language, key);
  const [tab, setTab] = useState<"diagnose" | "configure">("diagnose");
  const [connection, setConnection] = useState<ConnectionKind>("hefu");
  const [session, setSession] = useState<OAuthSession | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsRevision, setModelsRevision] = useState(0);
  const [selectedModel, setSelectedModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [customModelIds, setCustomModelIds] = useState<string[]>([]);
  const [customModelsLoading, setCustomModelsLoading] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [protocol, setProtocol] = useState<Protocol>("chat");
  const [consent, setConsent] = useState(false);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("info");
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [copied, setCopied] = useState<CopyTarget>(null);
  const [configModel, setConfigModel] = useState("");
  const [configConnection, setConfigConnection] = useState<ConnectionKind>("hefu");
  const [configProtocol, setConfigProtocol] = useState<Protocol>("chat");
  const [configBaseUrl, setConfigBaseUrl] = useState("");
  const [client, setClient] = useState<ClientTarget>("codex");
  const oauthStarted = useRef(false);
  const resultRef = useRef<HTMLElement>(null);

  const availableModels = useMemo(() => diagnosticModels(models), [models]);
  const activeModel = connection === "hefu" ? selectedModel : customModel;
  const selectedModelInfo = availableModels.find((item) => item.id === activeModel);
  const estimatedCost = estimateTestCost(selectedModelInfo);
  const allowedProtocols = useMemo<Protocol[]>(() => {
    if (connection === "custom") return ["chat", "responses"];
    if (selectedModelInfo) return modelProtocols(selectedModelInfo);
    return ["chat", "responses", "anthropic"];
  }, [connection, selectedModelInfo]);
  const protocolAdvertised = connection === "custom" || !selectedModelInfo || supportsProtocol(selectedModelInfo, protocol);
  const effectiveConfigProtocol = effectiveClientProtocol(client, configProtocol);
  const configModelInfo = configConnection === "hefu" ? availableModels.find((item) => item.id === configModel) : undefined;
  const configCompatible = !configModelInfo || supportsProtocol(configModelInfo, effectiveConfigProtocol);
  const generatedConfig = useMemo(
    () => generateClientConfig({ target: client, protocol: effectiveConfigProtocol, model: configModel, connection: configConnection, customBaseUrl: configBaseUrl }),
    [client, effectiveConfigProtocol, configModel, configConnection, configBaseUrl],
  );

  const protocolText = (value: Protocol) => t(value === "chat" ? "chatProtocol" : value === "responses" ? "responsesProtocol" : "anthropicProtocol");

  const invalidateCheck = () => {
    setResult(null);
    setConsent(false);
    setNotice("");
    setNoticeTone("info");
  };

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
        if (window.location.search.includes("code=")) {
          setNotice(t("connected"));
          setNoticeTone("success");
        }
      })
      .catch((error: unknown) => {
        clearOAuthSession();
        setNotice(error instanceof Error ? sanitizeDiagnosticText(error.message) : t("authCallbackError"));
        setNoticeTone("error");
      });
  }, []);

  useEffect(() => {
    if (!session) {
      setModels([]);
      setSelectedModel("");
      setModelsLoading(false);
      return;
    }
    let active = true;
    setModelsLoading(true);
    setNotice("");
    fetchAuthorized("/api/v1/ext/models")
      .then(async (response) => {
        if (!response.ok) throw new Error(`${t("modelLoadFailed")} HTTP ${response.status}`);
        const payload = (await response.json()) as { data?: ModelInfo[] };
        return Array.isArray(payload.data) ? payload.data : [];
      })
      .then((items) => {
        if (!active) return;
        setModels(items);
        const first = diagnosticModels(items)[0];
        if (first) {
          setSelectedModel(first.id);
          setConfigModel((current) => current || first.id);
        } else {
          setSelectedModel("");
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setNotice(error instanceof Error ? sanitizeDiagnosticText(error.message) : t("modelLoadFailed"));
        setNoticeTone("error");
      })
      .finally(() => {
        if (active) setModelsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session, modelsRevision]);

  useEffect(() => {
    if (allowedProtocols.length > 0 && !allowedProtocols.includes(protocol)) {
      setProtocol(allowedProtocols[0]);
      setResult(null);
      setConsent(false);
      setNotice("");
    }
  }, [allowedProtocols, protocol]);

  useEffect(() => {
    if (!result || window.innerWidth > 900) return;
    const frame = window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      resultRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [result]);

  const connect = async () => {
    setNotice(t("oauthPending"));
    setNoticeTone("info");
    try {
      await beginOAuth();
    } catch (error) {
      setNotice(error instanceof Error ? sanitizeDiagnosticText(error.message) : t("authCallbackError"));
      setNoticeTone("error");
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
    invalidateCheck();
  };

  const currentInput = (accessToken = session?.access_token): DiagnosticInput => ({
    connection,
    protocol,
    model: activeModel,
    baseUrl: customBaseUrl,
    apiKey: customApiKey,
    accessToken,
    language,
  });

  const setupError = (accessToken?: string) => {
    const validation = validateDiagnosticInput(currentInput(accessToken));
    if (validation) return validation;
    return protocolAdvertised ? null : t("protocolUnsupported");
  };

  const runPreflight = () => {
    const error = setupError();
    setNotice(error || t("preflightPassed"));
    setNoticeTone(error ? "error" : "success");
  };

  const loadCustomModels = async () => {
    setCustomModelsLoading(true);
    setNotice("");
    invalidateCheck();
    try {
      const ids = await fetchCustomModelIds(customBaseUrl, customApiKey);
      setCustomModelIds(ids);
      if (ids.length > 0) {
        setCustomModel((current) => current || ids[0]);
        setNotice(`${ids.length} ${t("customModelsLoaded")}`);
        setNoticeTone("success");
      } else {
        setNotice(t("customModelsEmpty"));
        setNoticeTone("info");
      }
    } catch (error) {
      const detail = error instanceof Error ? sanitizeDiagnosticText(error.message) : "";
      setNotice(`${t("customModelsFailed")}${detail ? ` ${detail}` : ""}`);
      setNoticeTone("error");
    } finally {
      setCustomModelsLoading(false);
    }
  };

  const useOllama = () => {
    setCustomBaseUrl("http://localhost:11434/v1");
    setCustomApiKey("");
    setCustomModel("");
    setCustomModelIds([]);
    setProtocol("chat");
    invalidateCheck();
  };

  const runCheck = async () => {
    const initialError = setupError();
    if (initialError) {
      setNotice(initialError);
      setNoticeTone("error");
      return;
    }
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
      setResult(await runDiagnostic(currentInput(accessToken)));
      setConsent(false);
    } catch (error) {
      setNotice(error instanceof Error ? sanitizeDiagnosticText(error.message) : t("unexpectedError"));
      setNoticeTone("error");
    } finally {
      setRunning(false);
    }
  };

  const copyText = async (value: string, target: Exclude<CopyTarget, null>) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand("copy");
        textarea.remove();
        if (!success) throw new Error("copy failed");
      }
      setCopied(target);
      setNotice("");
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setNotice(t("copyFailed"));
      setNoticeTone("error");
    }
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

  const configureFromResult = () => {
    if (!result) return;
    setConfigModel(result.model);
    setConfigConnection(result.connection);
    setConfigProtocol(result.protocol);
    setConfigBaseUrl(result.connection === "custom" ? customBaseUrl : "");
    setClient(result.protocol === "responses" ? "codex" : result.protocol === "anthropic" ? "claude-code" : "curl");
    setNotice("");
    setTab("configure");
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
          <a href={hefuLink("/docs")}>{t("docs")}</a>
          <a href={hefuLink("/")}>{t("mainSite")}</a>
          <a href={sourceLinks.github} target="_blank" rel="noreferrer">{t("sourceCode")}</a>
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
          <button id="diagnose-tab" role="tab" aria-selected={tab === "diagnose"} aria-controls="diagnose-panel" className={tab === "diagnose" ? "active" : ""} onClick={() => { setTab("diagnose"); setNotice(""); }}>{t("diagnoseTab")}</button>
          <button id="configure-tab" role="tab" aria-selected={tab === "configure"} aria-controls="configure-panel" className={tab === "configure" ? "active" : ""} onClick={() => { setTab("configure"); setNotice(""); }}>{t("configureTab")}</button>
        </div>

        {tab === "diagnose" ? (
          <div className="diagnostic-layout" id="diagnose-panel" role="tabpanel" aria-labelledby="diagnose-tab">
            <div className="control-stack">
              <section className="panel setup-panel">
                <div className="setup-section">
                  <h2>{t("connectionTitle")}</h2>
                  <div className="segmented">
                    <button aria-pressed={connection === "hefu"} className={connection === "hefu" ? "active" : ""} onClick={() => selectConnection("hefu")}>{t("hefuConnection")}</button>
                    <button aria-pressed={connection === "custom"} className={connection === "custom" ? "active" : ""} onClick={() => selectConnection("custom")}>{t("customConnection")}</button>
                  </div>
                  <p className="muted">{connection === "hefu" ? t("hefuConnectionDescription") : t("customConnectionDescription")}</p>
                  {connection === "hefu" ? (
                    <div className="oauth-box">
                      {session ? (
                        <>
                          <div className="connected-line"><span className="status-dot" />{t("connected")}</div>
                          <div className="button-row">
                            <button className="button secondary" onClick={disconnect}>{t("disconnect")}</button>
                            <button className="button secondary" onClick={() => setModelsRevision((value) => value + 1)} disabled={modelsLoading}>{t("reloadModels")}</button>
                            <a className="text-link" href={hefuLink("/dashboard/oauth")} target="_blank" rel="noreferrer">{t("revokeHint")}</a>
                          </div>
                          {modelsLoading && <p className="muted">{t("loadingModels")}</p>}
                          {!modelsLoading && availableModels.length > 0 && <p className="success-text">{availableModels.length} {t("modelsLoaded")}</p>}
                          {!modelsLoading && availableModels.length === 0 && <p className="notice">{t("noCompatibleModels")}</p>}
                        </>
                      ) : (
                        <button className="button primary" onClick={connect} disabled={!oauthConfigured}>{t("connect")}</button>
                      )}
                      {!session && !oauthConfigured && <p className="notice">{t("oauthNotConfigured")}</p>}
                    </div>
                  ) : (
                    <div className="form-grid">
                      <label>{t("baseUrl")}<input value={customBaseUrl} onChange={(event) => { setCustomBaseUrl(event.target.value); setCustomModelIds([]); invalidateCheck(); }} placeholder="https://provider.example/v1" autoComplete="url" /></label>
                      <label>{isLoopbackBaseUrl(customBaseUrl) ? t("apiKeyOptional") : t("apiKey")}<input type="password" value={customApiKey} onChange={(event) => { setCustomApiKey(event.target.value); invalidateCheck(); }} placeholder={t("apiKeyPlaceholder")} autoComplete="off" /></label>
                      <div className="button-row">
                        <button className="button secondary" onClick={useOllama}>{t("localOllama")}</button>
                        <button className="button secondary" onClick={loadCustomModels} disabled={customModelsLoading || !customBaseUrl.trim()}>{customModelsLoading ? t("loadingModels") : t("loadCustomModels")}</button>
                      </div>
                      <p className="muted small">{t("modelDiscoveryHint")} {t("corsHint")}</p>
                    </div>
                  )}
                </div>
                <div className="setup-section">
                  <h2>{t("protocolTitle")}</h2>
                  <div className="form-grid">
                    {connection === "hefu" ? (
                      <label>{t("model")}
                        <select value={selectedModel} onChange={(event) => { setSelectedModel(event.target.value); setConfigModel(event.target.value); invalidateCheck(); }} disabled={!session || modelsLoading}>
                          <option value="">{t("selectModel")}</option>
                          {availableModels.map((model) => <option key={model.id} value={model.id}>{modelLabel(model)}</option>)}
                        </select>
                      </label>
                    ) : (
                      <label>{t("model")}<input list="custom-model-ids" value={customModel} onChange={(event) => { setCustomModel(event.target.value); invalidateCheck(); }} placeholder={t("modelPlaceholder")} /></label>
                    )}
                    <datalist id="custom-model-ids">{customModelIds.map((id) => <option key={id} value={id} />)}</datalist>
                    <label>{t("protocol")}
                      <select value={protocol} onChange={(event) => { setProtocol(event.target.value as Protocol); invalidateCheck(); }} disabled={allowedProtocols.length === 0}>
                        {allowedProtocols.map((item) => <option key={item} value={item}>{protocolText(item)}</option>)}
                      </select>
                    </label>
                    {selectedModelInfo && connection === "hefu" && (
                      <div className="capability-row"><span>{t("supportedProtocols")}</span><div>{modelProtocols(selectedModelInfo).map((item) => <span className="capability" key={item}>{item}</span>)}</div></div>
                    )}
                    {!protocolAdvertised && <p className="notice">{t("protocolUnsupported")}</p>}
                  </div>
                </div>
              </section>

              <section className="panel live-panel">
                <h2>{t("testTitle")}</h2>
                <p className="muted">{t("freeCheck")}</p>
                <button className="button secondary full" onClick={runPreflight} disabled={running}>{t("preflight")}</button>
                <p className="muted small">{t("preflightHint")}</p>
                <div className="cost-note">
                  {connection === "custom" ? t("customPriceUnknown") : estimatedCost ? <><strong>{t("estimatedCost")}: ≈ {estimatedCost.amount.toFixed(6)} {estimatedCost.currency}</strong><span>{t("priceUnknown")}</span></> : t("priceUnknown")}
                </div>
                <label className="consent-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={!activeModel || (connection === "hefu" && !session) || !protocolAdvertised} /><span>{t("consent")}</span></label>
                <button className="button primary full" disabled={!consent || running || !activeModel || (connection === "hefu" && !session) || !protocolAdvertised} onClick={runCheck}>{running ? t("runningCheck") : t("runCheck")}</button>
                <p className="muted small centered">{t("noAutoRun")}</p>
              </section>
              {notice && <div className={`notice ${noticeTone}`} role={noticeTone === "error" ? "alert" : "status"}>{notice}</div>}
            </div>

            <section ref={resultRef} className={`panel result-panel ${result?.status || "empty"}`} aria-live="polite" aria-busy={running}>
              <div className="result-heading"><h2>{t("resultTitle")}</h2>{result && <span className={`result-status ${result.status}`}>{t(result.status === "passed" ? "passed" : "failed")}</span>}</div>
              {!result ? <div className="empty-state"><div className="pulse-ring" /><p>{running ? t("runningCheck") : t("emptyResult")}</p></div> : (
                <>
                  <div className="metric-grid">
                    <div><span>{t("httpStatus")}</span><strong>{result.http_status ?? "—"}</strong></div>
                    <div><span>{t("latency")}</span><strong>{result.latency_ms} ms</strong></div>
                    <div><span>{t("responseShape")}</span><strong>{t(result.response_shape_valid ? "validShape" : "invalidShape")}</strong></div>
                  </div>
                  <div className="result-detail"><span className="label">{result.protocol} · {result.model}</span><h3>{result.message}</h3><p><strong>{t("recommendation")}: </strong>{result.recommendation}</p></div>
                  {result.status === "passed" && <p className="success-text result-next">{t("resultNextStep")}</p>}
                  <div className="button-row result-actions">
                    {result.status === "passed" && <button className="button primary" onClick={configureFromResult}>{t("configFromResult")}</button>}
                    {result.status === "passed" && result.connection === "hefu" && <a className="button secondary" href={hefuLink("/")} target="_blank" rel="noreferrer">{t("openConsole")}</a>}
                    <button className="button secondary" onClick={downloadReport}>{t("downloadReport")}</button>
                    <button className="button secondary" onClick={() => copyText(createSafeReport(result), "report")}>{copied === "report" ? t("copied") : t("copyResult")}</button>
                  </div>
                  <p className="muted small">{t("safeReportHint")}</p>
                </>
              )}
            </section>
          </div>
        ) : (
          <section className="panel config-panel" id="configure-panel" role="tabpanel" aria-labelledby="configure-tab">
            <div className="config-intro"><h2>{t("configTitle")}</h2><p className="muted">{t("configDescription")}</p></div>
            <div className="config-layout">
              <div className="form-grid config-controls">
                <label>{t("client")}<select value={client} onChange={(event) => setClient(event.target.value as ClientTarget)}>{clients.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
                <label>{t("configModel")}<input value={configModel} onChange={(event) => setConfigModel(event.target.value)} placeholder="your-model-id" /></label>
                <label>{t("configConnection")}<select value={configConnection} onChange={(event) => setConfigConnection(event.target.value as ConnectionKind)}><option value="hefu">{t("useHefu")}</option><option value="custom">{t("useCustom")}</option></select></label>
                {configConnection === "custom" && <label>{t("configCustomBase")}<input value={configBaseUrl} onChange={(event) => setConfigBaseUrl(event.target.value)} placeholder="https://provider.example/v1" /></label>}
                {client !== "codex" && client !== "claude-code" && client !== "cline" && <label>{t("protocol")}<select value={configProtocol} onChange={(event) => setConfigProtocol(event.target.value as Protocol)}><option value="chat">{t("chatProtocol")}</option><option value="responses">{t("responsesProtocol")}</option><option value="anthropic">{t("anthropicProtocol")}</option></select></label>}
                {(client === "codex" || client === "claude-code" || client === "cline") && <div className="fixed-protocol"><span>{t("requiredProtocol")}</span><strong>{protocolText(effectiveConfigProtocol)}</strong></div>}
              </div>
              <div className="code-panel">
                <div className="code-heading"><span>{t("generatedCode")}</span><button className="button secondary small-button" onClick={() => copyText(generatedConfig, "config")}>{copied === "config" ? t("copied") : t("copyConfig")}</button></div>
                <pre tabIndex={0}><code>{generatedConfig}</code></pre>
              </div>
            </div>
            {client === "codex" && <p className="muted small">{t("codexProtocolNote")}</p>}
            {!configCompatible && <p className="notice error">{t("configCompatibility")}</p>}
            <p className="notice">{t("configNote")}</p>
            {notice && <div className={`notice ${noticeTone}`} role={noticeTone === "error" ? "alert" : "status"}>{notice}</div>}
          </section>
        )}

        <section className="privacy-section">
          <h2>{t("privacyTitle")}</h2>
          <div className="privacy-grid"><p>{t("privacyOne")}</p><p>{t("privacyTwo")}</p><p>{t("privacyThree")}</p></div>
        </section>
      </main>

      <footer><span>© {new Date().getFullYear()} {t("brand")}. {t("footer")}</span><span className="footer-links"><a href={sourceLinks.github}>GitHub</a><a href={sourceLinks.gitee}>Gitee</a><span>{doctorConfig.toolVersion}</span></span></footer>
    </div>
  );
}
