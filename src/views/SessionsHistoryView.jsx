import React from "react";
import { Clock } from "lucide-react";
import SessionHistoryPanel from "../components/sessions/SessionHistoryPanel.jsx";

/**
 * Vue centrale Historique — layout 2 colonnes (filtres + liste dense).
 */
export default function SessionsHistoryView({
  sessions,
  bootstrapPhase,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onOpenAudit,
}) {
  return (
    <div className="h-full min-h-0 max-h-full flex flex-col rounded-2xl border border-white/10 bg-[#020617]/80 overflow-hidden min-w-0 w-full max-w-full">
      <header className="shrink-0 px-4 md:px-5 py-3 border-b border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Clock size={18} className="text-blue-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs font-black uppercase tracking-widest text-white">
              Historique
            </h2>
            <p className="text-[10px] text-slate-500 truncate">
              Prévisualisez à droite — double-clic ou « Ouvrir dans le chat »
            </p>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-mono text-slate-500 tabular-nums">
          {sessions.length} total
        </span>
      </header>

      <div className="flex-1 min-h-0">
        <SessionHistoryPanel
          sessions={sessions}
          bootstrapPhase={bootstrapPhase}
          currentSessionId={currentSessionId}
          onSelectSession={onSelectSession}
          onNewSession={onNewSession}
          onDeleteSession={onDeleteSession}
          onOpenAudit={onOpenAudit}
        />
      </div>
    </div>
  );
}
