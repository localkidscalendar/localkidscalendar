import React from "react";
import { categoryLabel, normalizeCategoryValue } from "@/lib/activityCategories";

const CATEGORY_STYLES = {
  camp: { bg: "bg-peach-50", text: "text-peach-500" },
  childcare_enrichment: { bg: "bg-mint-50", text: "text-mint-600" },
  classes_lessons: { bg: "bg-blue-50", text: "text-blue-600" },
  community: { bg: "bg-amber-50", text: "text-amber-700" },
  events_experiences: { bg: "bg-violet-50", text: "text-violet-600" },
  sports_teams: { bg: "bg-orange-50", text: "text-orange-600" },
};

export default function CategoryBadge({ category, className = "" }) {
  const key = normalizeCategoryValue(category) || category;
  const style = CATEGORY_STYLES[key] || { bg: "bg-gray-100", text: "text-gray-600" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text} ${className}`}>
      {categoryLabel(category)}
    </span>
  );
}
