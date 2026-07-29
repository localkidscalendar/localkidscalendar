import React, { useEffect, useRef, useState } from "react";
import moment from "moment";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ExternalLink, Trash2 } from "lucide-react";
import { toTitleCaseLabel } from "@/lib/titleCase";

/**
 * Shared one-way notice card (inbox + Admin previews).
 * Compact list row: date, subject, clamped body, optional Show more.
 * Action + Delete sit together in the header. Unread uses a highlight until opened.
 */
export default function UserNoticeCard({
  subject,
  body,
  createdAt,
  unread = false,
  actionLabel,
  actionHref,
  onDelete,
  onOpen,
  preview = false,
  forceExpanded = false,
  channelsLabel: channels,
}) {
  const bodyRef = useRef(null);
  const [expanded, setExpanded] = useState(Boolean(forceExpanded));
  const [needsExpand, setNeedsExpand] = useState(false);
  const buttonLabel = actionLabel ? toTitleCaseLabel(actionLabel) : actionLabel;

  useEffect(() => {
    setExpanded(Boolean(forceExpanded));
  }, [body, subject, forceExpanded]);

  useEffect(() => {
    if (forceExpanded) {
      setNeedsExpand(false);
      return;
    }
    const el = bodyRef.current;
    if (!el || expanded) return;
    setNeedsExpand(el.scrollHeight > el.clientHeight + 2);
  }, [body, expanded, forceExpanded]);

  const hasAction = Boolean(buttonLabel && actionHref);

  const handleOpen = () => {
    if (unread) onOpen?.();
  };

  const toggleExpand = (e) => {
    e.stopPropagation();
    handleOpen();
    setExpanded((prev) => !prev);
  };

  const rowBtn = "rounded-xl h-6 shrink-0 inline-flex items-center justify-center text-[11px] leading-none";

  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen ? handleOpen : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleOpen();
              }
            }
          : undefined
      }
      className={`rounded-xl border border-l-4 p-3 sm:p-4 transition-colors ${
        onOpen ? "cursor-pointer" : ""
      } ${
        unread
          ? "border-mint-300 border-l-mint-500 bg-mint-100"
          : "border-border border-l-transparent bg-white"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5">
                <span className="text-xs text-muted-foreground">
                  {createdAt ? moment(createdAt).format("MMM D, YYYY h:mm A") : "Sample"}
                </span>
                {channels ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                    {channels}
                  </span>
                ) : null}
                {unread ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-mint-700">
                    New
                  </span>
                ) : null}
              </div>
              <p className={`text-sm ${unread ? "font-semibold text-foreground" : "font-medium"}`}>
                {subject}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              {hasAction &&
                (preview ? (
                  <Button
                    type="button"
                    size="sm"
                    className={`${rowBtn} px-2 bg-mint-500 hover:bg-mint-600 text-white`}
                    disabled
                  >
                    <ExternalLink className="w-3 h-3 mr-0.5" />
                    {buttonLabel}
                  </Button>
                ) : (
                  <Button
                    asChild
                    size="sm"
                    className={`${rowBtn} px-2 bg-mint-500 hover:bg-mint-600 text-white`}
                  >
                    <Link to={actionHref} onClick={handleOpen}>
                      <ExternalLink className="w-3 h-3 mr-0.5" />
                      {buttonLabel}
                    </Link>
                  </Button>
                ))}
              {onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={`${rowBtn} w-6 p-0 text-destructive hover:text-destructive`}
                  onClick={onDelete}
                  title="Delete message"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              ) : null}
            </div>
          </div>

          {body ? (
            <p
              ref={bodyRef}
              className={`text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap ${
                forceExpanded || expanded ? "" : "line-clamp-3 max-h-[4.5rem] overflow-hidden"
              }`}
            >
              {body}
            </p>
          ) : null}

          {!forceExpanded && (needsExpand || expanded) ? (
            <button
              type="button"
              onClick={toggleExpand}
              className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-mint-600 hover:text-mint-700"
            >
              {expanded ? (
                <>
                  Show less <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  Show more <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
