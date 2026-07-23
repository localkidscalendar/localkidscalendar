import React from "react";

/**
 * Consistent Admin Ads content frame: white card, fixed scroll height, optional WIP note.
 * Height sized for Default/Filler Ads density so long lists scroll inside the card.
 */
export default function AdminPanelShell({ children, wipNote, className = "" }) {
  return (
    <div
      className={`bg-white border border-border rounded-2xl flex flex-col min-h-[520px] max-h-[520px] overflow-hidden ${className}`}
    >
      {wipNote && (
        <div className="shrink-0 px-4 py-2 border-b border-amber-100 bg-amber-50/80 flex items-start gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded mt-0.5">
            WIP
          </span>
          <p className="text-xs text-amber-800 leading-relaxed">{wipNote}</p>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">{children}</div>
    </div>
  );
}
