import React from "react";

// Shared section header for Admin tabs: consistent title style with a green icon.
export default function AdminSectionHeader({ title, subtitle, icon: Icon, className = "" }) {
  return (
    <div className={`mb-3 flex items-center gap-2 ${className}`}>
      {Icon && <Icon className="w-5 h-5 text-mint-500 shrink-0" />}
      <div>
        <h2 className="font-heading font-bold text-lg text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}