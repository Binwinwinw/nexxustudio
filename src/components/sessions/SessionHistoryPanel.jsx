import React from "react";
import { Plus, ArrowUpDown, SlidersHorizontal, PanelRightOpen } from "lucide-react";
import {
  filterSessions,
  filterSessionsByKind,
  groupSessions,
  groupSessionsByRecency,
  sortSessionsByTitle,
} from "../../utils/sessionGrouping";
import HistoryFiltersPane from "./HistoryFiltersPane.jsx";
import SessionHistoryList from "./SessionHistoryList.jsx";
import SessionPreviewPane from "./SessionPreviewPane.jsx";
import MobileOverlaySheet from "./MobileOverlaySheet.jsx";

const filtersPaneProps = (props) => ({
  searchTerm: props.searchTerm,
  onSearchChange: props.setSearchTerm,
  kindFilter: props.kindFilter,
  onKindFilterChange: props.setKindFilter,
  totalCount: props.sessions.length,
  visibleCount: props.pipeline.length,
  sessionGroups: props.useDateGroups ? props.dateGroups : props.legacyGroups,
  collapsedGroups: props.collapsedGroups,
  onToggleGroup: props.toggleGroup,
});

/**
 * Mailbox responsive : mobile liste seule + sheets ; md filtres+liste ; xl + aperçu.
 */
