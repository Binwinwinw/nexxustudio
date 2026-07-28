import React from "react";
import { Search, Filter } from "lucide-react";

const KIND_FILTERS = [
  { id: "all", label: "Toutes" },
  { id: "named", label: "Nommées" },
  { id: "default", label: "Génériques" },
];

export default function HistoryFiltersPane({
  searchTerm,
  onSearchChange,
  kindFilter,
  onKindFilterChange,
  totalCount,
  visibleCount,
  sessionGroups,
  collapsedGroups,
  onToggleGroup,
  className = "",
}) {
  return (
    <aside
      className={`history-sidebar flex flex-col h-full min-h-0 overflow-hidden w-full bg-black/20 ${className}`}
    >
      <div className="shrink-0 p-4 space-y-4">
        <div>
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
            <Filter size={10} /> Filtres
          </p>
          <div className="flex flex-wrap gap-1.5">
            {KIND_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onKindFilterChange(f.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all ${
                  kindFilter === f.id
                    ? "bg-blue-600/30 border-blue-500/50 text-blue-200"
                    : "border-white/10 text-slate-500 hover:text-slate-300 hover:bg-white/5"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-[10px] text-slate-500 space-y-1 font-mono">
          <p>
            <span className="text-slate-400">{visibleCount}</span>
            {visibleCount !== totalCount ? ` / ${totalCount}` : ""} affichée(s)
          </p>
        </div>

      </div>

      {sessionGroups.length > 0 && (
        <nav
          className="flex-1 min-h-0 nexxus-scroll px-4 pb-2 space-y-1"
          aria-label="Groupes"
        >
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1 sticky top-0 bg-black/40 py-1">
            Groupes
          </p>
          {sessionGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => group.collapsible && onToggleGroup(group.id)}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-[10px] uppercase tracking-wide ${
                group.collapsible
                  ? "hover:bg-white/5 text-slate-500 hover:text-slate-300"
                  : "text-slate-600 cursor-default"
              }`}
            >
              <span className="truncate">{group.label}</span>
              <span className="text-slate-600 font-mono shrink-0 ml-2">
                {group.sessions.length}
              </span>
            </button>
          ))}
        </nav>
      )}

      <div className="shrink-0 p-4 border-t border-white/10">
        <label className="sr-only" htmlFor="history-search">
          Rechercher
        </label>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
          />
          <input
            id="history-search"
            type="search"
            placeholder="Titre ou message…"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>
    </aside>
  );
}
