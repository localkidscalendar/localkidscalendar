import React from "react";

const CATEGORY_STYLES = {
  camp: { bg: "bg-peach-50", text: "text-peach-500", label: "Camp" },
  class: { bg: "bg-mint-50", text: "text-mint-500", label: "Class" },
  event: { bg: "bg-blue-50", text: "text-blue-600", label: "Event" },
  sport: { bg: "bg-orange-50", text: "text-orange-600", label: "Sport" },
  general_interest: { bg: "bg-gray-100", text: "text-gray-600", label: "General" },
};

export default function CategoryBadge({ category, className = "" }) {
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.general_interest;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text} ${className}`}>
      {style.label}
    </span>
  );
}