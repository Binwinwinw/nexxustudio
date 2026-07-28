import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquare,
  Gauge,
  Activity,
  Shield,
  Sliders,
  AlertTriangle,
  FolderKanban,
  History,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Landmark,
  Hammer,
  Settings,
  Scale,
  GitBranch,
  X,
} from "lucide-react";
import { CITADELLE_VIEWS } from "../../context/citadelleViews.js";
import {
  PRIMARY_NAV_SECTIONS,
  SETTINGS_NAV_ITEMS,
  SETTINGS_DISCLOSURE_ID,
  MOBILE_PRIMARY_NAV_ITEMS,
} from "../../config/citadelleNav.js";
import { useSidebar } from "../../context/SidebarContext";
import PerformanceMonitor from "../PerformanceMonitor.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const VIEW_ICONS = {
  [CITADELLE_VIEWS.CHAT]: MessageSquare,
  [CITADELLE_VIEWS.SESSIONS]: History,
  [CITADELLE_VIEWS.COCKPIT]: Gauge,
  [CITADELLE_VIEWS.TELEMETRY]: Activity,
  [CITADELLE_VIEWS.GOVERNANCE]: Scale,
  [CITADELLE_VIEWS.INTENT_TRIAGE]: GitBranch,
  [CITADELLE_VIEWS.SECURITY_TELEMETRY]: Shield,
  [CITADELLE_VIEWS.SECURITY_HOOKS]: Sliders,
  [CITADELLE_VIEWS.IMPACT_AUDIT]: AlertTriangle,
  [CITADELLE_VIEWS.PROJECT]: FolderKanban,
  [CITADELLE_VIEWS.FORGE_ASYNC]: Hammer,
};

function resolveIcon(viewId) {
  return VIEW_ICONS[viewId] || Settings;
}

