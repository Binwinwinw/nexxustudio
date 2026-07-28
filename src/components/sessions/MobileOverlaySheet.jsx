import React from "react";
import { X } from "lucide-react";

/**
 * Panneau latéral / sheet mobile (filtres ou aperçu).
 */
export default function MobileOverlaySheet({
  open,
  onClose,
  title,
  children,
  side = "left",
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const slideFrom =
    side === "right"
      ? "right-0 translate-x-0"
      : "left-0 translate-x-0";

  return (
    <div className="xl:hidden fixed inset-0 z-[60] flex">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        className={`relative flex flex-col h-full w-[min(100%,320px)] max-w-full bg-[#0b1224] border-white/10 shadow-2xl ${slideFrom} ${
          side === "right" ? "border-l ml-auto" : "border-r"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "mobile-sheet-title" : undefined}
      >
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
          {title ? (
            <h2
              id="mobile-sheet-title"
              className="text-xs font-black uppercase tracking-widest text-blue-400"
            >
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400"
            aria-label="Fermer le panneau"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
