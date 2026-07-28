import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const OperatorTraceContext = createContext(null);

/** Pont léger pour services hors React (ProductionService, etc.). */
let externalTraceRegistrar = null;

export function bindOperatorTraceRegistrar(fn) {
  externalTraceRegistrar = fn;
}

export function pushOperatorTrace(payload) {
  externalTraceRegistrar?.(payload);
}

/**
 * État opérateur — dernier trace_id chat/Forge pour le panneau Cockpit debug.
 */
export function OperatorTraceProvider({ children }) {
  const [lastTrace, setLastTrace] = useState(null);
  const [recentTraces, setRecentTraces] = useState([]);

  const upsertTrace = useCallback((payload) => {
    if (!payload?.traceId) return;

    const entry = {
      traceId: payload.traceId,
      status: payload.status || "in_progress",
      source: payload.source || "chat",
      sessionId: payload.sessionId || null,
      error: payload.error || null,
      at: payload.at || Date.now(),
    };

    setLastTrace((prev) => {
      if (prev?.traceId === entry.traceId) {
        return { ...prev, ...entry };
      }
      return entry;
    });

    setRecentTraces((prev) => {
      const filtered = prev.filter((t) => t.traceId !== entry.traceId);
      return [entry, ...filtered].slice(0, 5);
    });
  }, []);

  const registerTrace = useCallback(
    (payload) => upsertTrace({ ...payload, at: Date.now() }),
    [upsertTrace],
  );

  const updateTrace = useCallback(
    (traceId, patch = {}) => {
      if (!traceId) return;
      upsertTrace({
        traceId,
        ...patch,
        at: Date.now(),
      });
    },
    [upsertTrace],
  );

  const value = useMemo(
    () => ({
      lastTrace,
      recentTraces,
      registerTrace,
      updateTrace,
    }),
    [lastTrace, recentTraces, registerTrace, updateTrace],
  );

  useEffect(() => {
    bindOperatorTraceRegistrar(registerTrace);
    return () => bindOperatorTraceRegistrar(null);
  }, [registerTrace]);

  return (
    <OperatorTraceContext.Provider value={value}>
      {children}
    </OperatorTraceContext.Provider>
  );
}

export function useOperatorTrace() {
  const ctx = useContext(OperatorTraceContext);
  if (!ctx) {
    throw new Error("useOperatorTrace must be used within OperatorTraceProvider");
  }
  return ctx;
}

export default OperatorTraceContext;
