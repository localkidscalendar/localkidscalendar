import React from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import { supabase } from "@/lib/supabaseClient";
import { formatPhoneDisplay } from "@/lib/phone";
import { restoreRoleFromProfile } from "@/lib/authRoles";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown, ChevronUp, ExternalLink, Eye, Image, Link2, MapPin, MessageSquare, MoreHorizontal, Users,
} from "lucide-react";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import AdminPanelShell from "@/components/admin/AdminPanelShell";
import AdminSubNav from "@/components/admin/AdminSubNav";
import AdminUserZipReportsSection from "@/components/admin/AdminUserZipReportsSection";
import SearchClearField from "@/components/shared/SearchClearField";
import Paginator, { PAGE_SIZE } from "@/components/admin/Paginator";
import { USER_LIST_FILTERS, ADMIN_ACTION_LABEL } from "@/components/admin/adminPageConstants";
import {
  userFlagReasonLabel,
  contentFlagReasonLabel,
  formatFlagSubmittedAt,
  formatMessageSubmittedAt,
  formatAdminHistoryEntry,
  describeDisableSource,
  resolveReporterName,
  resolveAdminDisplayName,
  getUserFlagCaseHistory,
  isFlagOpen,
  flagsFiledByUserIncludingUsers,
  flagsReceivedByUser,
  flagsOnTarget,
  groupFlagsByTarget,
  formatAdZipLabel,
} from "@/components/admin/adminPageHelpers";
import { notifyBecameSupporter } from "@/lib/userMessages";

