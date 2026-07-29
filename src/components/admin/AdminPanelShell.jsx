import React from "react";

/**
 * Consistent Admin/Account content frame: white card that grows with content.
 * Page scroll handles overflow — no fixed height or inner scroll pane.
 */
export default function AdminPanelShell({
  children,
  wipNote,
  className = "",
  contentClassName = "",
}) {
  return (
    <div className={`bg-white border border-border rounded-2xl overflow-hidden ${className}`}>
      {wipNote && (
        <div className="px-4 py-2 border-b border-amber-100 bg-amber-50/80 flex items-start gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded mt-0.5">
            WIP
          </span>
          <p className="text-xs text-amber-800 leading-relaxed">{wipNote}</p>
        </div>
      )}
      <div className={`p-4 sm:p-5 ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}
