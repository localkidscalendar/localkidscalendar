import React, { useState } from "react";
import AccountDisabledView from "@/components/account/AccountDisabledView";
import { ACCOUNT_DISABLED_SCENARIOS } from "@/lib/accountDisabledScenarios";
import { deliverySummary } from "@/lib/userMessagesCatalog";
import { ChevronDown, ChevronUp, FlaskConical, ShieldOff } from "lucide-react";

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
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Non-inbox site UI notices. Expand a row to preview how it looks for visitors.
      </p>

      <div className="space-y-2">
        <ExpandableNoticeRow
          id="beta-banner"
          title="Beta Mode Banner"
          audience="All site visitors"
          when="Beta mode is enabled (Admin → Beta)"
          tags={["Site"]}
          icon={FlaskConical}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
        >
          <div className="rounded-xl overflow-hidden border border-border">
            <div className="bg-orange-500 text-white text-center text-xs sm:text-sm py-2 px-4">
              This site is in Beta mode in limited{" "}
              <span className="underline font-semibold">locations</span>.
            </div>
          </div>
        </ExpandableNoticeRow>

        {ACCOUNT_DISABLED_SCENARIOS.map((scenario) => (
          <ExpandableNoticeRow
            key={scenario.id}
            id={`disabled-${scenario.id}`}
            title={`Account Disabled — ${scenario.label}`}
            audience="Disabled account holders"
            when={`Account is disabled · scenario: ${scenario.label}`}
            tags={["Site"]}
            icon={ShieldOff}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
          >
            <div className="rounded-xl border border-border overflow-hidden bg-background max-h-[28rem] overflow-y-auto">
              <AccountDisabledView
                user={{ id: "preview", email: "preview@example.com", full_name: "Preview User" }}
                preview={{
                  scenarioLabel: scenario.label,
                  disabledNote: scenario.disabledNote,
                  disabledAt: scenario.disabledAt,
                  request: scenario.request,
                  senderName: "Preview User",
                  senderEmail: "preview@example.com",
                  senderPhone: "(555) 123-4567",
                }}
              />
            </div>
          </ExpandableNoticeRow>
        ))}
      </div>
    </div>
  );
}
