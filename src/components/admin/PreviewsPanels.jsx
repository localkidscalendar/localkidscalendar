import React, { useMemo, useState } from "react";
import {
  AUTOMATED_NOTICE_CATALOG,
  channelsSentTags,
  deliverySummary,
} from "@/lib/userMessagesCatalog";
import { EMAIL_TEMPLATE_META, buildEmail, SAMPLE_DATA } from "@/lib/emailTemplates";
import UserNoticeCard from "@/components/account/UserNoticeCard";
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

/**
 * Admin → Previews → Automated Messages
 */
export function AutomatedMessagesPreview() {
  const items = useMemo(
    () =>
      [...AUTOMATED_NOTICE_CATALOG].sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
      ),
    []
  );
  const [expandedKey, setExpandedKey] = useState(null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Automated inbox notices (welcome, billing, creative review, and community-flag lifecycle). Expand a row to see exactly what users receive. Tags show Email and/or Message.
      </p>
      <div className="space-y-2">
        {items.map((n) => {
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
