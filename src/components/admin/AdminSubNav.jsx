import React from "react";

/**
 * Sub-section switcher for Admin tabs. Shows one section at a time
 * (not in-page anchor scrolling).
 * Optional `badge` on each section shows an unread/count pill.
 */
export default function AdminSubNav({ sections, value, onChange, label = "Sections" }) {
  return (
    <nav aria-label={label} className="mb-4">
      <div className="flex flex-wrap gap-1.5">
        {sections.map((section) => {
          const active = value === section.id;
          const badge = Number(section.badge) || 0;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onChange(section.id)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors inline-flex items-center ${
                active
                  ? "border-mint-300 bg-mint-50 text-mint-700"
                  : "border-border bg-white hover:bg-mint-50 hover:border-mint-200 hover:text-mint-700 text-muted-foreground"
              }`}
            >
              {section.label}
              {badge > 0 ? (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-peach-100 text-peach-500 text-[10px] font-bold leading-none">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
