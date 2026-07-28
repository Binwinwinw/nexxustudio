import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  GitBranch,
  Loader2,
} from "lucide-react";
import { useOperatorTrace } from "../../context/OperatorTraceContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const MAJOR_SPAN_NAMES = new Set([
  "nexxus.turn",
  "intent.classify",
  "policy.route",
  "router.semantic",
  "router.lexical",
  "router.cognitive",
  "router.hydration",
  "prompt.build",
  "llm.call",
  "response.validate",
  "memory.read",
  "memory.write",
  "tool.call",
  "forge.job.start",
]);

function statusClass(status) {
  switch ((status || "").toLowerCase()) {
    case "ok":
      return "trace-status-ok";
    case "error":
      return "trace-status-error";
    default:
      return "trace-status-progress";
  }
}

function formatMs(ms) {
  if (ms == null || Number.isNaN(ms)) return "—";
  return `${Math.round(ms)}ms`;
}

function pickMajorSpans(spans = []) {
  const major = spans.filter((span) => MAJOR_SPAN_NAMES.has(span.name));
  const source = major.length > 0 ? major : spans;
  return source.slice(0, 8);
}

function pickMajorTimeline(events = []) {
  return (events || [])
    .filter((event) => {
      const name = event.event || "";
      return (
        name.startsWith("pipeline.") ||
        name.startsWith("span.") ||
        name.startsWith("trace.") ||
        name.startsWith("forge.")
      );
    })
    .slice(-8);
}

