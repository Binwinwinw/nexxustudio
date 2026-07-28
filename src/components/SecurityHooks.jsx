import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  ShieldAlert,
  Snowflake,
  BookLock,
  CheckCircle2,
  Power,
} from "lucide-react";
import GlassCard from "./GlassCard";
import CitadelleModuleShell from "./layout/CitadelleModuleShell";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const HOOK_DEFINITIONS = [
  {
    name: "/careful",
    description: "Bloque les commandes destructives",
    protected: ["rm -rf", "git push --force", "drop table", "chmod 777"],
    icon: ShieldAlert,
    accent: "border-l-amber-500",
  },
  {
    name: "/freeze",
    description: "Limite les edits à un directory",
    protectedKey: "freezeDirectory",
    fallback: "Non défini",
    icon: Snowflake,
    accent: "border-l-cyan-500",
  },
  {
    name: "/read-only",
    description: "Lecture seule dans certaines directories",
    protectedKey: "readOnlyDirectories",
    fallback: [],
    icon: BookLock,
    accent: "border-l-blue-500",
  },
  {
    name: "/confirm",
    description: "Demande confirmation pour actions critiques",
    protected: ["Suppression", "DB modifications", "Déploiements"],
    icon: CheckCircle2,
    accent: "border-l-emerald-500",
  },
];

function resolveProtectedItems(def, hooksState) {
  if (def.protected) return def.protected;
  if (def.protectedKey === "readOnlyDirectories") {
    const dirs = hooksState?.readOnlyDirectories;
    return Array.isArray(dirs) && dirs.length > 0 ? dirs : ["Aucun répertoire"];
  }
  if (def.protectedKey === "freezeDirectory") {
    return [hooksState?.freezeDirectory || def.fallback];
  }
  return [];
}

export default function SecurityHooks() {
  const [hooksState, setHooksState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingHook, setPendingHook] = useState(null);

  const fetchHooksState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/hooks/state`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setHooksState(await response.json());
    } catch (err) {
      setError(err.message || "Impossible de charger les hooks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHooksState();
    const interval = setInterval(fetchHooksState, 3000);
    return () => clearInterval(interval);
  }, [fetchHooksState]);

  const toggleHook = async (hook, activate) => {
    setPendingHook(hook);
    try {
      await fetch(`${API_BASE}/api/hooks/${activate ? "activate" : "deactivate"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ hook }),
      });
      await fetchHooksState();
    } catch (err) {
      setError(err.message || "Échec du basculement du hook");
    } finally {
      setPendingHook(null);
    }
  };

  const activeCount = hooksState?.activeHooks?.length ?? 0;

  return (
    <CitadelleModuleShell
      icon={Shield}
      title="Hooks de Sécurité"
      subtitle="Garde-fous souverains · activation à la demande · protection des actions critiques"
      onRefresh={fetchHooksState}
      loading={loading}
      error={error}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <GlassCard className="p-4 !rounded-2xl border-l-4 border-l-emerald-500 sm:col-span-2 lg:col-span-1">
          <p className="text-slate-400 text-[9px] uppercase tracking-widest font-black">
            Hooks actifs
          </p>
          <p className="text-3xl font-black text-white mt-2">
            {loading && !hooksState ? "—" : activeCount}
            <span className="text-sm font-normal text-slate-500 ml-2">
              / {HOOK_DEFINITIONS.length}
            </span>
          </p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {HOOK_DEFINITIONS.map((def) => {
          const Icon = def.icon;
          const isActive = hooksState?.activeHooks?.includes(def.name) ?? false;
          const protectedItems = hooksState
            ? resolveProtectedItems(def, hooksState)
            : def.protected || [];

          return (
            <GlassCard
              key={def.name}
              className={`p-5 !rounded-2xl border-l-4 ${def.accent} transition-all ${
                isActive
                  ? "ring-1 ring-emerald-500/30 bg-emerald-500/5"
                  : "opacity-90"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2 rounded-xl border ${
                      isActive
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-white/5 border-white/10 text-slate-400"
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono font-bold text-slate-100 truncate">
                      {def.name}
                    </p>
                    <p
                      className={`text-[9px] uppercase tracking-widest font-black mt-0.5 ${
                        isActive ? "text-emerald-400" : "text-slate-500"
                      }`}
                    >
                      {isActive ? "Actif" : "Inactif"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!hooksState || pendingHook === def.name}
                  onClick={() => toggleHook(def.name, !isActive)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 ${
                    isActive
                      ? "bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"
                  }`}
                >
                  <Power size={12} />
                  {pendingHook === def.name
                    ? "..."
                    : isActive
                      ? "Désactiver"
                      : "Activer"}
                </button>
              </div>

              <p className="text-sm text-slate-400 mb-4">{def.description}</p>

              <div className="rounded-xl border border-white/5 bg-black/25 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">
                  Protège
                </p>
                <ul className="space-y-1">
                  {protectedItems.map((item, idx) => (
                    <li
                      key={`${def.name}-${idx}`}
                      className="text-xs text-slate-300 font-mono truncate"
                    >
                      · {item}
                    </li>
                  ))}
                </ul>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </CitadelleModuleShell>
  );
}