export default function AdminUsersTab({ ctx }) {
  const { userSectionNav, usersSection, setUsersSection, userSearch, setUserSearch, setUserSearchExactEmail, userListFilter, setUserListFilter, usersPage, setUsersPage, filteredAndSortedUsers, users, disabledUsers, organizerMap, userContentById, userContentPanelById, toggleUserContentPanel, expandedUserComments, setExpandedUserComments, expandedItemFlags, toggleItemFlagsExpand, flaggingStatsByUserId, flags, flagsFiledByUserIncludingUsers, flagsReceivedByUser, flagsOnTarget, groupFlagsByTarget, eventMap, events, setUserContentPreviewUrl, setUsers, toast, openDisableUserDialog, openReactivateUserDialog, reactivationSearch, setReactivationSearch, reactivationStatusFilter, setReactivationStatusFilter, reactivationPage, setReactivationPage, filteredReactivationRequests, reactivationRequests, expandedReactivationContext, setExpandedReactivationContext, setDeclineDialog } = ctx;
  return (
    <>
      <AdminSubNav
        sections={userSectionNav}
        value={usersSection}
        onChange={setUsersSection}
        label="Users sections"
      />

      {usersSection === "users-zip-reports" && (
        <>
          <AdminSectionHeader title="User Zip Code Reports" icon={MapPin} />
          <AdminUserZipReportsSection />
        </>
      )}

      {usersSection === "users-list" && (
        <>
          <AdminSectionHeader title="List of Users" icon={Users} />
          <AdminPanelShell>
            <div className="pb-4 mb-4 border-b border-border flex flex-col sm:flex-row gap-2 sm:items-center">
              <SearchClearField
                placeholder="Search users by name, email, or zip..."
                value={userSearch}
                onValueChange={(v) => {
                  setUserSearch(v);
                  setUserSearchExactEmail(false);
                  setUsersPage(1);
                }}
              />
              <div className="flex flex-wrap gap-1.5">
                {USER_LIST_FILTERS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setUserListFilter(opt.id); setUsersPage(1); }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                      userListFilter === opt.id
                        ? "border-mint-300 bg-mint-50 text-mint-700"
                        : "border-border bg-white text-muted-foreground hover:bg-mint-50 hover:border-mint-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {filteredAndSortedUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                {users.length === 0 ? "No users yet" : "No users match your search or filter"}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredAndSortedUsers
                  .slice((usersPage - 1) * PAGE_SIZE, usersPage * PAGE_SIZE)
                  .map((u) => {
                    const isDisabled = u.role === "disabled" || disabledUsers.has(u.id);
                    const isSuspended = Boolean(u.suspended_at) && u.role !== "disabled" && !isDisabled;
                    const displayName = organizerMap[u.id]
                      ? organizerMap[u.id]
                      : (u.first_name || u.last_name)
                        ? `${u.first_name || ""} ${u.last_name || ""}`.trim()
                        : (u.full_name && !u.full_name.includes("@")) ? u.full_name : "—";
                    const roleLabel =
                      u.role === "community_member" ? "Community Member"
                        : u.role === "organizer" ? "Organizer"
                          : u.role === "admin" ? "Admin"
                            : u.role === "disabled" ? "Disabled"
                              : "Needs Setup";
                    const content = userContentById[u.id] || {
                      events: [],
                      comments: [],
                      ads: [],
                      activityFlagTotal: 0,
                      commentFlagTotal: 0,
                      adFlagTotal: 0,
                      userFlagCount: Number(u.user_flag_count || 0),
                      hasContent: false,
                    };
                    const flagging = flaggingStatsByUserId[u.id] || {
                      activities: 0, comments: 0, ads: 0, users: 0, total: 0,
                    };
                    const contentPanel = userContentPanelById[u.id] || null;
                    const contribOpen =
                      contentPanel === "contribActivities"
                      || contentPanel === "contribComments"
                      || contentPanel === "contribAds";
                    const flaggedOpen =
                      contentPanel === "userFlags"
                      || contentPanel === "activityFlags"
                      || contentPanel === "commentFlags"
                      || contentPanel === "adAssetFlags";
                    const flaggingPanelType =
                      contentPanel === "flaggingActivities" ? "event"
                        : contentPanel === "flaggingComments" ? "comment"
                          : contentPanel === "flaggingAds" ? "ad"
                            : contentPanel === "flaggingUsers" ? "user"
                              : null;
                    const flaggingOpen = Boolean(flaggingPanelType);
                    const filedFlags = flaggingOpen
                      ? flagsFiledByUserIncludingUsers(flags, u.id).filter((f) => f.target_type === flaggingPanelType)
                      : [];
                    const receivedUserFlags = contentPanel === "userFlags" ? flagsReceivedByUser(flags, u.id) : [];
                    const flaggedEvents = content.events.filter((e) => Number(e.flag_count || 0) > 0);
                    const flaggedComments = content.comments.filter((c) => Number(c.flag_count || 0) > 0);
                    const flaggedAds = content.ads.filter((a) => Number(a.flag_count || 0) > 0);

                    const renderCountLink = (count, panel) => {
                      if (count <= 0) {
                        return <span className="tabular-nums">0</span>;
                      }
                      const open = contentPanel === panel;
                      return (
                        <button
                          type="button"
                          className={`tabular-nums font-medium hover:underline ${
                            open ? "text-mint-700" : "text-mint-600"
                          }`}
                          onClick={() => toggleUserContentPanel(u.id, panel)}
                        >
                          {count}
                        </button>
                      );
                    };

                    const renderHideSection = () => (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          className="text-[11px] text-mint-600 hover:underline"
                          onClick={() => toggleUserContentPanel(u.id, contentPanel)}
                        >
                          Hide
                        </button>
                      </div>
                    );

                    const renderNestedFlagDetails = (key, detailFlags) => {
                      if (!expandedItemFlags.has(key)) return null;
                      if (!detailFlags.length) {
                        return <p className="mt-1.5 text-[11px] text-muted-foreground pl-2">No flag details found.</p>;
                      }
                      return (
                        <ul className="mt-1.5 ml-1 space-y-1.5 border-l border-border/70 pl-2.5">
                          {detailFlags.map((f) => (
                            <li key={f.id} className="text-xs text-muted-foreground space-y-0.5">
                              <p>
                                <span className="font-medium text-foreground/80">Flagged By:</span>{" "}
                                {resolveReporterName(f, { users, organizerMap })}
                              </p>
                              <p>
                                <span className="font-medium text-foreground/80">Reason:</span>{" "}
                                {f.target_type === "user"
                                  ? userFlagReasonLabel(f.reason)
                                  : contentFlagReasonLabel(f.reason)}
                              </p>
                              {f.details ? (
                                <p>
                                  <span className="font-medium text-foreground/80">Comments:</span> {f.details}
                                </p>
                              ) : null}
                              <p className="text-[11px] text-muted-foreground">
                                {formatFlagSubmittedAt(f.created_date || f.created_at)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      );
                    };

                    const renderFlagsCountControl = (count, key, detailFlags, clickable) => {
                      const n = Number(count || 0);
                      if (!clickable || n <= 0) {
                        return (
                          <span className="text-xs text-muted-foreground shrink-0 tabular-nums pt-0.5">
                            {n} Flags
                          </span>
                        );
                      }
                      const open = expandedItemFlags.has(key);
                      return (
                        <button
                          type="button"
                          className={`text-xs shrink-0 tabular-nums pt-0.5 font-medium hover:underline ${
                            open ? "text-mint-700" : "text-mint-600"
                          }`}
                          onClick={() => toggleItemFlagsExpand(key)}
                        >
                          {n} Flags
                        </button>
                      );
                    };

                    const zipParen = (zip) => (zip ? ` (${zip})` : "");
                    const adZipParen = (item) => {
                      const label = formatAdZipLabel(item);
                      return label ? ` (${label})` : "";
                    };

                    return (
                      <div
                        key={u.id}
                        className={`rounded-xl border p-3 shadow-sm ${
                          isDisabled
                            ? "border-red-200 bg-red-50/30"
                            : isSuspended
                              ? "border-amber-200 bg-amber-50/30"
                              : "border-border bg-white"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <p className="text-sm font-semibold truncate">{displayName}</p>
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted">
                                {roleLabel}
                              </span>
                              {isSuspended && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                  Suspended
                                </span>
                              )}
                              {u.is_advertiser && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted">
                                  Supporter
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {[u.email, u.zip_code || null, moment(u.created_date).format("MMM D, YYYY")]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <div className="text-xs text-muted-foreground space-y-0.5 pt-0.5">
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span className="font-medium text-foreground/80">Contributions:</span>
                                <span>Activities: {renderCountLink(content.events.length, "contribActivities")}</span>
                                <span>·</span>
                                <span>Comments: {renderCountLink(content.comments.length, "contribComments")}</span>
                                <span>·</span>
                                <span>Ads: {renderCountLink(content.ads.length, "contribAds")}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span className="font-medium text-foreground/80">Flagged:</span>
                                <span>User: {renderCountLink(content.userFlagCount, "userFlags")}</span>
                                <span>·</span>
                                <span>Activity: {renderCountLink(content.activityFlagTotal, "activityFlags")}</span>
                                <span>·</span>
                                <span>Comment: {renderCountLink(content.commentFlagTotal, "commentFlags")}</span>
                                <span>·</span>
                                <span>Ad Asset: {renderCountLink(content.adFlagTotal, "adAssetFlags")}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span className="font-medium text-foreground/80">Flags Filed:</span>
                                <span>Activities: {renderCountLink(flagging.activities, "flaggingActivities")}</span>
                                <span>·</span>
                                <span>Comments: {renderCountLink(flagging.comments, "flaggingComments")}</span>
                                <span>·</span>
                                <span>Ads: {renderCountLink(flagging.ads, "flaggingAds")}</span>
                                <span>·</span>
                                <span>Users: {renderCountLink(flagging.users, "flaggingUsers")}</span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 self-start">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" className="rounded-lg text-xs h-7 gap-1">
                                  Actions
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                <DropdownMenuItem
                                  onClick={async () => {
                                    const next = !u.is_advertiser;
                                    const { error } = await supabase.from("profiles").update({
                                      is_advertiser: next,
                                      updated_at: new Date().toISOString(),
                                    }).eq("id", u.id);
                                    if (error) {
                                      toast({ title: "Failed to update supporter", description: error.message, variant: "destructive" });
                                      return;
                                    }
                                    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_advertiser: next } : x)));
                                    if (next) await notifyBecameSupporter(u.id);
                                    toast({ title: next ? "Supporter role granted" : "Supporter role removed" });
                                  }}
                                >
                                  {u.is_advertiser ? "Remove Supporter" : "Grant Supporter"}
                                </DropdownMenuItem>
                                {u.role !== "admin" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className={isDisabled ? "text-mint-700" : "text-destructive"}
                                      onClick={() =>
                                        isDisabled
                                          ? openReactivateUserDialog(u.id, { userName: displayName })
                                          : openDisableUserDialog(u.id, displayName, u.is_advertiser, "users_list")
                                      }
                                    >
                                      {isDisabled ? "Reactivate User" : "Disable User"}
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {(contribOpen || flaggedOpen) && (
                          <div className="mt-3 space-y-3 border-t border-border/70 pt-3 pl-4 sm:pl-6">
                            {contentPanel === "userFlags" && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                                  User Flags Received
                                </p>
                                {receivedUserFlags.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">No user flags found for this account.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {receivedUserFlags.map((f) => {
                                      const reportAction = f.admin_action || (f.reviewed ? "reviewed" : null);
                                      return (
                                        <div
                                          key={f.id}
                                          className={`rounded-lg border p-2.5 ${
                                            isFlagOpen(f)
                                              ? "border-peach-200 bg-peach-50/40"
                                              : "border-border/70 bg-white/80"
                                          }`}
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 space-y-0.5 text-sm">
                                              <p>
                                                <span className="font-medium text-foreground/80">Flagged By:</span>{" "}
                                                {resolveReporterName(f, { users, organizerMap })}
                                              </p>
                                              <p>
                                                <span className="font-medium text-foreground/80">Category:</span>{" "}
                                                {userFlagReasonLabel(f.reason)}
                                              </p>
                                              {f.details && (
                                                <p>
                                                  <span className="font-medium text-foreground/80">Comments:</span>{" "}
                                                  {f.details}
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
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                {renderHideSection()}
                              </div>
                            )}

                            {(contentPanel === "contribActivities" || contentPanel === "activityFlags") && (
                              (contentPanel === "activityFlags" ? flaggedEvents : content.events).length > 0 ? (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                                    {contentPanel === "activityFlags" ? "Flagged Activities" : "Activities"}
                                  </p>
                                  <ul className="space-y-1.5">
                                    {(contentPanel === "activityFlags" ? flaggedEvents : content.events).map((e) => {
                                      const flagsClickable = contentPanel === "activityFlags";
                                      const flagKey = `flagged:event:${e.id}`;
                                      const detailFlags = flagsClickable ? flagsOnTarget(flags, "event", e.id) : [];
                                      const flagCount = Number(e.flag_count || 0);
                                      return (
                                        <li key={e.id} className="text-sm min-w-0">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <div className="truncate flex-1 min-w-0">
                                              <Link
                                                to={`/event/${e.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-mint-600 hover:underline font-medium"
                                                title={e.title}
                                              >
                                                {e.title || "Untitled"}
                                              </Link>
                                              <span className="text-muted-foreground">{zipParen(e.zip_code)}</span>
                                            </div>
                                            {renderFlagsCountControl(flagCount, flagKey, detailFlags, flagsClickable)}
                                          </div>
                                          {flagsClickable ? renderNestedFlagDetails(flagKey, detailFlags) : null}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                  {renderHideSection()}
                                </div>
                              ) : contentPanel === "activityFlags" ? (
                                <div>
                                  <p className="text-xs text-muted-foreground">No flagged activities.</p>
                                  {renderHideSection()}
                                </div>
                              ) : null
                            )}

                            {(contentPanel === "contribComments" || contentPanel === "commentFlags") && (
                              (contentPanel === "commentFlags" ? flaggedComments : content.comments).length > 0 ? (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                                    {contentPanel === "commentFlags" ? "Flagged Comments" : "Comments"}
                                  </p>
                                  <ul className="space-y-1.5">
                                    {(contentPanel === "commentFlags" ? flaggedComments : content.comments).map((c) => {
                                      const text = (c.content || "").trim() || "(empty)";
                                      const long = text.length > 100;
                                      const open = expandedUserComments.has(c.id);
                                      const flagsClickable = contentPanel === "commentFlags";
                                      const flagKey = `flagged:comment:${c.id}`;
                                      const detailFlags = flagsClickable ? flagsOnTarget(flags, "comment", c.id) : [];
                                      const flagCount = Number(c.flag_count || 0);
                                      return (
                                        <li key={c.id} className="text-sm min-w-0">
                                          <div className="flex items-start gap-2 min-w-0">
                                            <div className="flex-1 min-w-0">
                                              <p className={open ? "whitespace-pre-wrap break-words" : "truncate"}>
                                                {open || !long ? text : `${text.slice(0, 100)}…`}
                                              </p>
                                              {long && (
                                                <button
                                                  type="button"
                                                  className="text-[11px] text-mint-600 hover:underline mt-0.5"
                                                  onClick={() => {
                                                    setExpandedUserComments((prev) => {
                                                      const next = new Set(prev);
                                                      if (next.has(c.id)) next.delete(c.id);
                                                      else next.add(c.id);
                                                      return next;
                                                    });
                                                  }}
                                                >
                                                  {open ? "Show less" : "Show full"}
                                                </button>
                                              )}
                                            </div>
                                            {renderFlagsCountControl(flagCount, flagKey, detailFlags, flagsClickable)}
                                            {c.event_id ? (
                                              <Link
                                                to={`/event/${c.event_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="shrink-0 p-1 rounded-md hover:bg-mint-50 text-mint-600"
                                                title="View activity"
                                              >
                                                <Eye className="w-3.5 h-3.5" />
                                              </Link>
                                            ) : (
                                              <span className="shrink-0 p-1 text-muted-foreground/40" title="No activity link">
                                                <Eye className="w-3.5 h-3.5" />
                                              </span>
                                            )}
                                          </div>
                                          {flagsClickable ? renderNestedFlagDetails(flagKey, detailFlags) : null}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                  {renderHideSection()}
                                </div>
                              ) : contentPanel === "commentFlags" ? (
                                <div>
                                  <p className="text-xs text-muted-foreground">No flagged comments.</p>
                                  {renderHideSection()}
                                </div>
                              ) : null
                            )}

                            {(contentPanel === "contribAds" || contentPanel === "adAssetFlags") && (
                              (contentPanel === "adAssetFlags" ? flaggedAds : content.ads).length > 0 ? (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                                    {contentPanel === "adAssetFlags" ? "Flagged Ad Assets" : "Ad Assets"}
                                  </p>
                                  <ul className="space-y-1.5">
                                    {(contentPanel === "adAssetFlags" ? flaggedAds : content.ads).map((a) => {
                                      const flagsClickable = contentPanel === "adAssetFlags";
                                      const flagKey = `flagged:ad:${a.id}`;
                                      const detailFlags = flagsClickable ? flagsOnTarget(flags, "ad", a.id) : [];
                                      const flagCount = Number(a.flag_count || 0);
                                      return (
                                        <li key={a.id} className="text-sm min-w-0">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <div className="truncate flex-1 min-w-0" title={a.ad_name}>
                                              <span className="font-medium">{a.ad_name || "Untitled creative"}</span>
                                              <span className="text-muted-foreground">{adZipParen(a)}</span>
                                            </div>
                                            {renderFlagsCountControl(flagCount, flagKey, detailFlags, flagsClickable)}
                                            {a.link_url ? (
                                              <a
                                                href={a.link_url.startsWith("http") ? a.link_url : `https://${a.link_url}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="shrink-0 p-1 rounded-md hover:bg-mint-50 text-mint-600"
                                                title="Open ad link"
                                              >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                              </a>
                                            ) : (
                                              <span className="shrink-0 p-1 text-muted-foreground/40" title="No link">
                                                <Link2 className="w-3.5 h-3.5" />
                                              </span>
                                            )}
                                            {a.image_url ? (
                                              <button
                                                type="button"
                                                className="shrink-0 p-1 rounded-md hover:bg-mint-50 text-mint-600"
                                                title="View ad image"
                                                onClick={() => setUserContentPreviewUrl(a.image_url)}
                                              >
                                                <Image className="w-3.5 h-3.5" />
                                              </button>
                                            ) : (
                                              <span className="shrink-0 p-1 text-muted-foreground/40" title="No image">
                                                <Image className="w-3.5 h-3.5" />
                                              </span>
                                            )}
                                          </div>
                                          {flagsClickable ? renderNestedFlagDetails(flagKey, detailFlags) : null}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                  {renderHideSection()}
                                </div>
                              ) : contentPanel === "adAssetFlags" ? (
                                <div>
                                  <p className="text-xs text-muted-foreground">No flagged ad assets.</p>
                                  {renderHideSection()}
                                </div>
                              ) : null
                            )}
                          </div>
                        )}

                        {flaggingOpen && (
                          <div className="mt-3 space-y-3 border-t border-border/70 pt-3 pl-4 sm:pl-6">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                              {flaggingPanelType === "event" ? "Activity Flags Filed"
                                : flaggingPanelType === "comment" ? "Comment Flags Filed"
                                  : flaggingPanelType === "ad" ? "Ad Asset Flags Filed"
                                    : "User Flags Filed"}
                            </p>
                            {filedFlags.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No flags found for this user.</p>
                            ) : flaggingPanelType === "event" ? (
                              <ul className="space-y-1.5">
                                {groupFlagsByTarget(filedFlags).map(({ targetId, flags: group }) => {
                                  const meta = eventMap[targetId] || events.find((ev) => ev.id === targetId);
                                  const title = meta?.title || group[0]?.target_contributor_name || "Activity";
                                  const zip = meta?.zip_code;
                                  const flagKey = `flagging:event:${targetId}`;
                                  return (
                                    <li key={targetId} className="text-sm min-w-0">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="truncate flex-1 min-w-0">
                                          <Link
                                            to={`/event/${targetId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-mint-600 hover:underline font-medium"
                                            title={title}
                                          >
                                            {title}
                                          </Link>
                                          <span className="text-muted-foreground">{zipParen(zip)}</span>
                                        </div>
                                        {renderFlagsCountControl(group.length, flagKey, group, true)}
                                      </div>
                                      {renderNestedFlagDetails(flagKey, group)}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : flaggingPanelType === "comment" ? (
                              <ul className="space-y-1.5">
                                {groupFlagsByTarget(filedFlags).map(({ targetId, flags: group }) => {
                                  const meta = eventMap[targetId];
                                  const text = (meta?.content || group[0]?.target_contributor_name || "Comment").trim() || "(empty)";
                                  const long = text.length > 100;
                                  const open = expandedUserComments.has(`flagging-${targetId}`);
                                  const eventId = meta?.event_id;
                                  const flagKey = `flagging:comment:${targetId}`;
                                  return (
                                    <li key={targetId} className="text-sm min-w-0">
                                      <div className="flex items-start gap-2 min-w-0">
                                        <div className="flex-1 min-w-0">
                                          <p className={open ? "whitespace-pre-wrap break-words" : "truncate"}>
                                            {open || !long ? text : `${text.slice(0, 100)}…`}
                                          </p>
                                          {long && (
                                            <button
                                              type="button"
                                              className="text-[11px] text-mint-600 hover:underline mt-0.5"
                                              onClick={() => {
                                                setExpandedUserComments((prev) => {
                                                  const next = new Set(prev);
                                                  const cid = `flagging-${targetId}`;
                                                  if (next.has(cid)) next.delete(cid);
                                                  else next.add(cid);
                                                  return next;
                                                });
                                              }}
                                            >
                                              {open ? "Show less" : "Show full"}
                                            </button>
                                          )}
                                        </div>
                                        {renderFlagsCountControl(group.length, flagKey, group, true)}
                                        {eventId ? (
                                          <Link
                                            to={`/event/${eventId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="shrink-0 p-1 rounded-md hover:bg-mint-50 text-mint-600"
                                            title="View activity"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                          </Link>
                                        ) : (
                                          <span className="shrink-0 p-1 text-muted-foreground/40" title="No activity link">
                                            <Eye className="w-3.5 h-3.5" />
                                          </span>
                                        )}
                                      </div>
                                      {renderNestedFlagDetails(flagKey, group)}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : flaggingPanelType === "ad" ? (
                              <ul className="space-y-1.5">
                                {groupFlagsByTarget(filedFlags).map(({ targetId, flags: group }) => {
                                  const meta = eventMap[targetId];
                                  const title = meta?.title || group[0]?.target_contributor_name || "Ad Asset";
                                  const flagKey = `flagging:ad:${targetId}`;
                                  return (
                                    <li key={targetId} className="text-sm min-w-0">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="truncate flex-1 min-w-0" title={title}>
                                          <span className="font-medium">{title}</span>
                                          <span className="text-muted-foreground">{adZipParen(meta)}</span>
                                        </div>
                                        {renderFlagsCountControl(group.length, flagKey, group, true)}
                                        {meta?.link_url ? (
                                          <a
                                            href={meta.link_url.startsWith("http") ? meta.link_url : `https://${meta.link_url}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="shrink-0 p-1 rounded-md hover:bg-mint-50 text-mint-600"
                                            title="Open ad link"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                          </a>
                                        ) : (
                                          <span className="shrink-0 p-1 text-muted-foreground/40" title="No link">
                                            <Link2 className="w-3.5 h-3.5" />
                                          </span>
                                        )}
                                        {meta?.image_url ? (
                                          <button
                                            type="button"
                                            className="shrink-0 p-1 rounded-md hover:bg-mint-50 text-mint-600"
                                            title="View ad image"
                                            onClick={() => setUserContentPreviewUrl(meta.image_url)}
                                          >
                                            <Image className="w-3.5 h-3.5" />
                                          </button>
                                        ) : (
                                          <span className="shrink-0 p-1 text-muted-foreground/40" title="No image">
                                            <Image className="w-3.5 h-3.5" />
                                          </span>
                                        )}
                                      </div>
                                      {renderNestedFlagDetails(flagKey, group)}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <ul className="space-y-1.5">
                                {groupFlagsByTarget(filedFlags).map(({ targetId, flags: group }) => {
                                  const flaggedUser = users.find((x) => x.id === targetId);
                                  const flaggedUserName = flaggedUser
                                    ? (organizerMap[flaggedUser.id]
                                      || [flaggedUser.first_name, flaggedUser.last_name].filter(Boolean).join(" ").trim()
                                      || flaggedUser.full_name
                                      || flaggedUser.email
                                      || "User")
                                    : (group[0]?.target_contributor_name || "User");
                                  const flagKey = `flagging:user:${targetId}`;
                                  return (
                                    <li key={targetId} className="text-sm min-w-0">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="truncate flex-1 min-w-0 font-medium">{flaggedUserName}</span>
                                        {renderFlagsCountControl(group.length, flagKey, group, true)}
                                      </div>
                                      {renderNestedFlagDetails(flagKey, group)}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                            {renderHideSection()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                <Paginator total={filteredAndSortedUsers.length} page={usersPage} onPage={setUsersPage} />
              </div>
            )}
          </AdminPanelShell>
        </>
      )}

      {usersSection === "users-reactivation" && (
        <>
          <AdminSectionHeader
            title="Disabled User Reactivation Requests"
            icon={MessageSquare}
          />
          <AdminPanelShell>
            <div className="pb-4 mb-4 border-b border-border flex flex-col sm:flex-row gap-2 sm:items-center">
              <SearchClearField
                placeholder="Search reactivation requests…"
                value={reactivationSearch}
                onValueChange={(v) => { setReactivationSearch(v); setReactivationPage(1); }}
              />
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "all", label: "All" },
                  { id: "open", label: "Open" },
                  { id: "closed", label: "Closed" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setReactivationStatusFilter(opt.id); setReactivationPage(1); }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                      reactivationStatusFilter === opt.id
                        ? "border-mint-300 bg-mint-50 text-mint-700"
                        : "border-border bg-white text-muted-foreground hover:bg-mint-50 hover:border-mint-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {filteredReactivationRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                {reactivationRequests.length === 0
                  ? "No reactivation requests yet"
                  : "No requests match your search or filters"}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredReactivationRequests
                  .slice((reactivationPage - 1) * PAGE_SIZE, reactivationPage * PAGE_SIZE)
                  .map((r) => {
                    const pending = r.status === "pending";
                    const declined = r.status === "declined";
                    const reactivated = r.status === "reactivated";
                    const profile = users.find((u) => u.id === r.user_id);
                    const u = profile || {};
                    const displayName = organizerMap[r.user_id]
                      || (u.first_name || u.last_name
                        ? `${u.first_name || ""} ${u.last_name || ""}`.trim()
                        : null)
                      || (u.full_name && !String(u.full_name).includes("@") ? u.full_name : null)
                      || r.sender_name
                      || "—";
                    const roleLabel =
                      u.role === "community_member" ? "Community Member"
                        : u.role === "organizer" ? "Organizer"
                          : u.role === "admin" ? "Admin"
                            : u.role === "disabled" ? "Disabled"
                              : "Community Member";
                    const priorRole = u.role_before_disabled || restoreRoleFromProfile(u);
                    const priorRoleLabel =
                      priorRole === "organizer"
                        ? "Organizer"
                        : priorRole === "admin"
                          ? "Admin"
                          : "Community Member";
                    const disabledByName = resolveAdminDisplayName(u.disabled_by, users);
                    const flagHistory = getUserFlagCaseHistory(u);
                    const receivedUserFlags = flagsReceivedByUser(flags, r.user_id);
                    const content = userContentById[r.user_id] || {
                      events: [],
                      comments: [],
                      ads: [],
                      activityFlagTotal: 0,
                      commentFlagTotal: 0,
                      adFlagTotal: 0,
                      userFlagCount: Number(u.user_flag_count || 0),
                    };
                    const flagging = flaggingStatsByUserId[r.user_id] || {
                      activities: 0, comments: 0, ads: 0, users: 0, total: 0,
                    };
                    const userFlagCount = Math.max(
                      Number(u.user_flag_count || 0),
                      Number(content.userFlagCount || 0),
                      receivedUserFlags.length
                    );
                    return (
                      <div
                        key={r.id}
                        className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-start gap-3 shadow-sm ${
                          pending
                            ? "border-mint-200 bg-mint-50/50"
                            : declined
                              ? "border-peach-200 bg-peach-50/40"
                              : "border-border bg-white"
                        }`}
                      >
                        <div className="flex-1 min-w-0 space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <p className="text-sm font-semibold truncate">{displayName}</p>
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted">
                                {roleLabel}
                              </span>
                              {u.is_advertiser && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted">
                                  Supporter
                                </span>
                              )}
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  pending
                                    ? "bg-mint-100 text-mint-700"
                                    : declined
                                      ? "bg-red-100 text-red-600"
                                      : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {pending ? "Pending" : declined ? "Declined" : "Reactivated"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {[
                                u.email || r.sender_email,
                                u.zip_code || null,
                                u.created_date || u.created_at
                                  ? moment(u.created_date || u.created_at).format("MMM D, YYYY")
                                  : null,
                              ].filter(Boolean).join(" · ")}
                            </p>
                            {(r.sender_phone || u.phone) && (
                              <p className="text-xs text-muted-foreground">
                                Phone: {formatPhoneDisplay(r.sender_phone || u.phone)}
                              </p>
                            )}
                            <div className="text-xs text-muted-foreground space-y-0.5 pt-0.5">
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span className="font-medium text-foreground/80">Contributions:</span>
                                <span>Activities: {content.events.length}</span>
                                <span>·</span>
                                <span>Comments: {content.comments.length}</span>
                                <span>·</span>
                                <span>Ads: {content.ads.length}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span className="font-medium text-foreground/80">Flagged:</span>
                                <span>User: {userFlagCount}</span>
                                <span>·</span>
                                <span>Activity: {content.activityFlagTotal}</span>
                                <span>·</span>
                                <span>Comment: {content.commentFlagTotal}</span>
                                <span>·</span>
                                <span>Ad Asset: {content.adFlagTotal}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span className="font-medium text-foreground/80">Flags Filed:</span>
                                <span>Activities: {flagging.activities}</span>
                                <span>·</span>
                                <span>Comments: {flagging.comments}</span>
                                <span>·</span>
                                <span>Ads: {flagging.ads}</span>
                                <span>·</span>
                                <span>Users: {flagging.users}</span>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5 space-y-1">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              User’s comments (why they want reactivation)
                            </p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">
                              {r.message?.trim() || "—"}
                            </p>
                          </div>

                          <div className="rounded-lg border border-border/70 bg-white/80 overflow-hidden">
                            <button
                              type="button"
                              className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left text-xs hover:bg-muted/30"
                              onClick={() => {
                                setExpandedReactivationContext((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(r.id)) next.delete(r.id);
                                  else next.add(r.id);
                                  return next;
                                });
                              }}
                            >
                              <span className="min-w-0">
                                <span className="font-medium text-foreground/80">Disable context</span>
                                <span className="text-muted-foreground">
                                  {" · "}
                                  {describeDisableSource(u)}
                                  {" · "}
                                  {userFlagCount} user flag{userFlagCount === 1 ? "" : "s"}
                                  {u.disabled_at
                                    ? ` · ${moment.utc(u.disabled_at).local().format("MMM D, YYYY")}`
                                    : ""}
                                </span>
                              </span>
                              {expandedReactivationContext.has(r.id)
                                ? <ChevronUp className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                : <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
                            </button>

                            {expandedReactivationContext.has(r.id) && (
                              <div className="border-t border-border/70 px-2.5 py-2.5 space-y-3 text-xs text-muted-foreground">
                                <div className="space-y-1.5">
                                  <p>
                                    <span className="font-medium text-foreground/80">Source:</span>{" "}
                                    {describeDisableSource(u)}
                                  </p>
                                  <p>
                                    <span className="font-medium text-foreground/80">Prior role:</span> {priorRoleLabel}
                                  </p>
                                  {u.disabled_at && (
                                    <p>
                                      <span className="font-medium text-foreground/80">Disabled:</span>{" "}
                                      {formatFlagSubmittedAt(u.disabled_at)}
                                      {disabledByName ? ` · by ${disabledByName}` : ""}
                                    </p>
                                  )}
                                  {u.disabled_note && (
                                    <p>
                                      <span className="font-medium text-foreground/80">Disable note:</span>{" "}
                                      <span className="whitespace-pre-wrap text-foreground/90">{u.disabled_note}</span>
                                    </p>
                                  )}
                                  {u.user_flag_case_admin_action && (
                                    <p>
                                      <span className="font-medium text-foreground/80">Flag case:</span>{" "}
                                      {ADMIN_ACTION_LABEL[u.user_flag_case_admin_action] || u.user_flag_case_admin_action}
                                    </p>
                                  )}
                                  {flagHistory.length > 0 && (
                                    <div className="pt-1 border-t border-border/60 space-y-0.5">
                                      <p className="font-medium text-foreground/80">User-flag Admin History</p>
                                      {flagHistory.map((histEntry, idx) => (
                                        <p key={`${r.id}-hist-${idx}`}>
                                          • {formatAdminHistoryEntry(histEntry)}
                                          {histEntry?.note ? ` — ${histEntry.note}` : ""}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-lg border border-peach-200/80 bg-peach-50/30 p-2.5 space-y-2">
                                  <p className="font-medium text-foreground/80">
                                    User flags received ({receivedUserFlags.length}
                                    {userFlagCount !== receivedUserFlags.length
                                      ? ` · profile count ${userFlagCount}`
                                      : ""}
                                    )
                                  </p>
                                  {receivedUserFlags.length === 0 ? (
                                    <p>
                                      No user-flag reports found for this account
                                      {userFlagCount > 0
                                        ? " (profile still shows a flag count — reports may have been cleared in a test reset)."
                                        : "."}
                                    </p>
                                  ) : (
                                    <div className="space-y-2">
                                      {receivedUserFlags.map((f) => {
                                        const reportAction = f.admin_action || (f.reviewed ? "reviewed" : null);
                                        return (
                                          <div
                                            key={f.id}
                                            className="rounded-lg border border-border/70 bg-white/90 p-2.5 space-y-0.5"
                                          >
                                            <p>
                                              <span className="font-medium text-foreground/80">Flagged By:</span>{" "}
                                              {resolveReporterName(f, { users, organizerMap })}
                                            </p>
                                            <p>
                                              <span className="font-medium text-foreground/80">Reason:</span>{" "}
                                              {userFlagReasonLabel(f.reason)}
                                            </p>
                                            {f.details ? (
                                              <p>
                                                <span className="font-medium text-foreground/80">Comments:</span>{" "}
                                                {f.details}
                                              </p>
                                            ) : null}
                                            <p className="text-[11px]">
                                              {formatFlagSubmittedAt(f.created_date || f.created_at)}
                                              {reportAction
                                                ? ` · ${ADMIN_ACTION_LABEL[reportAction] || reportAction}`
                                                : ""}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {declined && r.admin_note && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground/80">Decline note:</span> {r.admin_note}
                            </p>
                          )}
                          {reactivated && r.admin_note && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground/80">Approve note:</span> {r.admin_note}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Requested {formatMessageSubmittedAt(r.created_date || r.created_at)}
                            {r.reviewed_at
                              ? ` · Closed ${moment.utc(r.reviewed_at).local().format("MMM D, YYYY h:mm A")}`
                              : ""}
                          </p>
                        </div>
                        {pending && (
                          <div className="flex flex-wrap gap-1.5 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg text-xs h-7 text-mint-600 border-mint-200"
                              onClick={() =>
                                openReactivateUserDialog(r.user_id, {
                                  requestId: r.id,
                                  userName: displayName,
                                })
                              }
                            >
                              Reactivate
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg text-xs h-7 text-destructive border-destructive/20"
                              onClick={() => setDeclineDialog({ open: true, request: r })}
                            >
                              Decline
                            </Button>
                          </div>
                        )}
                        {!pending && (
                          <div className="shrink-0 text-xs text-muted-foreground pt-1">
                            {reactivated ? "Closed — Reactivated" : "Closed — Declined"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                {filteredReactivationRequests.length > PAGE_SIZE && (
                  <Paginator
                    total={filteredReactivationRequests.length}
                    page={reactivationPage}
                    onPage={setReactivationPage}
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
