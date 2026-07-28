import React from "react";
import {
  MessageSquare,
  Trash2,
  Activity,
  ChevronRight,
  FileSearch,
  Hammer,
} from "lucide-react";
import {
  getSessionDisplayTitle,
  formatSessionDateCompact,
  inferSessionKind,
  SESSION_KIND_META,
  getSessionPreviewLine,
} from "../../utils/sessionGrouping";

const KIND_ICONS = {
  chat: MessageSquare,
  audit: Activity,
  document: FileSearch,
  forge: Hammer,
};

export default function SessionHistoryRow({
  session,
  isSelected,
  isCurrentSession,
  onSelectPreview,
  onOpenAudit,
  onDeleteSession,
  onDoubleClickOpen,
}) {
  const title = getSessionDisplayTitle(session);
  const previewLine = getSessionPreviewLine(session, 96);
  const kind = inferSessionKind(session);
  const meta = SESSION_KIND_META[kind] || SESSION_KIND_META.chat;
  const KindIcon = KIND_ICONS[kind] || MessageSquare;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectPreview(session.id)}
      onDoubleClick={() => onDoubleClickOpen?.()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectPreview(session.id);
        }
      }}
      className={`group relative grid grid-cols-[auto_1fr_auto] items-center gap-3 pl-3 pr-2 py-2.5 rounded-lg border cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 ${
        isSelected
          ? "bg-blue-600/25 border-blue-400/70 shadow-lg shadow-blue-900/25 ring-1 ring-blue-400/40"
          : "bg-white/[0.03] border-white/5 hover:bg-white/[0.07] hover:border-white/15"
      }`}
    >
      {isSelected && (
        <span
          className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-blue-400"
          aria-hidden
        />
      )}

      <div
        className={`shrink-0 p-1.5 rounded-md border ${
          isSelected ? "border-blue-500/50 bg-blue-500/15" : "border-white/10 bg-black/20"
        }`}
      >
        <KindIcon
          size={14}
          className={isSelected ? "text-blue-300" : "text-slate-500"}
        />
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <p
            className={`text-sm font-semibold truncate max-w-full ${
              isSelected ? "text-white" : "text-slate-200"
            }`}
          >
            {title}
          </p>
          <span
            className={`shrink-0 text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${meta.tone}`}
          >
            {meta.label}
          </span>
          {isCurrentSession && (
            <span
              className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
              title="Session chargée dans l'app"
            />
          )}
        </div>
        <p
          className={`text-[11px] truncate mt-0.5 ${
            isSelected ? "text-slate-300" : "text-slate-500"
          }`}
        >
          {previewLine}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <time
          className="text-[10px] font-mono text-slate-500 tabular-nums"
          dateTime={session.timestamp}
        >
          {formatSessionDateCompact(session)}
        </time>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenAudit(session);
            }}
            className="p-1.5 hover:bg-blue-500/20 text-slate-500 hover:text-blue-400 rounded-md"
            title="Audit"
          >
            <Activity size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteSession(session.id);
            }}
            className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-md"
            title="Supprimer"
          >
            <Trash2 size={13} />
          </button>
          <ChevronRight
            size={13}
            className={isSelected ? "text-blue-400" : "text-slate-600"}
          />
        </div>
      </div>
    </div>
  );
}
