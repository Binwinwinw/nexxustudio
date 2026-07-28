/**
 * @deprecated Drawer historique — remplacé par la vue centrale CITADELLE_VIEWS.SESSIONS.
 * Conservé pour compatibilité imports externes éventuels.
 */
import React from "react";
import { X, Clock } from "lucide-react";
import SessionHistoryPanel from "./sessions/SessionHistoryPanel.jsx";

const Sidebar = ({
  isOpen,
  onClose,
  sessions,
  bootstrapPhase,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onOpenAudit,
}) => {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-80 z-50 transition-transform duration-500 ease-in-out transform ${isOpen ? "translate-x-0" : "-translate-x-full"} glass-panel rounded-none border-y-0 border-l-0 flex flex-col shadow-2xl`}
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <h2 className="text-sm font-bold tracking-widest uppercase text-blue-400 flex items-center gap-2">
            <Clock size={16} /> Historique
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
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
      </aside>
    </>
  );
};

export default Sidebar;