function useConversationHealthBadge() {
  const [conversationHealth, setConversationHealth] = useState(null);

  useEffect(() => {
    let active = true;
    let intervalId = null;

    const fetchHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/conversation/health`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          setConversationHealth(data);
        }
      } catch {
        // Le badge reste silencieux en cas d'indisponibilité API.
      }
    };

    fetchHealth();
    intervalId = setInterval(fetchHealth, 8000);

    return () => {
      active = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return useMemo(() => getConversationBadge(conversationHealth), [conversationHealth]);
}

function getConversationBadge(healthPayload) {
  const today = healthPayload?.health?.today;
  const fallbackRate = today?.fallbackRatePct ?? 0;
  const incidentsToday =
    (today?.noVisibleTokens ?? 0) + (today?.streamErrorCount ?? 0);
  const lastFailureMode = healthPayload?.health?.lastFailureMode || "none";

  if (!today) {
    return {
      text: "--",
      dotClass: "bg-slate-500",
      pillClass: "text-slate-300 border-slate-500/40 bg-slate-500/10",
      tooltip: "Santé conversationnelle indisponible",
    };
  }

  if (incidentsToday > 0) {
    return {
      text: `ERR ${incidentsToday}`,
      dotClass: "bg-red-400",
      pillClass: "text-red-300 border-red-500/40 bg-red-500/10",
      tooltip: `fallbackRate: ${fallbackRate}% | mode: ${lastFailureMode}`,
    };
  }

  if (fallbackRate >= 1) {
    return {
      text: "WARN",
      dotClass: "bg-amber-400",
      pillClass: "text-amber-300 border-amber-500/40 bg-amber-500/10",
      tooltip: `fallbackRate: ${fallbackRate}% | mode: ${lastFailureMode}`,
    };
  }

  return {
    text: "OK",
    dotClass: "bg-emerald-400",
    pillClass: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
    tooltip: `fallbackRate: ${fallbackRate}% | mode: ${lastFailureMode}`,
  };
}

function getConversationAriaStatusText(badgeText) {
  if (String(badgeText).startsWith("ERR")) return "en incident";
  if (badgeText === "WARN") return "en avertissement";
  return "ok";
}

function NavButton({
  item,
  activeView,
  collapsed,
  onNavigate,
  conversationBadge,
  nested = false,
}) {
  const isActive = item.id === activeView;
  const isCockpit = item.id === CITADELLE_VIEWS.COCKPIT;
  const Icon = resolveIcon(item.id);

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      title={isCockpit && conversationBadge ? conversationBadge.tooltip : item.label}
      aria-current={isActive ? "page" : undefined}
      className={`w-full flex items-center gap-3 rounded-xl text-left transition-all border ${
        nested ? "px-3 py-2 ml-2" : "px-3 py-2.5"
      } ${
        isActive
          ? "bg-blue-600/25 border-blue-500/50 text-white shadow-lg shadow-blue-900/20"
          : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
      }`}
    >
      <Icon size={nested ? 16 : 18} className={isActive ? "text-blue-400 shrink-0" : "shrink-0"} />
      {!collapsed && (
        <>
          <span
            className={`font-bold uppercase tracking-wider truncate ${
              nested ? "text-[10px]" : "text-[11px]"
            }`}
          >
            {item.label}
          </span>
          {isCockpit && conversationBadge && (
            <span
              className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-black tracking-wide ${conversationBadge.pillClass}`}
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${conversationBadge.dotClass}`} />
              {conversationBadge.text}
            </span>
          )}
        </>
      )}
    </button>
  );
}

function SettingsDisclosure({
  isNavCollapsed,
  expanded,
  toggleSettingsNav,
  setSettingsNavExpanded,
  isSettingsChildActive,
  activeView,
  onNavigate,
  onExpandNav,
}) {
  const settingsActive = isSettingsChildActive;

  const handleToggle = () => {
    if (isNavCollapsed) {
      onExpandNav();
      setSettingsNavExpanded(true);
      return;
    }
    toggleSettingsNav();
  };

  return (
    <div className="border-t border-white/10 p-3">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls={SETTINGS_DISCLOSURE_ID}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all border ${
          settingsActive
            ? "bg-white/5 border-white/15 text-slate-200"
            : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
        } ${isNavCollapsed ? "justify-center" : ""}`}
      >
        <Settings size={18} className={settingsActive ? "text-blue-400" : ""} />
        {!isNavCollapsed && (
          <>
            <span className="text-[10px] font-bold uppercase tracking-wider">Réglages</span>
            <ChevronDown
              size={14}
              className={`ml-auto transition-transform ${expanded ? "rotate-180" : ""}`}
              aria-hidden
            />
          </>
        )}
      </button>
      {expanded && !isNavCollapsed && (
        <ul id={SETTINGS_DISCLOSURE_ID} className="mt-2 space-y-0.5 list-none">
          {SETTINGS_NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <NavButton
                item={item}
                activeView={activeView}
                collapsed={false}
                onNavigate={onNavigate}
                nested
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CitadelleSidebar({
  stats = null,
  health = { warmup: {} },
  readyStatus = "starting",
}) {
  const {
    activeView,
    navigate,
    isNavCollapsed,
    toggleNavCollapsed,
    settingsNavExpanded,
    toggleSettingsNav,
    setSettingsNavExpanded,
    isSettingsChildActive,
  } = useSidebar();
  const conversationBadge = useConversationHealthBadge();

  const primarySections = PRIMARY_NAV_SECTIONS;

  return (
    <aside
      className={`hidden md:flex flex-col shrink-0 h-full min-h-0 z-30 border-r border-white/10 bg-[#020617]/95 backdrop-blur-xl transition-all duration-300 ${
        isNavCollapsed ? "w-[72px]" : "w-64"
      }`}
    >
      <div className="p-4 border-b border-white/10 flex items-center justify-between gap-2">
        {!isNavCollapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <Landmark className="text-blue-500 shrink-0" size={22} />
            <div className="min-w-0">
              <p className="text-xs font-black text-white uppercase tracking-tight truncate">
                La Citadelle
              </p>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest">v3.0</p>
            </div>
          </div>
        )}
        {isNavCollapsed && <Landmark className="text-blue-500 mx-auto" size={22} />}
        <button
          type="button"
          onClick={toggleNavCollapsed}
          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500"
          aria-label={isNavCollapsed ? "Étendre la navigation" : "Réduire la navigation"}
        >
          {isNavCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <div className="shrink-0 border-b border-white/10">
        <PerformanceMonitor
          stats={stats}
          health={health}
          readyStatus={readyStatus}
          variant="sidebar"
        />
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-5" aria-label="Navigation principale">
        {primarySections.map((section) => (
          <div key={section.title}>
            {!isNavCollapsed && (
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] px-2 mb-2">
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  activeView={activeView}
                  collapsed={isNavCollapsed}
                  onNavigate={navigate}
                  conversationBadge={conversationBadge}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <SettingsDisclosure
        isNavCollapsed={isNavCollapsed}
        expanded={settingsNavExpanded}
        toggleSettingsNav={toggleSettingsNav}
        setSettingsNavExpanded={setSettingsNavExpanded}
        isSettingsChildActive={isSettingsChildActive}
        activeView={activeView}
        onNavigate={navigate}
        onExpandNav={() => {
          if (isNavCollapsed) toggleNavCollapsed();
        }}
      />
    </aside>
  );
}

function MobileSettingsSheet({ open, onClose, activeView, onNavigate }) {
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const first = panelRef.current?.querySelector("button");
    first?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Fermer les réglages"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-settings-title"
        className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#0f172a] p-4 pb-8 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="mobile-settings-title" className="text-xs font-black uppercase tracking-widest text-slate-300">
            Réglages
          </h2>
          <button
            type="button"
            ref={triggerRef}
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        <ul className="space-y-1 list-none">
          {SETTINGS_NAV_ITEMS.map((item) => {
            const Icon = resolveIcon(item.id);
            const isActive = activeView === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left ${
                    isActive ? "bg-blue-600/30 text-white" : "text-slate-400 bg-white/5"
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-[11px] font-bold uppercase tracking-wider">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Barre de navigation mobile (horizontal) */
export function CitadelleMobileNav() {
  const { activeView, navigate, isSettingsChildActive } = useSidebar();
  const conversationBadge = useConversationHealthBadge();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <div className="md:hidden flex gap-1 p-2 border-b border-white/10 bg-black/40 overflow-x-auto">
        {MOBILE_PRIMARY_NAV_ITEMS.map((item) => {
          const Icon = resolveIcon(item.id);
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              aria-label={
                item.id === CITADELLE_VIEWS.COCKPIT
                  ? `Cockpit - santé conversationnelle ${getConversationAriaStatusText(conversationBadge.text)}`
                  : item.label
              }
              title={
                item.id === CITADELLE_VIEWS.COCKPIT ? conversationBadge.tooltip : item.label
              }
              aria-current={isActive ? "page" : undefined}
              className={`p-3 rounded-xl shrink-0 ${
                isActive ? "bg-blue-600 text-white" : "text-slate-500 bg-white/5"
              }`}
            >
              <span className="relative inline-flex">
                <Icon size={18} />
                {item.id === CITADELLE_VIEWS.COCKPIT && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#020617] ${conversationBadge.dotClass}`}
                    aria-hidden="true"
                  />
                )}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Réglages — modules avancés"
          aria-expanded={settingsOpen}
          className={`p-3 rounded-xl shrink-0 ${
            isSettingsChildActive ? "bg-blue-600/80 text-white" : "text-slate-500 bg-white/5"
          }`}
        >
          <Settings size={18} />
        </button>
      </div>
      <MobileSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        activeView={activeView}
        onNavigate={navigate}
      />
    </>
  );
}
