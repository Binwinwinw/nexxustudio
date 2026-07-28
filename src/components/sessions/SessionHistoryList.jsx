import React from "react";
import SessionHistoryRow from "./SessionHistoryRow.jsx";

function DateGroupBlock({
  group,
  previewId,
  currentSessionId,
  onSelectPreview,
  onOpenInChat,
  onOpenAudit,
  onDeleteSession,
}) {
  return (
    <section className="space-y-1">
      <h3 className="sticky top-0 z-[5] py-1.5 px-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 bg-[#020617]/95 backdrop-blur-sm border-b border-white/5 mb-1">
        {group.label}
        <span className="ml-2 text-slate-600 font-mono">{group.sessions.length}</span>
      </h3>
      <div className="space-y-1">
        {group.sessions.map((session) => (
          <SessionHistoryRow
            key={session.id}
            session={session}
            isSelected={previewId === session.id}
            isCurrentSession={currentSessionId === session.id}
            onSelectPreview={onSelectPreview}
            onOpenAudit={onOpenAudit}
            onDeleteSession={onDeleteSession}
            onDoubleClickOpen={() => onOpenInChat(session.id)}
          />
        ))}
      </div>
    </section>
  );
}

export default function SessionHistoryList({
  isLoading,
  searchTerm,
  dateGroups,
  legacyGroups,
  useDateGroups,
  collapsedGroups,
  previewId,
  currentSessionId,
  onSelectPreview,
  onOpenInChat,
  onOpenAudit,
  onDeleteSession,
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`sk-${i}`}
            className="h-12 rounded-lg border border-white/5 bg-white/5 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const groups = useDateGroups
    ? dateGroups
    : legacyGroups.filter((g) => !g.collapsible || !collapsedGroups[g.id]);

  if (groups.length === 0 || groups.every((g) => g.sessions.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <p className="text-sm text-slate-500">
          {searchTerm ? "Aucun résultat pour cette recherche." : "Aucune session archivée."}
        </p>
        <p className="text-[10px] text-slate-600 mt-2 max-w-xs">
          Créez un nouveau projet ou lancez une conversation dans le chat.
        </p>
      </div>
    );
  }

  const blockProps = {
    previewId,
    currentSessionId,
    onSelectPreview,
    onOpenInChat,
    onOpenAudit,
    onDeleteSession,
  };

  if (useDateGroups) {
    return (
      <div className="space-y-6">
        {dateGroups.map((group) => (
          <DateGroupBlock key={group.id} group={group} {...blockProps} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {legacyGroups.map((group) => {
        if (group.collapsible && collapsedGroups[group.id]) return null;
        return <DateGroupBlock key={group.id} group={group} {...blockProps} />;
      })}
    </div>
  );
}
