import React from "react";

// Shared section header for Admin tabs: consistent title style with a green icon.
export default function AdminSectionHeader({ title, subtitle, icon: Icon, className = "", actions = null }) {
  return (
    <div className={`mb-3 flex items-center gap-2 flex-wrap ${className}`}>
      {Icon && <Icon className="w-5 h-5 text-mint-500 shrink-0" />}
      <div className="min-w-0">
        <h2 className="font-heading font-bold text-lg text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}