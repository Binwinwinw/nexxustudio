import React from "react";
import {
  MessageSquare,
  ExternalLink,
  Activity,
  Trash2,
  Clock,
} from "lucide-react";
import {
  getSessionDisplayTitle,
  formatSessionDate,
  inferSessionKind,
  SESSION_KIND_META,
  getSessionPreviewLine,
  isDefaultSessionTitle,
} from "../../utils/sessionGrouping";

function SessionPreviewContent({
  session,
  isCurrentSession,
  onOpenInChat,
  onOpenAudit,
  onDeleteSession,
}) {
  const title = getSessionDisplayTitle(session);
  const kind = inferSessionKind(session);
  const meta = SESSION_KIND_META[kind] || SESSION_KIND_META.chat;
  const previewLine = getSessionPreviewLine(session, 400);

  return (
    <>
      <div className="shrink-0 px-4 py-4 border-b border-white/10 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <span
            className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${meta.tone}`}
          >
            {meta.label}
          </span>
          {isCurrentSession && (
            <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
              active
            </span>
          )}
        </div>
        <h3 className="text-sm font-bold text-white leading-snug break-words">{title}</h3>
        {isDefaultSessionTitle(session?.title) && session?.title && (
          <p className="text-[10px] text-slate-600 font-mono truncate" title={session.title}>
            Titre brut : {session.title}
          </p>
        )}
        <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
          <Clock size={12} />
          {formatSessionDate(session)}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-2">
          Dernier extrait
        </p>
        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
          {previewLine}
        </p>
        <p className="text-[9px] text-slate-600 font-mono mt-4 truncate" title={session.id}>
          {session.id}
        </p>
      </div>

      <div className="shrink-0 p-4 border-t border-white/10 space-y-2 bg-[#020617]/60">
        <button
          type="button"
          onClick={() => onOpenInChat(session.id)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wide shadow-lg shadow-blue-900/30"
        >
          <ExternalLink size={14} />
          Ouvrir dans le chat
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onOpenAudit(session)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-white/10 text-[10px] font-bold uppercase text-slate-400 hover:text-blue-300 hover:border-blue-500/30"
          >
            <Activity size={12} />
            Audit
          </button>
          <button
            type="button"
            onClick={() => onDeleteSession(session.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-white/10 text-[10px] font-bold uppercase text-slate-400 hover:text-red-300 hover:border-red-500/30"
          >
            <Trash2 size={12} />
            Suppr.
          </button>
        </div>
      </div>
    </>
  );
}

export default function SessionPreviewPane({
  session,
  isCurrentSession,
  onOpenInChat,
  onOpenAudit,
  onDeleteSession,
  variant = "desktop",
}) {
  if (!session) {
    if (variant === "sheet") return null;
    return (
      <aside className="history-preview hidden xl:flex flex-col h-full min-h-0 min-w-0 border-l border-white/10 bg-black/25">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <MessageSquare size={32} className="text-slate-700 mb-3" />
          <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">
            Aperçu
          </p>
          <p className="text-[11px] text-slate-600 mt-2">
            Sélectionnez une session dans la liste pour prévisualiser avant d&apos;ouvrir le
            chat.
          </p>
        </div>
      </aside>
    );
  }

  if (variant === "sheet") {
    return (
      <div className="flex flex-col min-h-[50vh] h-full">
        <SessionPreviewContent
          session={session}
          isCurrentSession={isCurrentSession}
          onOpenInChat={onOpenInChat}
          onOpenAudit={onOpenAudit}
          onDeleteSession={onDeleteSession}
        />
      </div>
    );
  }

  return (
    <aside className="history-preview hidden xl:flex flex-col h-full min-h-0 min-w-0 border-l border-white/10 bg-black/25">
      <SessionPreviewContent
        session={session}
        isCurrentSession={isCurrentSession}
        onOpenInChat={onOpenInChat}
        onOpenAudit={onOpenAudit}
        onDeleteSession={onDeleteSession}
      />
    </aside>
  );
}
