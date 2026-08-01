import React, { useMemo, useState } from "react";
import {
  AUTOMATED_NOTICE_CATALOG,
  AUTOMATED_NOTICE_CATEGORIES,
  channelsSentTags,
  deliverySummary,
} from "@/lib/userMessagesCatalog";
import { EMAIL_TEMPLATE_META, buildEmail, SAMPLE_DATA } from "@/lib/emailTemplates";
import UserNoticeCard from "@/components/account/UserNoticeCard";
import SearchClearField from "@/components/shared/SearchClearField";
import { ChevronDown, ChevronUp } from "lucide-react";

function ChannelTags({ channels }) {
  const tags = channelsSentTags(channels);
  if (!tags.length) return null;
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

function PreviewRow({ open, onToggle, title, channels, audience, when, children }) {
  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <button type="button" className="w-full text-left flex items-start gap-2" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-medium">{title}</p>
            <ChannelTags channels={channels} />
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
      {open ? <div className="mt-3 pt-3 border-t border-border">{children}</div> : null}
    </div>
  );
}

const CATEGORY_ORDER = Object.fromEntries(
  AUTOMATED_NOTICE_CATEGORIES.map((c, i) => [c.id, i])
);

/**
 * Admin → Previews → Automated Messages
 */
export function AutomatedMessagesPreview() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedKey, setExpandedKey] = useState(null);

  const filtered = useMemo(() => {
    let list = [...AUTOMATED_NOTICE_CATALOG];
    if (categoryFilter !== "all") {
      list = list.filter((n) => n.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((n) => {
        const hay = [
          n.title,
          n.subject,
          n.body,
          n.audience,
          n.when,
          n.key,
          n.category,
        ].join(" ").toLowerCase();
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
        Automated inbox notices grouped by workflow (Welcome, Flags, Reviews, Admin Removals, Billing, Saved).
        Use search or category pills to narrow the catalog. Expand a row to see exactly what users receive.
        Tags show Email and/or Message.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <SearchClearField
          placeholder="Search notices…"
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
          {AUTOMATED_NOTICE_CATEGORIES.map((opt) => (
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
          No notices match your search or filter.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const open = expandedKey === n.key;
            return (
              <PreviewRow
                key={n.key}
                open={open}
                onToggle={() => setExpandedKey(open ? null : n.key)}
                title={n.title}
                channels={n.channels}
                audience={n.audience}
                when={n.when}
              >
                <UserNoticeCard
                  subject={n.subject}
                  body={n.body}
                  unread={false}
                  actionLabel={n.actionLabel}
                  actionHref={n.actionHref}
                  preview
                  forceExpanded
                />
              </PreviewRow>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Admin → Previews → Emails
 */
export function EmailsPreviewSimplified() {
  const [expandedKey, setExpandedKey] = useState(null);

  const catalogByKey = useMemo(() => {
    const map = new Map();
    AUTOMATED_NOTICE_CATALOG.forEach((n) => map.set(n.key, n));
    return map;
  }, []);

  const items = useMemo(() => {
    return [...EMAIL_TEMPLATE_META]
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
      .map((t) => {
        const notice = catalogByKey.get(t.value);
        const channels = notice?.channels?.includes("email")
          ? notice.channels
          : ["email"];
        return {
          key: t.value,
          title: t.label,
          audience: notice?.audience || t.audience,
          when: notice?.when || t.when,
          channels,
        };
      });
  }, [catalogByKey]);

  const sampleHtml = (key) => {
    try {
      const { subject, html } = buildEmail(key, SAMPLE_DATA[key] || {});
      return { subject, html, error: null };
    } catch (err) {
      return { subject: "Preview failed", html: `<p>${err.message}</p>`, error: err.message };
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        System emails. Expand a row to preview the HTML. Tags show whether an in-app Message is also sent.
      </p>

      <div className="space-y-2">
        {items.map((item) => {
          const open = expandedKey === item.key;
          const sample = open ? sampleHtml(item.key) : null;
          return (
            <PreviewRow
              key={item.key}
              open={open}
              onToggle={() => setExpandedKey(open ? null : item.key)}
              title={item.title}
              channels={item.channels}
              audience={item.audience}
              when={item.when}
            >
              <div className="space-y-2">
                {sample?.subject ? (
                  <p className="text-xs text-muted-foreground">
                    Subject: <span className="text-foreground font-medium">{sample.subject}</span>
                  </p>
                ) : null}
                <div className="border rounded-lg p-4 bg-white overflow-x-auto">
                  <div dangerouslySetInnerHTML={{ __html: sample?.html || "" }} />
                </div>
              </div>
            </PreviewRow>
          );
        })}
      </div>
    </div>
  );
}