export default function SessionHistoryPanel({
  sessions = [],
  bootstrapPhase,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onOpenAudit,
}) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [kindFilter, setKindFilter] = React.useState("all");
  const [sortBy, setSortBy] = React.useState("recent");
  const [groupMode, setGroupMode] = React.useState("date");
  const [collapsedGroups, setCollapsedGroups] = React.useState({ default: true });
  const [previewId, setPreviewId] = React.useState(currentSessionId);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [previewSheetOpen, setPreviewSheetOpen] = React.useState(false);

  const isLoadingSessions =
    bootstrapPhase === "connecting" || bootstrapPhase === "loading_sessions";

  const pipeline = React.useMemo(() => {
    let list = filterSessionsByKind(sessions, kindFilter);
    list = filterSessions(list, searchTerm);
    if (sortBy === "title") list = sortSessionsByTitle(list);
    return list;
  }, [sessions, kindFilter, searchTerm, sortBy]);

  const dateGroups = React.useMemo(
    () => groupSessionsByRecency(pipeline),
    [pipeline],
  );

  const legacyGroups = React.useMemo(() => groupSessions(pipeline), [pipeline]);

  const previewSession = React.useMemo(
    () => sessions.find((s) => s.id === previewId) || null,
    [sessions, previewId],
  );

  const useDateGroups = groupMode === "date";

  const paneCtx = {
    searchTerm,
    setSearchTerm,
    kindFilter,
    setKindFilter,
    sessions,
    pipeline,
    dateGroups,
    legacyGroups,
    useDateGroups,
    collapsedGroups,
    toggleGroup: (groupId) => {
      setCollapsedGroups((prev) => ({
        ...prev,
        [groupId]: !prev[groupId],
      }));
    },
  };

  React.useEffect(() => {
    if (currentSessionId) setPreviewId(currentSessionId);
  }, [currentSessionId]);

  React.useEffect(() => {
    if (!pipeline.length) {
      setPreviewId(null);
      return;
    }
    if (!pipeline.some((s) => s.id === previewId)) {
      setPreviewId(pipeline[0].id);
    }
  }, [pipeline, previewId]);

  React.useEffect(() => {
    if (searchTerm.trim()) {
      setCollapsedGroups((prev) => ({ ...prev, default: false }));
    }
  }, [searchTerm]);

  const handleOpenInChat = (id) => {
    if (!id) return;
    setPreviewSheetOpen(false);
    setFiltersOpen(false);
    onSelectSession(id);
  };

  const handleSelectPreview = (id) => {
    setPreviewId(id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches) {
      setPreviewSheetOpen(true);
    }
  };

  return (
    <div
      className="history-layout grid h-full min-h-0 min-w-0 w-full grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_minmax(280px,320px)] overflow-hidden"
    >
      {/* Colonne 1 — filtres (tablette+), masquée sur mobile */}
      <div className="hidden md:block min-h-0 min-w-0 overflow-hidden border-r border-white/10">
        <HistoryFiltersPane
          {...filtersPaneProps(paneCtx)}
          className="h-full border-r-0"
        />
      </div>

      <MobileOverlaySheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtres"
        side="left"
      >
        <HistoryFiltersPane
          {...filtersPaneProps(paneCtx)}
          className="min-h-[70vh] border-r-0"
        />
      </MobileOverlaySheet>

      {/* Colonne 2 — liste (toujours visible) */}
      <main className="history-main flex flex-col min-w-0 min-h-0 overflow-hidden">
        <div className="history-toolbar shrink-0 sticky top-0 z-30 flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-white/10 bg-[#020617]/95 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-[10px] font-bold uppercase text-slate-400 hover:text-white hover:bg-white/5"
          >
            <SlidersHorizontal size={14} />
            Filtres
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0 md:min-w-[140px]">
            <input
              type="search"
              placeholder="Rechercher…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-w-0 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-xs text-white"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end w-full sm:w-auto">
            <div
              className="flex rounded-lg border border-white/10 overflow-hidden shrink-0"
              role="group"
              aria-label="Regroupement"
            >
              {[
                { id: "date", label: "Date" },
                { id: "type", label: "Type" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setGroupMode(m.id)}
                  className={`px-2 py-1 text-[10px] font-bold uppercase ${
                    groupMode === m.id
                      ? "bg-white/10 text-white"
                      : "text-slate-500"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSortBy((s) => (s === "recent" ? "title" : "recent"))}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 text-[10px] font-bold uppercase text-slate-400 hover:text-white"
            >
              <ArrowUpDown size={12} />
              {sortBy === "recent" ? "Récent" : "A–Z"}
            </button>

            {previewSession && (
              <button
                type="button"
                onClick={() => setPreviewSheetOpen(true)}
                className="xl:hidden flex items-center gap-1 px-2 py-1 rounded-lg border border-blue-500/30 text-[10px] font-bold uppercase text-blue-300"
              >
                <PanelRightOpen size={12} />
                Aperçu
              </button>
            )}

            <button
              type="button"
              onClick={onNewSession}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase"
            >
              <Plus size={14} />
              Nouveau
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 min-w-0 nexxus-scroll overflow-x-hidden px-3 py-3">
          <SessionHistoryList
            isLoading={isLoadingSessions}
            searchTerm={searchTerm}
            dateGroups={dateGroups}
            legacyGroups={legacyGroups}
            useDateGroups={useDateGroups}
            collapsedGroups={collapsedGroups}
            previewId={previewId}
            currentSessionId={currentSessionId}
            onSelectPreview={handleSelectPreview}
            onOpenInChat={handleOpenInChat}
            onOpenAudit={onOpenAudit}
            onDeleteSession={onDeleteSession}
          />
        </div>
      </main>

      {/* Colonne 3 — aperçu desktop xl+ */}
      <div className="hidden xl:block min-h-0 min-w-0 overflow-hidden">
        <SessionPreviewPane
          session={previewSession}
          isCurrentSession={previewId === currentSessionId}
          onOpenInChat={handleOpenInChat}
          onOpenAudit={onOpenAudit}
          onDeleteSession={onDeleteSession}
        />
      </div>

      <MobileOverlaySheet
        open={previewSheetOpen && Boolean(previewSession)}
        onClose={() => setPreviewSheetOpen(false)}
        title="Aperçu session"
        side="right"
      >
        {previewSession && (
          <SessionPreviewPane
            variant="sheet"
            session={previewSession}
            isCurrentSession={previewId === currentSessionId}
            onOpenInChat={handleOpenInChat}
            onOpenAudit={onOpenAudit}
            onDeleteSession={onDeleteSession}
          />
        )}
      </MobileOverlaySheet>
    </div>
  );
}