async function copyText(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

export default function TraceDebugPanel({ sessionId }) {
  const { lastTrace, recentTraces, registerTrace } = useOperatorTrace();
  const [expanded, setExpanded] = useState(false);
  const [selectedTraceId, setSelectedTraceId] = useState(null);
  const [traceDetail, setTraceDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [bootstrapDiag, setBootstrapDiag] = useState(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);

  const activeTraceId = selectedTraceId || lastTrace?.traceId || null;

  const sessionTraces = useMemo(() => {
    if (!sessionId) return recentTraces;
    const filtered = recentTraces.filter((t) => t.sessionId === sessionId);
    return filtered.length > 0 ? filtered : recentTraces;
  }, [recentTraces, sessionId]);

  const loadBootstrapDiagnostics = useCallback(async () => {
    setBootstrapLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/bootstrap/diagnostics`);
      if (!response.ok) return;
      const payload = await response.json();
      setBootstrapDiag(payload);

      const errorEvent = (payload.events || []).find(
        (event) => event.status === "error",
      );
      if (errorEvent?.trace_id) {
        registerTrace({
          traceId: errorEvent.trace_id,
          status: "error",
          source: "bootstrap",
          error: errorEvent.message || errorEvent.event,
        });
        if (!selectedTraceId) {
          setSelectedTraceId(errorEvent.trace_id);
        }
      }
    } catch {
      /* diagnostics optionnels */
    } finally {
      setBootstrapLoading(false);
    }
  }, [registerTrace, selectedTraceId]);

  useEffect(() => {
    if (!expanded) return undefined;
    loadBootstrapDiagnostics();
    const timer = setInterval(loadBootstrapDiagnostics, 8000);
    return () => clearInterval(timer);
  }, [expanded, loadBootstrapDiagnostics]);

  const loadTrace = useCallback(async (traceId) => {
    if (!traceId) return;
    setLoading(true);
    setFetchError(null);
    setSelectedTraceId(traceId);

    try {
      const response = await fetch(`${API_BASE}/api/traces/${traceId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const payload = await response.json();
      setTraceDetail(payload.data || payload);
    } catch (error) {
      setTraceDetail(null);
      setFetchError(error.message || "Impossible de charger la trace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded && lastTrace?.traceId && lastTrace.status === "error") {
      loadTrace(lastTrace.traceId);
    }
  }, [expanded, lastTrace?.traceId, lastTrace?.status, loadTrace]);

  const majorSpans = useMemo(
    () => pickMajorSpans(traceDetail?.spans || []),
    [traceDetail],
  );

  const majorTimeline = useMemo(
    () => pickMajorTimeline(traceDetail?.timeline || []),
    [traceDetail],
  );

  const handleCopy = async () => {
    await copyText(activeTraceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="cockpit-card col-span-2 trace-debug-panel">
      <button
        type="button"
        className="trace-debug-toggle"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <div className="card-header mb-0">
          <GitBranch size={14} className="text-amber-400" />
          <span>DEBUG TRACES</span>
          <span className="trace-debug-hint">Mode opérateur — repliable</span>
        </div>
        {expanded ? (
          <ChevronDown size={16} className="text-slate-400" />
        ) : (
          <ChevronRight size={16} className="text-slate-400" />
        )}
      </button>

      {!expanded && lastTrace?.traceId && (
        <div className="trace-debug-collapsed-summary">
          <span className={`trace-status-pill ${statusClass(lastTrace.status)}`}>
            {lastTrace.status}
          </span>
          <code className="trace-id-snippet">{lastTrace.traceId.slice(0, 8)}…</code>
        </div>
      )}

      {expanded && (
        <div className="trace-debug-body">
          <div className="trace-debug-toolbar">
            <div className="trace-id-row">
              <span className="label">trace_id</span>
              <code className="trace-id-full">
                {activeTraceId || "— aucun tour récent —"}
              </code>
              {activeTraceId && (
                <button
                  type="button"
                  className="trace-icon-btn"
                  onClick={handleCopy}
                  title="Copier trace_id"
                >
                  <Copy size={12} />
                  {copied ? "OK" : ""}
                </button>
              )}
            </div>

            {lastTrace && (
              <div className="trace-meta-row">
                <span className={`trace-status-pill ${statusClass(lastTrace.status)}`}>
                  {lastTrace.status}
                </span>
                <span className="trace-meta-chip">{lastTrace.source || "chat"}</span>
                {lastTrace.error && (
                  <span className="trace-meta-error" title={lastTrace.error}>
                    {lastTrace.error.slice(0, 48)}
                    {lastTrace.error.length > 48 ? "…" : ""}
                  </span>
                )}
              </div>
            )}

            <div className="trace-actions">
              <button
                type="button"
                className="trace-action-btn"
                disabled={!activeTraceId || loading}
                onClick={() => loadTrace(activeTraceId)}
              >
                {loading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <ExternalLink size={12} />
                )}
                Ouvrir la trace
              </button>

              {sessionTraces.length > 1 && (
                <select
                  className="trace-select"
                  value={activeTraceId || ""}
                  onChange={(event) => {
                    const id = event.target.value;
                    if (id) loadTrace(id);
                  }}
                >
                  {sessionTraces.map((trace) => (
                    <option key={trace.traceId} value={trace.traceId}>
                      {trace.traceId.slice(0, 8)}… — {trace.status}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="trace-bootstrap-section">
            <div className="trace-section-title">
              Bootstrap / Warmup
              {bootstrapLoading && (
                <Loader2 size={12} className="animate-spin inline ml-2" />
              )}
            </div>
            {bootstrapDiag ? (
              <>
                <div className="trace-bootstrap-probes">
                  <span className="trace-meta-chip">live: {bootstrapDiag.probes?.live}</span>
                  <span className="trace-meta-chip">
                    startup: {bootstrapDiag.probes?.startup}
                  </span>
                  <span className="trace-meta-chip">ready: {bootstrapDiag.probes?.ready}</span>
                  <span className="trace-meta-chip">
                    phase: {bootstrapDiag.warmup?.phase || "—"}
                  </span>
                </div>
                <div className="trace-id-row">
                  <span className="label">boot_trace_id</span>
                  <code className="trace-id-full">
                    {bootstrapDiag.boot_trace_id || "—"}
                  </code>
                  {bootstrapDiag.boot_trace_id && (
                    <button
                      type="button"
                      className="trace-icon-btn"
                      onClick={() => loadTrace(bootstrapDiag.boot_trace_id)}
                      title="Charger boot_trace_id"
                    >
                      <ExternalLink size={12} />
                    </button>
                  )}
                </div>
                <div className="trace-bootstrap-events">
                  {(bootstrapDiag.events || []).slice(0, 6).map((event) => (
                    <div
                      key={`${event.timestamp}-${event.event}`}
                      className="trace-bootstrap-event-row"
                    >
                      <span className="trace-timeline-event">{event.event}</span>
                      <span className={`trace-status-pill ${statusClass(event.status)}`}>
                        {event.status}
                      </span>
                      {event.message && (
                        <span className="trace-timeline-meta" title={event.message}>
                          {event.message.slice(0, 64)}
                          {event.message.length > 64 ? "…" : ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="trace-empty">Diagnostics bootstrap indisponibles.</div>
            )}
          </div>

          {fetchError && (
            <div className="trace-fetch-error">
              {fetchError}
              {lastTrace?.status === "error" && activeTraceId && (
                <button
                  type="button"
                  className="trace-link-btn"
                  onClick={() => loadTrace(activeTraceId)}
                >
                  Réessayer
                </button>
              )}
            </div>
          )}

          {traceDetail && !fetchError && (
            <>
              <div className="trace-summary-grid">
                <div className="stat-box">
                  <span className="label">Durée</span>
                  <span className="val">{formatMs(traceDetail.duration_ms)}</span>
                </div>
                <div className="stat-box">
                  <span className="label">Spans</span>
                  <span className="val">{traceDetail.spans?.length || 0}</span>
                </div>
                <div className="stat-box">
                  <span className="label">Mode</span>
                  <span className="val text-xs">
                    {traceDetail.response_mode || "—"}
                  </span>
                </div>
                <div className="stat-box">
                  <span className="label">Session</span>
                  <span className="val text-xs truncate">
                    {traceDetail.session_id?.slice(0, 12) || "—"}
                  </span>
                </div>
              </div>

              <div className="trace-section-title">Spans majeurs</div>
              <div className="trace-span-list">
                {majorSpans.length === 0 ? (
                  <div className="trace-empty">Aucun span enregistré.</div>
                ) : (
                  majorSpans.map((span) => (
                    <div key={`${span.span_id}-${span.name}`} className="trace-span-row">
                      <span className="trace-span-name">{span.name}</span>
                      <span className={`trace-status-pill ${statusClass(span.status)}`}>
                        {span.status || "ok"}
                      </span>
                      <span className="trace-span-duration">
                        {formatMs(span.duration_ms ?? span.durationMs)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {majorTimeline.length > 0 && (
                <>
                  <div className="trace-section-title">Timeline réduite</div>
                  <div className="trace-timeline">
                    {majorTimeline.map((event, index) => (
                      <div
                        key={`${event.timestamp}-${event.event}-${index}`}
                        className="trace-timeline-row"
                      >
                        <span className="trace-timeline-event">{event.event}</span>
                        <span className={`trace-status-pill ${statusClass(event.status)}`}>
                          {event.status}
                        </span>
                        {event.path && (
                          <span className="trace-timeline-meta">{event.path}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {!traceDetail && !loading && !fetchError && (
            <div className="trace-empty">
              Sélectionnez un tour récent ou cliquez sur « Ouvrir la trace ».
            </div>
          )}
        </div>
      )}
    </div>
  );
}
