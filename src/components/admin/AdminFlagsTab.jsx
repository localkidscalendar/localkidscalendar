import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Flag, Users } from "lucide-react";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import AdminPanelShell from "@/components/admin/AdminPanelShell";
import AdminSubNav from "@/components/admin/AdminSubNav";
import SearchClearField from "@/components/shared/SearchClearField";
import Paginator, { PAGE_SIZE } from "@/components/admin/Paginator";
import { FLAGGED_USER_ROLE_FILTERS, FLAGGING_ACTIVITY_FILTERS, ADMIN_ACTION_LABEL } from "@/components/admin/adminPageConstants";
import {
  userFlagReasonLabel,
  normalizeFlagCaseAction,
  isContentFlagCaseClosed,
  isUserFlagCaseClosed,
  getDeactivatedCaseHistory,
  getUserFlagCaseHistory,
  isFlagOpen,
  formatFlagSubmittedAt,
  formatAdminHistoryEntry,
  resolveReporterName,
  resolveDeactivatedContributor,
} from "@/components/admin/adminPageHelpers";

export default function AdminFlagsTab({ ctx }) {
  const { flagsSection, setFlagsSection, flagsSectionNav, flagSearch, setFlagSearch, flagTypeFilter, setFlagTypeFilter, flag3PlusOnly, setFlag3PlusOnly, flaggedContentPage, setFlaggedContentPage, flaggedContentCards, expandedFlagHistory, setExpandedFlagHistory, flaggedUserSearch, setFlaggedUserSearch, flaggedUserRoleFilter, setFlaggedUserRoleFilter, flaggedUsersPage, setFlaggedUsersPage, flaggedUserCards, disabledUsers, flaggingUserSearch, setFlaggingUserSearch, flaggingActivityFilter, setFlaggingActivityFilter, flaggingUsersPage, setFlaggingUsersPage, filteredFlaggingActivityRows, flaggingActivityRows, handleClearFlag, handleClearFlags, handleDeactivatedOverride, handleDeactivatedManuallyDeactivate, handleDeactivatedReviewed, handleDeactivatedMarkUnreviewed, handleReactivateFromFlag, handleClearUserFlag, handleClearUserFlags, handleUserFlagReviewed, handleUserFlagMarkUnreviewed, openReactivateUserDialog, openDisableUserDialog, openUserInUsersList, users, organizerMap } = ctx;
  return (
    <>
      <AdminSubNav
        sections={flagsSectionNav}
        value={flagsSection}
        onChange={setFlagsSection}
        label="Flags sections"
      />

      {flagsSection === "flags-flagged-content" && (
        <>
        <AdminSectionHeader title="Flagged Content (Activities, Comments, Ad Assets)" icon={Flag} />
          <AdminPanelShell>
            <div className="pb-4 mb-4 border-b border-border flex flex-col sm:flex-row gap-2 sm:items-center">
              <SearchClearField
                placeholder="Search flags…"
                value={flagSearch}
                onValueChange={(v) => { setFlagSearch(v); setFlaggedContentPage(1); }}
              />
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "all", label: "All" },
                  { id: "event", label: "Activities" },
                  { id: "comment", label: "Comments" },
                  { id: "ad", label: "Ads" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setFlagTypeFilter(opt.id); setFlaggedContentPage(1); }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                      flagTypeFilter === opt.id
                        ? "border-mint-300 bg-mint-50 text-mint-700"
                        : "border-border bg-white text-muted-foreground hover:bg-mint-50 hover:border-mint-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <span className="w-px self-stretch bg-border mx-0.5" aria-hidden />
                <button
                  type="button"
                  onClick={() => { setFlag3PlusOnly((v) => !v); setFlaggedContentPage(1); }}
                  title="Show only 3+ Deactivation cases (combinable with Activities / Comments / Ads)"
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                    flag3PlusOnly
                      ? "border-peach-300 bg-peach-50 text-peach-700"
                      : "border-border bg-white text-muted-foreground hover:bg-peach-50 hover:border-peach-200"
                  }`}
                >
                  3+
                </button>
              </div>
            </div>
            {flaggedContentCards.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                {flagSearch.trim() || flagTypeFilter !== "all" || flag3PlusOnly
                  ? "No flags match your search or filters"
                  : "No flags reported"}
              </p>
            ) : (
              <div className="space-y-2">
                {flaggedContentCards
                  .slice((flaggedContentPage - 1) * PAGE_SIZE, flaggedContentPage * PAGE_SIZE)
                  .map((card) => {
                    const item = card.moderationItem;
                    const typeLabel = item.type === "event" ? "Activity" : item.type === "comment" ? "Comment" : "Ad";
                    const hasReviewPane = item.type === "comment" || item.type === "ad";
                    const history = getDeactivatedCaseHistory(item);
                    const historyKey = `content-case-${card.key}`;
                    const historyOpen = expandedFlagHistory.has(historyKey);
                    const caseAction = card.caseAction;
                    const normalizedContentAction = normalizeFlagCaseAction(caseAction);
                    const contentCaseClosed = isContentFlagCaseClosed(caseAction);
                    const hidden = card.hidden;
                    const highlighted =
                      (hidden || card.uncleared.length > 0)
                      && !contentCaseClosed;
                    const commentText = ((item.item.content || "")
                      .replace(/\n\n\[DEMO 3+\][\s\S]*$/, "")
                      .trim());

                    return (
                      <div
                        key={card.key}
                        className={`rounded-xl border p-3 shadow-sm ${
                          highlighted
                            ? hidden
                              ? "border-violet-300 bg-violet-50/60"
                              : "border-peach-300 bg-peach-50"
                            : hidden
                              ? "border-violet-200 bg-violet-50/30"
                              : "border-border !bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            {item.type === "event" ? (
                              <Link to={`/event/${item.item.id}`} className="text-sm font-semibold text-mint-600 hover:underline block truncate">
                                {item.item.title || "Activity"}
                              </Link>
                            ) : item.type === "comment" ? (
                              item.item.event_id ? (
                                <Link
                                  to={`/event/${item.item.event_id}`}
                                  className="text-sm font-semibold text-mint-600 hover:underline block truncate"
                                >
                                  {item.eventTitle || "Activity"}
                                </Link>
                              ) : (
                                <p className="text-sm font-semibold">Comment</p>
                              )
                            ) : (
                              <p className="text-sm font-semibold truncate">
                                {item.item.ad_name || item.item.business_name || "Ad Asset"}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                item.type === "event"
                                  ? "bg-mint-100 text-mint-600"
                                  : item.type === "comment"
                                    ? "bg-amber-100 text-amber-600"
                                    : "bg-peach-100 text-peach-600"
                              }`}>
                                {typeLabel}
                              </span>
                              {card.is3Plus && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-200 text-violet-800">
                                  3+ Deactivation
                                </span>
                              )}
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  card.flagCount >= 3
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-peach-50 text-peach-500"
                                }`}
                              >
                                {card.flagCount} Flag{card.flagCount === 1 ? "" : "s"}
                              </span>
                              {hidden && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                  Auto-hidden
                                </span>
                              )}
                              {caseAction && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  caseAction === "manually_deactivated"
                                    ? "bg-red-100 text-red-600"
                                    : caseAction === "flags_cleared" || caseAction === "flag_cleared"
                                      ? "bg-gray-100 text-gray-600"
                                      : "bg-mint-100 text-mint-700"
                                }`}>
                                  {ADMIN_ACTION_LABEL[caseAction] || "Reviewed"}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-[11px] text-muted-foreground shrink-0 text-right leading-5">
                            {formatFlagSubmittedAt(card.sortAt)}
                          </p>
                        </div>

                        <div className={`grid gap-3 mb-3 ${hasReviewPane ? "lg:grid-cols-[minmax(0,1fr)_minmax(200px,280px)]" : ""}`}>
                          <div className="min-w-0 text-xs text-muted-foreground space-y-2">
                            <p>
                              <span className="font-medium text-foreground/80">
                                {item.type === "comment" ? "Comment by" : item.type === "ad" ? "Ad Asset" : "Contributor"}:
                              </span>{" "}
                              {resolveDeactivatedContributor(item, { users, organizerMap })}
                            </p>
                            <p className="font-medium text-foreground/80">Flags ({card.flags.length}):</p>
                            {card.flags.map((f) => {
                              const reportAction = f.admin_action || (f.reviewed ? "reviewed" : null);
                              const reportOpen = isFlagOpen(f);
                              const reportHighlighted = highlighted && !hidden && reportOpen;
                              return (
                                <div
                                  key={f.id}
                                  className={`rounded-lg border p-2.5 ${
                                    reportHighlighted
                                      ? "border-peach-200 bg-peach-50/40"
                                      : "border-border/70 !bg-white"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 space-y-0.5">
                                      <p>
                                        <span className="font-medium text-foreground/80">Flagged By:</span>{" "}
                                        {resolveReporterName(f, { users, organizerMap })}
                                      </p>
                                      <p>
                                        <span className="font-medium text-foreground/80">Reason:</span>{" "}
                                        <span className="capitalize">{f.reason || "—"}</span>
                                      </p>
                                      {f.details && (
                                        <p>
                                          <span className="font-medium text-foreground/80">Details:</span> {f.details}
                                        </p>
                                      )}
                                      <p className="text-[11px] text-muted-foreground">
                                        {formatFlagSubmittedAt(f.created_date || f.created_at)}
                                      </p>
                                    </div>
                                    {reportAction && (
                                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                                        reportAction === "flag_cleared"
                                          ? "bg-gray-100 text-gray-600"
                                          : reportAction === "manually_deactivated"
                                            ? "bg-red-100 text-red-600"
                                            : "bg-mint-100 text-mint-700"
                                      }`}>
                                        {ADMIN_ACTION_LABEL[reportAction] || "Reviewed"}
                                      </span>
                                    )}
                                  </div>
                                  {reportOpen && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="rounded-lg text-xs h-7 text-gray-600 border-gray-200"
                                        onClick={() => handleClearFlag(f.id)}
                                      >
                                        Clear Flag
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {history.length > 0 && (
                              <div className="pt-1">
                                <button
                                  type="button"
                                  className="text-xs font-medium text-mint-600 hover:underline"
                                  onClick={() => {
                                    setExpandedFlagHistory((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(historyKey)) next.delete(historyKey);
                                      else next.add(historyKey);
                                      return next;
                                    });
                                  }}
                                >
                                  {historyOpen ? "Hide Admin History" : `Admin History (${history.length})`}
                                </button>
                                {historyOpen && (
                                  <div className="mt-1 space-y-0.5 pl-0.5">
                                    {history.map((histEntry, idx) => (
                                      <p key={`${historyKey}-hist-${idx}`}>
                                        • {formatAdminHistoryEntry(histEntry)}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {item.type === "comment" && (
                            <div className="rounded-lg border border-border/70 bg-white/80 p-2.5 min-w-0">
                              <p className="text-[11px] font-medium text-foreground/70 mb-1">Comment</p>
                              <p className="text-xs text-foreground whitespace-pre-wrap break-words max-h-36 overflow-y-auto">
                                {commentText || "—"}
                              </p>
                            </div>
                          )}

                          {item.type === "ad" && (
                            <div className="rounded-lg border border-border/70 bg-white/80 p-2.5 min-w-0 space-y-2">
                              <p className="text-[11px] font-medium text-foreground/70">Ad Creative</p>
                              {item.item.image_url ? (
                                <a
                                  href={item.item.image_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="View full size"
                                  className="shrink-0 w-20 aspect-[2/1] rounded-lg border border-border bg-muted/30 overflow-hidden flex items-center justify-center hover:ring-2 hover:ring-mint-300 transition"
                                >
                                  <img
                                    src={item.item.image_url}
                                    alt={item.item.ad_name || item.item.business_name || "Ad creative"}
                                    className="max-w-full max-h-full object-contain"
                                  />
                                </a>
                              ) : (
                                <div className="shrink-0 w-20 aspect-[2/1] rounded-lg border border-dashed border-border bg-muted/20" />
                              )}
                              {item.item.link_url ? (
                                <p className="text-[11px] break-all">
                                  <span className="font-medium text-foreground/80">URL:</span>{" "}
                                  <a
                                    href={item.item.link_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-mint-600 hover:underline"
                                  >
                                    {item.item.link_url}
                                  </a>
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">No URL</p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {caseAction === "manually_deactivated" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg text-xs h-7 text-mint-600 border-mint-200"
                              onClick={() =>
                                handleReactivateFromFlag(null, item.item.id, item.type === "event" ? "event" : item.type === "comment" ? "comment" : "ad", item)
                              }
                            >
                              Reactivate
                            </Button>
                          ) : caseAction === "reviewed" || caseAction === "flags_cleared" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg text-xs h-7 text-mint-600 border-mint-200"
                              onClick={() => handleDeactivatedMarkUnreviewed(item)}
                            >
                              Mark Unreviewed
                            </Button>
                          ) : (
                            <>
                              {card.uncleared.length > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs h-7 text-gray-600 border-gray-200"
                                  onClick={() => handleClearFlags(item)}
                                >
                                  Clear Flags
                                </Button>
                              )}
                              {hidden ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs h-7 text-mint-600 border-mint-200"
                                  onClick={() => handleDeactivatedOverride(item)}
                                >
                                  Override 3+
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs h-7 text-destructive border-destructive/20"
                                  onClick={() => handleDeactivatedManuallyDeactivate(item)}
                                >
                                  Manually Deactivate
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg text-xs h-7 text-mint-600 border-mint-200"
                                onClick={() => handleDeactivatedReviewed(item)}
                              >
                                Reviewed
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                {flaggedContentCards.length > PAGE_SIZE && (
                  <Paginator total={flaggedContentCards.length} page={flaggedContentPage} onPage={setFlaggedContentPage} />
                )}
              </div>
            )}
          </AdminPanelShell>
        </>
      )}

      {flagsSection === "flags-flagged-users" && (
        <>
          <AdminSectionHeader title="Flagged Users" icon={Users} />
          <AdminPanelShell>
            <div className="pb-4 mb-4 border-b border-border flex flex-col sm:flex-row gap-2 sm:items-center">
              <SearchClearField
                placeholder="Search flagged users…"
                value={flaggedUserSearch}
                onValueChange={(v) => { setFlaggedUserSearch(v); setFlaggedUsersPage(1); }}
              />
              <div className="flex flex-wrap gap-1.5">
                {FLAGGED_USER_ROLE_FILTERS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setFlaggedUserRoleFilter(opt.id); setFlaggedUsersPage(1); }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                      flaggedUserRoleFilter === opt.id
                        ? opt.id === "3plus"
                          ? "border-peach-300 bg-peach-50 text-peach-700"
                          : "border-mint-300 bg-mint-50 text-mint-700"
                        : "border-border bg-white text-muted-foreground hover:bg-mint-50 hover:border-mint-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {flaggedUserCards.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                {flaggedUserSearch.trim() || flaggedUserRoleFilter !== "all"
                  ? "No flagged users match your search or filters"
                  : "No users flagged"}
              </p>
            ) : (
              <div className="space-y-2">
                {flaggedUserCards
                  .slice((flaggedUsersPage - 1) * PAGE_SIZE, flaggedUsersPage * PAGE_SIZE)
                  .map((card) => {
                    const isDisabled = card.role === "disabled" || disabledUsers.has(card.userId);
                    const needsReview = card.suspended || card.flagCount >= 3 || card.uncleared.length >= 3;
                    const caseAction = card.caseAction;
                    // Normalize in case a legacy value used display casing ("Reviewed")
                    const normalizedAction = normalizeFlagCaseAction(caseAction);
                    const caseClosed = isUserFlagCaseClosed(caseAction);
                    const history = getUserFlagCaseHistory(card.profile);
                    const historyKey = `user-case-${card.userId}`;
                    const historyOpen = expandedFlagHistory.has(historyKey);
                    const roleLabel =
                      card.role === "organizer"
                        ? "Organizer"
                        : card.role === "admin"
                          ? "Admin"
                          : card.role === "disabled"
                            ? "Disabled"
                            : "Community Member";
                    // Peach only while open — Messages-style addressed = white
                    const highlighted =
                      !isDisabled
                      && !caseClosed
                      && (card.suspended || card.uncleared.length > 0);

                    return (
                      <div
                        key={card.userId}
                        style={{ backgroundColor: highlighted ? "#FCEBDD" : "#FFFFFF" }}
                        className={`rounded-xl border p-3 shadow-sm ${
                          highlighted ? "border-peach-300" : "border-border"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{card.displayName}</p>
                            {card.email ? (
                              <p className="text-xs text-muted-foreground truncate">{card.email}</p>
                            ) : null}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted capitalize">
                                {roleLabel}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  caseClosed
                                    ? "bg-gray-100 text-gray-600"
                                    : card.flagCount >= 3
                                      ? "bg-destructive/10 text-destructive"
                                      : "bg-peach-50 text-peach-500"
                                }`}
                              >
                                {card.flagCount} Flag{card.flagCount === 1 ? "" : "s"}
                              </span>
                              {card.suspended && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                  Suspended
                                </span>
                              )}
                              {isDisabled && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                                  Disabled
                                </span>
                              )}
                              {caseAction && normalizedAction === "manually_reinstated" ? (
                                <>
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                    Manually Deactivated
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-mint-100 text-mint-700">
                                    Manually Reinstated
                                  </span>
                                </>
                              ) : caseAction ? (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  normalizedAction === "flags_cleared"
                                    ? "bg-gray-100 text-gray-600"
                                    : normalizedAction === "manually_deactivated"
                                      ? "bg-red-100 text-red-600"
                                      : "bg-mint-100 text-mint-700"
                                }`}>
                                  {ADMIN_ACTION_LABEL[normalizedAction] || ADMIN_ACTION_LABEL[caseAction] || "Reviewed"}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <p className="text-[11px] text-muted-foreground shrink-0 text-right leading-5">
                            {formatFlagSubmittedAt(card.sortAt)}
                          </p>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-2 mb-3">
                          <p className="font-medium text-foreground/80">Flags ({card.flags.length}):</p>
                          {card.flags.map((f) => {
                            const reportAction = f.admin_action || (f.reviewed ? "reviewed" : null);
                            const reportOpen = isFlagOpen(f);
                            const reportHighlighted = highlighted && reportOpen;
                            return (
                              <div
                                key={f.id}
                                style={{ backgroundColor: reportHighlighted ? "#FDF3EB" : "#FFFFFF" }}
                                className={`rounded-lg border p-2.5 ${
                                  reportHighlighted ? "border-peach-200" : "border-border/70"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 space-y-0.5">
                                    <p>
                                      <span className="font-medium text-foreground/80">Flagged By:</span>{" "}
                                      {resolveReporterName(f, { users, organizerMap })}
                                    </p>
                                    <p>
                                      <span className="font-medium text-foreground/80">Reason:</span>{" "}
                                      {userFlagReasonLabel(f.reason)}
                                    </p>
                                    {f.details && (
                                      <p>
                                        <span className="font-medium text-foreground/80">Details:</span> {f.details}
                                      </p>
                                    )}
                                    <p className="text-[11px] text-muted-foreground">
                                      {formatFlagSubmittedAt(f.created_date || f.created_at)}
                                    </p>
                                  </div>
                                  {reportAction && (
                                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                                      reportAction === "flag_cleared"
                                        ? "bg-gray-100 text-gray-600"
                                        : "bg-mint-100 text-mint-700"
                                    }`}>
                                      {ADMIN_ACTION_LABEL[reportAction] || "Reviewed"}
                                    </span>
                                  )}
                                </div>
                                {reportOpen && !isDisabled && (
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded-lg text-xs h-7 text-gray-600 border-gray-200"
                                      onClick={() => handleClearUserFlag(f.id)}
                                    >
                                      Clear Flag
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {history.length > 0 && (
                            <div className="pt-1">
                              <button
                                type="button"
                                className="text-xs font-medium text-mint-600 hover:underline"
                                onClick={() => {
                                  setExpandedFlagHistory((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(historyKey)) next.delete(historyKey);
                                    else next.add(historyKey);
                                    return next;
                                  });
                                }}
                              >
                                {historyOpen ? "Hide Admin History" : `Admin History (${history.length})`}
                              </button>
                              {historyOpen && (
                                <div className="mt-1 space-y-0.5 pl-0.5">
                                  {history.map((histEntry, idx) => (
                                    <p key={`${historyKey}-hist-${idx}`}>
                                      • {formatAdminHistoryEntry(histEntry)}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {isDisabled ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg text-xs h-7 text-mint-500 border-mint-200"
                              onClick={() => openReactivateUserDialog(card.userId, { userName: card.displayName })}
                            >
                              Reactivate User
                            </Button>
                          ) : caseClosed && (
                            normalizedAction === "reviewed"
                            || normalizedAction === "flags_cleared"
                            || normalizedAction === "manually_reinstated"
                          ) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg text-xs h-7 text-mint-600 border-mint-200"
                              onClick={() => handleUserFlagMarkUnreviewed(card)}
                            >
                              Mark Unreviewed
                            </Button>
                          ) : (
                            <>
                              {needsReview && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg text-xs h-7 text-gray-600 border-gray-200"
                                    onClick={() => handleClearUserFlags(card)}
                                  >
                                    Clear Flags
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg text-xs h-7 text-destructive border-destructive/20"
                                    onClick={() =>
                                      openDisableUserDialog(
                                        card.userId,
                                        card.displayName,
                                        card.profile?.is_advertiser,
                                        "flagged_users"
                                      )
                                    }
                                  >
                                    Manual Disable
                                  </Button>
                                </>
                              )}
                              {card.uncleared.length > 0 && !needsReview && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs h-7 text-gray-600 border-gray-200"
                                  onClick={() => handleClearUserFlags(card)}
                                >
                                  Clear Flags
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg text-xs h-7 text-mint-600 border-mint-200"
                                onClick={() => handleUserFlagReviewed(card)}
                              >
                                Reviewed
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                {flaggedUserCards.length > PAGE_SIZE && (
                  <Paginator total={flaggedUserCards.length} page={flaggedUsersPage} onPage={setFlaggedUsersPage} />
                )}
              </div>
            )}
          </AdminPanelShell>
        </>
      )}

      {flagsSection === "flags-users-flagging" && (
        <>
          <AdminSectionHeader title="Top Flagging Activity Ranking" icon={Users} />
          <AdminPanelShell>
            <div className="pb-4 mb-4 border-b border-border flex flex-col sm:flex-row gap-2 sm:items-center">
              <SearchClearField
                placeholder="Search users…"
                value={flaggingUserSearch}
                onValueChange={(v) => { setFlaggingUserSearch(v); setFlaggingUsersPage(1); }}
              />
              <div className="flex flex-wrap gap-1.5">
                {FLAGGING_ACTIVITY_FILTERS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setFlaggingActivityFilter(opt.id); setFlaggingUsersPage(1); }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                      flaggingActivityFilter === opt.id
                        ? "border-mint-300 bg-mint-50 text-mint-700"
                        : "border-border bg-white text-muted-foreground hover:bg-mint-50 hover:border-mint-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {filteredFlaggingActivityRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                {flaggingActivityRows.length === 0
                  ? "No flagging activity yet"
                  : "No users match your search or filter"}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredFlaggingActivityRows
                  .slice((flaggingUsersPage - 1) * PAGE_SIZE, flaggingUsersPage * PAGE_SIZE)
                  .map((row) => {
                    const isFlagging = row.kind === "flagging";
                    return (
                      <div
                        key={row.key}
                        className={`rounded-xl border p-3 shadow-sm ${
                          isFlagging
                            ? "border-border bg-white"
                            : "border-peach-200 bg-peach-50/30"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                          <div className="min-w-0 space-y-1">
                            {row.email ? (
                              <button
                                type="button"
                                className="text-sm font-semibold text-mint-600 hover:underline truncate text-left max-w-full"
                                onClick={() => openUserInUsersList(row.email)}
                                title={`Open in List of Users (${row.email})`}
                              >
                                {row.name || "Unknown"}
                              </button>
                            ) : (
                              <p className="text-sm font-semibold truncate">{row.name || "Unknown"}</p>
                            )}
                            {row.email ? (
                              <p className="text-xs text-muted-foreground truncate">{row.email}</p>
                            ) : null}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  isFlagging
                                    ? "bg-mint-100 text-mint-700"
                                    : "bg-peach-100 text-peach-600"
                                }`}
                              >
                                {isFlagging ? "Flagging" : "Being Flagged"}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted tabular-nums">
                                {row.count} Flag{row.count === 1 ? "" : "s"}
                              </span>
                              {row.isDisabled && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                                  Disabled
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {filteredFlaggingActivityRows.length > PAGE_SIZE && (
                  <Paginator
                    total={filteredFlaggingActivityRows.length}
                    page={flaggingUsersPage}
                    onPage={setFlaggingUsersPage}
                  />
                )}
              </div>
            )}
          </AdminPanelShell>
        </>
      )}
    </>
  );
}
