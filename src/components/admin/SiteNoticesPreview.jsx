import React, { useMemo, useState } from "react";
import AccountDisabledView from "@/components/account/AccountDisabledView";
import {
  ACCOUNT_DISABLED_SCENARIOS,
  SITE_NOTICE_CATEGORIES,
} from "@/lib/accountDisabledScenarios";
import { deliverySummary } from "@/lib/userMessagesCatalog";
import SearchClearField from "@/components/shared/SearchClearField";
import { ChevronDown, ChevronUp, FlaskConical, ShieldOff } from "lucide-react";

const SITE_NOTICE_ITEMS = [
  {
    id: "beta-banner",
    category: "site",
    title: "Site · Beta Banner",
    audience: "All site visitors",
    when: "Beta mode is enabled (Admin → Beta)",
    tags: ["Site"],
    icon: FlaskConical,
    kind: "beta",
  },
  ...ACCOUNT_DISABLED_SCENARIOS.map((scenario) => ({
    id: `disabled-${scenario.id}`,
    category: scenario.category,
    title: scenario.title,
    audience: "Disabled account holders",
    when: `Account is disabled · scenario: ${scenario.label}`,
    tags: ["Site"],
    icon: ShieldOff,
    kind: "disabled",
    scenario,
  })),
];

const CATEGORY_ORDER = Object.fromEntries(
  SITE_NOTICE_CATEGORIES.map((c, i) => [c.id, i])
);

function ChannelTags({ tags }) {
  if (!tags?.length) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium"
        >
          {tag}
        </span>
      ))}
    </span>
  );
}

function ExpandableNoticeRow({ id, title, audience, when, tags, icon: Icon, expandedId, setExpandedId, children }) {
  const open = expandedId === id;
  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <button
        type="button"
        className="w-full text-left flex items-start gap-2"
        onClick={() => setExpandedId(open ? null : id)}
      >
        {Icon ? <Icon className="w-4 h-4 text-mint-500 shrink-0 mt-0.5" /> : null}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-medium">{title}</p>
            <ChannelTags tags={tags} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {deliverySummary({ audience, when })}
          </p>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        )}
      </button>
      {open ? (
        <div className="mt-3 pt-3 border-t border-border">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Admin → Previews → Site Notices
 */
export default function SiteNoticesPreview() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const filtered = useMemo(() => {
    let list = [...SITE_NOTICE_ITEMS];
    if (categoryFilter !== "all") {
      list = list.filter((n) => n.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((n) => {
        const hay = [
          n.title,
          n.audience,
          n.when,
          n.id,
          n.category,
          n.scenario?.label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    list.sort((a, b) => {
      const ao = CATEGORY_ORDER[a.category] ?? 99;
      const bo = CATEGORY_ORDER[b.category] ?? 99;
      if (ao !== bo) return ao - bo;
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    });
    return list;
  }, [search, categoryFilter]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Non-inbox site UI notices grouped by workflow (Site, Account). Titles use the same topic format as
        Emails and Automated Messages. Expand a row to preview how it looks for visitors.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <SearchClearField
          placeholder="Search site notices…"
          value={search}
          onValueChange={setSearch}
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
              categoryFilter === "all"
                ? "border-mint-300 bg-mint-50 text-mint-700"
                : "border-border bg-white text-muted-foreground hover:bg-mint-50 hover:border-mint-200"
            }`}
          >
            All
          </button>
          {SITE_NOTICE_CATEGORIES.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setCategoryFilter(opt.id)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                categoryFilter === opt.id
                  ? "border-mint-300 bg-mint-50 text-mint-700"
                  : "border-border bg-white text-muted-foreground hover:bg-mint-50 hover:border-mint-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          No site notices match your search or filter.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <ExpandableNoticeRow
              key={item.id}
              id={item.id}
              title={item.title}
              audience={item.audience}
              when={item.when}
              tags={item.tags}
              icon={item.icon}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
            >
              {item.kind === "beta" ? (
                <div className="rounded-xl overflow-hidden border border-border">
                  <div className="bg-orange-500 text-white text-center text-xs sm:text-sm py-2 px-4">
                    This site is in Beta mode in limited{" "}
                    <span className="underline font-semibold">locations</span>
                    .{" "}
                    <span className="underline font-semibold">Send us your feedback!</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden bg-background max-h-[28rem] overflow-y-auto">
                  <AccountDisabledView
                    user={{ id: "preview", email: "preview@example.com", full_name: "Preview User" }}
                    preview={{
                      scenarioLabel: item.scenario.label,
                      disabledNote: item.scenario.disabledNote,
                      disabledAt: item.scenario.disabledAt,
                      request: item.scenario.request,
                      senderName: "Preview User",
                      senderEmail: "preview@example.com",
                      senderPhone: "(555) 123-4567",
                    }}
                  />
                </div>
              )}
            </ExpandableNoticeRow>
          ))}
        </div>
      )}
    </div>
  );
}
