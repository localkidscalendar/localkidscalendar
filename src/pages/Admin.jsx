import React, { useState, useEffect, useMemo } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Shield, CalendarDays, Flag, Megaphone, Users, BarChart3, Mail, Clock, DollarSign, Tag, ImagePlus, MapPin, FlaskConical, MessageSquare } from "lucide-react";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import AdminNoteConfirmDialog from "@/components/admin/AdminNoteConfirmDialog";
import ImagePreviewModal from "@/components/ads/ImagePreviewModal";
import FAQManagerV2 from "@/components/admin/FAQManager";
import SiteNoticesPreview from "@/components/admin/SiteNoticesPreview";
import { AutomatedMessagesPreview, EmailsPreviewSimplified } from "@/components/admin/PreviewsPanels";
import AdminMassMessagesPanel from "@/components/admin/AdminMassMessagesPanel";
import AdminDigestPanel from "@/components/admin/AdminDigestPanel";
import AdminAdsPanel from "@/components/admin/AdminAdsPanel";
import AdminPanelShell from "@/components/admin/AdminPanelShell";
import AdminSubNav from "@/components/admin/AdminSubNav";
import AdminZipConfigPanel from "@/components/admin/AdminZipConfigPanel";
import AdminDefaultAdsPanel from "@/components/admin/AdminDefaultAdsPanel";
import DiscountCodesPanel from "@/components/admin/DiscountCodesPanel";
import AdminAdRatesPanel from "@/components/admin/AdminAdRatesPanel";
import AdminWaitlistPanel from "@/components/admin/AdminWaitlistPanel";
import AdminManual from "@/components/admin/AdminManual";
import AdminUserZipReportsSection from "@/components/admin/AdminUserZipReportsSection";
import AdminBetaPanel from "@/components/admin/AdminBetaPanel";
import AdminActivityPhotoReviewPanel from "@/components/admin/AdminActivityPhotoReviewPanel";
import ManualReviewPanel from "@/components/admin/ManualReviewPanel";
import moment from "moment";
import {
  PREVIEW_SECTIONS,
  ADS_SECTIONS,
  REVIEW_SECTIONS,
  MESSAGE_SECTIONS,
  MESSAGE_TYPE_BOXES,
  MASS_MESSAGE_SECTIONS,
  FLAGS_SECTIONS,
  USER_SECTIONS,
  REACTIVATE_RESTORE_OPTIONS,
  ADMIN_ACTION_LABEL,
} from "@/components/admin/adminPageConstants";
import {
  userFlagReasonLabel,
  contentFlagReasonLabel,
  isMessageDeleted,
  isMessageAddressed,
  messagesForTypeBox,
  unreadCountForTypeBox,
  formatMessageSubmittedAt,
  getActivityStatusMeta,
  normalizeFlagCaseAction,
  isContentFlagCaseClosed,
  isUserFlagCaseClosed,
  getFlagHistory,
  getDeactivatedCaseHistory,
  getUserFlagCaseHistory,
  isDeactivatedItemHidden,
  isFlagOpen,
  formatFlagSubmittedAt,
  formatAdminHistoryEntry,
  resolveReporterName,
  resolveDeactivatedContributor,
  resolveAdminDisplayName,
  describeDisableSource,
  groupFlagsByTarget,
  formatAdZipLabel,
  flagsFiledByUserIncludingUsers,
  flagsReceivedByUser,
  flagsOnTarget,
} from "@/components/admin/adminPageHelpers";
import AdminActivitiesTab from "@/components/admin/AdminActivitiesTab";
import AdminFlagsTab from "@/components/admin/AdminFlagsTab";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminContactTab from "@/components/admin/AdminContactTab";
import { useAdminPageActions } from "@/components/admin/useAdminPageActions";


export default function Admin() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [flags, setFlags] = useState([]);
  const [ads, setAds] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [messages, setMessages] = useState([]);
  const [eventSearch, setEventSearch] = useState("");
  const [eventStatusFilter, setEventStatusFilter] = useState("all"); // all | active | inactive
  const [eventSortBy, setEventSortBy] = useState("date");
  const [eventSortOrder, setEventSortOrder] = useState("desc");
  const [expandedEventNotes, setExpandedEventNotes] = useState(() => new Set());
  const [userSearch, setUserSearch] = useState("");
  const [userSearchExactEmail, setUserSearchExactEmail] = useState(false);
  const [userListFilter, setUserListFilter] = useState("all");
  const [userSortBy, setUserSortBy] = useState("joined");
  const [userSortOrder, setUserSortOrder] = useState("desc");
  const [activeTab, setActiveTab] = useState("activities");
  const [flagSearch, setFlagSearch] = useState("");
  const [flagTypeFilter, setFlagTypeFilter] = useState("all"); // all | event | comment | ad
  const [flag3PlusOnly, setFlag3PlusOnly] = useState(false); // 3+ Deactivation cards only
  const [expandedFlagHistory, setExpandedFlagHistory] = useState(() => new Set());
  const [expandedReactivationContext, setExpandedReactivationContext] = useState(() => new Set());
  const [flaggedUserSearch, setFlaggedUserSearch] = useState("");
  const [flaggedUserRoleFilter, setFlaggedUserRoleFilter] = useState("all");
  const [flaggedUsersPage, setFlaggedUsersPage] = useState(1);
  const [flaggingUserSearch, setFlaggingUserSearch] = useState("");
  const [flaggingActivityFilter, setFlaggingActivityFilter] = useState("all"); // all | flagging | being_flagged
  // users-list: contributions / flagged / flagging expand panel key per user
  const [userContentPanelById, setUserContentPanelById] = useState({});
  const [expandedUserComments, setExpandedUserComments] = useState(() => new Set());
  const [expandedItemFlags, setExpandedItemFlags] = useState(() => new Set());
  const [userContentById, setUserContentById] = useState({});
  const [userContentPreviewUrl, setUserContentPreviewUrl] = useState(null);
  const [disabledUsers, setDisabledUsers] = useState(new Set());
  const [organizerMap, setOrganizerMap] = useState({});
  const [reactivationRequests, setReactivationRequests] = useState([]);
  const [reactivationSearch, setReactivationSearch] = useState("");
  const [reactivationStatusFilter, setReactivationStatusFilter] = useState("open"); // open | closed | all
  const [reactivationPage, setReactivationPage] = useState(1);
  const [disableDialog, setDisableDialog] = useState({
    open: false,
    userId: null,
    userName: "",
    isSupporter: false,
    source: "users_list",
    adImpact: null, // null | { loading, error, ...counts }
  });
  const [declineDialog, setDeclineDialog] = useState({ open: false, request: null });
  const [reactivateDialog, setReactivateDialog] = useState({
    open: false,
    userId: null,
    requestId: null,
    userName: "",
    isSupporter: false,
  });
  const [disableBusy, setDisableBusy] = useState(false);
  /** Shared note dialog for remove / deactivate / clear-flag actions */
  const [noteDialog, setNoteDialog] = useState({
    open: false,
    mode: null,
    context: {},
    busy: false,
  });
  // Pagination state
  const [eventsPage, setEventsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [flaggedContentPage, setFlaggedContentPage] = useState(1);
  const [flaggingUsersPage, setFlaggingUsersPage] = useState(1);

  const [flagsSection, setFlagsSection] = useState(FLAGS_SECTIONS[0].id);
  const [adsSection, setAdsSection] = useState(ADS_SECTIONS[0].id);
  const [usersSection, setUsersSection] = useState(USER_SECTIONS[0].id);
  const [previewsSection, setPreviewsSection] = useState(PREVIEW_SECTIONS[0].id);
  const [reviewSection, setReviewSection] = useState(REVIEW_SECTIONS[0].id);
  const [contactSection, setContactSection] = useState(MESSAGE_SECTIONS[0].id);
  const [contactPage, setContactPage] = useState(1);
  const [massSection, setMassSection] = useState(MASS_MESSAGE_SECTIONS[0].id);

  useEffect(() => {
    setContactPage(1);
  }, [contactSection]);

  useEffect(() => {
    if (!user || user.role !== "admin") { navigate("/"); return; }
    loadAll();
  }, [user]);


  const [eventMap, setEventMap] = useState({});
  const [deletedItems, setDeletedItems] = useState([]);

  const {
    loadAll, refreshReviewCounts, handleDeleteEvent, toggleMessageAddressed, softDeleteMessage, restoreMessage,
    handleReactivateItem, openFlagsForActivity, openUserInUsersList, toggleEventNotes,
    openDisableUserDialog, openReactivateUserDialog, handleDisableUser, handleApproveReactivation,
    handleDeclineReactivation, handleClearUserFlag, handleClearUserFlags, handleUserFlagReviewed,
    handleUserFlagMarkUnreviewed, handleDeactivatedOverride, handleDeactivatedManuallyDeactivate,
    handleDeactivatedReviewed, handleDeactivatedMarkUnreviewed, handleReactivateFromFlag,
    handleClearFlag, handleClearFlags, handleNoteDialogConfirm,
  } = useAdminPageActions({
    user, toast, navigate,
    setLoading, setEvents, setFlags, setAds, setUsers, setMessages,
    setReactivationRequests, setDisabledUsers, setOrganizerMap, setUserContentById, setStats,
    users, flags, events, organizerMap,
    eventMap, setEventMap, setDeletedItems,
    disableDialog, setDisableDialog, setDisableBusy,
    setReactivateDialog, setDeclineDialog, setNoteDialog, noteDialog,
    setActiveTab, setFlagSearch, setFlagTypeFilter, setFlagsSection, setFlaggedContentPage,
    setUserSearch, setUserSearchExactEmail, setUsersSection, setUsersPage,
    setExpandedEventNotes,
  });


  const flaggedContentCards = useMemo(() => {
    const contentFlags = flags.filter((f) => f.target_type !== "user");
    const byTarget = {};
    contentFlags.forEach((f) => {
      const key = `${f.target_type}:${f.target_id}`;
      if (!byTarget[key]) byTarget[key] = [];
      byTarget[key].push(f);
    });

    // Include 3+ targets even if somehow reports are missing from the feed
    deletedItems.forEach((item) => {
      const targetType = item.type === "event" ? "event" : item.type === "comment" ? "comment" : "ad";
      const key = `${targetType}:${item.item.id}`;
      if (!byTarget[key]) byTarget[key] = [...(item.flags || [])];
    });

    let list = Object.entries(byTarget).map(([key, targetFlags]) => {
      const colon = key.indexOf(":");
      const targetType = key.slice(0, colon);
      const targetId = key.slice(colon + 1);
      const itemType = targetType === "event" ? "event" : targetType === "comment" ? "comment" : "ad";
      const sortedFlags = [...targetFlags].sort(
        (a, b) =>
          new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0)
      );
      const uncleared = sortedFlags.filter((f) => f.admin_action !== "flag_cleared");
      const fromDeleted = deletedItems.find((d) => d.type === itemType && d.item.id === targetId);
      const meta = eventMap[targetId] || {};
      const fromEvents = itemType === "event" ? events.find((e) => e.id === targetId) : null;

      const baseItem = fromDeleted?.item || {
        id: targetId,
        ...(itemType === "event"
          ? {
              title: meta.title || fromEvents?.title || "Activity",
              status: meta.status || fromEvents?.status || "active",
              org_name: meta.org_name || fromEvents?.org_name,
              created_by_id: meta.created_by_id || fromEvents?.created_by_id,
              zip_code: meta.zip_code || fromEvents?.zip_code,
            }
          : itemType === "comment"
            ? {
                content: meta.content || "",
                event_id: meta.event_id,
                status: meta.status || "active",
                created_by_id: meta.created_by_id,
                author_name: meta.author_name,
              }
            : {
                ad_name: meta.ad_name || meta.title || "Ad Asset",
                business_name: meta.business_name,
                moderation_status: meta.moderation_status || meta.status,
                status: meta.status || meta.moderation_status,
                image_url: meta.image_url,
                link_url: meta.link_url,
                user_id: meta.user_id,
              }),
        flag_count: meta.flag_count ?? fromDeleted?.item?.flag_count ?? uncleared.length,
        flag_case_admin_action: meta.flag_case_admin_action ?? fromDeleted?.item?.flag_case_admin_action ?? null,
        flag_case_admin_history: meta.flag_case_admin_history || fromDeleted?.item?.flag_case_admin_history || [],
        updated_at: meta.updated_at || fromDeleted?.item?.updated_at,
        created_at: meta.created_at || fromDeleted?.item?.created_at,
      };

      const moderationItem = {
        type: itemType,
        item: baseItem,
        flags: sortedFlags,
        eventTitle:
          fromDeleted?.eventTitle
          || (itemType === "comment" && baseItem.event_id
            ? eventMap[baseItem.event_id]?.title || "—"
            : undefined),
      };

      const flagCount = Number(baseItem.flag_count ?? uncleared.length);
      const caseAction = baseItem.flag_case_admin_action || null;
      const hidden = isDeactivatedItemHidden(moderationItem);
      const is3Plus = flagCount >= 3 || Boolean(fromDeleted) || hidden;

      return {
        key,
        targetType,
        targetId,
        moderationItem,
        flags: sortedFlags,
        uncleared,
        flagCount,
        caseAction,
        hidden,
        is3Plus,
        sortAt:
          sortedFlags[0]?.created_at
          || sortedFlags[0]?.created_date
          || baseItem.updated_at
          || baseItem.created_at,
      };
    });

    if (flag3PlusOnly) {
      list = list.filter((card) => card.is3Plus);
    }

    if (flagTypeFilter !== "all") {
      list = list.filter((card) => card.targetType === flagTypeFilter);
    }

    if (flagSearch.trim()) {
      const q = flagSearch.trim().toLowerCase();
      list = list.filter((card) => {
        const item = card.moderationItem;
        const historyText = getDeactivatedCaseHistory(item)
          .map((e) => `${ADMIN_ACTION_LABEL[e?.action] || e?.action || ""} ${e?.by || ""}`)
          .join(" ");
        const title =
          item.type === "event"
            ? item.item.title || ""
            : item.type === "comment"
              ? `${item.item.content || ""} ${item.eventTitle || ""}`
              : `${item.item.ad_name || ""} ${item.item.business_name || ""} ${item.item.link_url || ""}`;
        const hay = [
          title,
          resolveDeactivatedContributor(item, { users, organizerMap }),
          ...card.flags.flatMap((f) => [resolveReporterName(f, { users, organizerMap }), f.reason, f.details, f.reporter_name]),
          ADMIN_ACTION_LABEL[card.caseAction] || "",
          historyText,
          card.is3Plus ? "3+ deactivation" : "",
          "flag",
        ].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }

    list.sort((a, b) => {
      if (a.hidden !== b.hidden) return a.hidden ? -1 : 1;
      if ((b.flagCount || 0) !== (a.flagCount || 0)) return (b.flagCount || 0) - (a.flagCount || 0);
      return new Date(b.sortAt || 0) - new Date(a.sortAt || 0);
    });
    return list;
  }, [flags, deletedItems, flagTypeFilter, flag3PlusOnly, flagSearch, eventMap, users, organizerMap, events]);

  const flaggedUserCards = useMemo(() => {
    const byUser = {};
    flags
      .filter((f) => f.target_type === "user")
      .forEach((f) => {
        if (!byUser[f.target_id]) byUser[f.target_id] = [];
        byUser[f.target_id].push(f);
      });

    let list = Object.entries(byUser).map(([userId, userFlags]) => {
      const profile = users.find((u) => u.id === userId);
      const sortedFlags = [...userFlags].sort(
        (a, b) =>
          new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0)
      );
      const uncleared = sortedFlags.filter((f) => f.admin_action !== "flag_cleared");
      const flagCount = Number(profile?.user_flag_count ?? uncleared.length);
      const displayName =
        organizerMap[userId]
        || profile?.full_name
        || (profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() : "")
        || sortedFlags[0]?.target_contributor_name
        || profile?.email
        || "Unknown";
      const role = profile?.role || "community_member";
      const suspended = Boolean(profile?.suspended_at) && role !== "disabled";
      const caseAction = profile?.user_flag_case_admin_action || null;
      return {
        userId,
        profile,
        flags: sortedFlags,
        uncleared,
        flagCount,
        displayName,
        email: profile?.email || "",
        role,
        suspended,
        caseAction,
        sortAt: sortedFlags[0]?.created_at || sortedFlags[0]?.created_date || profile?.suspended_at,
      };
    });

    if (flaggedUserRoleFilter === "community_member") {
      list = list.filter((c) => c.role === "community_member");
    } else if (flaggedUserRoleFilter === "organizer") {
      list = list.filter((c) => c.role === "organizer" || Boolean(organizerMap[c.userId]));
    } else if (flaggedUserRoleFilter === "3plus") {
      list = list.filter((c) => c.flagCount >= 3 || c.suspended || c.uncleared.length >= 3);
    }

    if (flaggedUserSearch.trim()) {
      const q = flaggedUserSearch.trim().toLowerCase();
      list = list.filter((c) => {
        const historyText = getUserFlagCaseHistory(c.profile)
          .map((e) => `${ADMIN_ACTION_LABEL[e?.action] || e?.action || ""} ${e?.by || ""}`)
          .join(" ");
        const hay = [
          c.displayName,
          c.email,
          c.role,
          ADMIN_ACTION_LABEL[c.caseAction] || "",
          historyText,
          ...c.flags.flatMap((f) => [
            resolveReporterName(f, { users, organizerMap }),
            userFlagReasonLabel(f.reason),
            f.details,
            f.reporter_name,
          ]),
          c.suspended ? "suspended" : "",
        ].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }

    list.sort((a, b) => {
      if (a.suspended !== b.suspended) return a.suspended ? -1 : 1;
      if ((b.flagCount || 0) !== (a.flagCount || 0)) return (b.flagCount || 0) - (a.flagCount || 0);
      return new Date(b.sortAt || 0) - new Date(a.sortAt || 0);
    });
    return list;
  }, [flags, users, organizerMap, flaggedUserRoleFilter, flaggedUserSearch]);

  const openFlaggedContentCount = useMemo(
    () =>
      flaggedContentCards.filter((c) => {
        if (isContentFlagCaseClosed(c.caseAction)) return false;
        return c.hidden || c.uncleared.length > 0;
      }).length,
    [flaggedContentCards]
  );

  const openFlaggedUsersCount = useMemo(
    () =>
      flaggedUserCards.filter((c) => {
        if (c.role === "disabled" || disabledUsers.has(c.userId)) return false;
        if (isUserFlagCaseClosed(c.caseAction)) return false;
        return c.suspended || c.uncleared.length > 0;
      }).length,
    [flaggedUserCards, disabledUsers]
  );

  const openFlagCount = useMemo(
    () => openFlaggedContentCount + openFlaggedUsersCount,
    [openFlaggedContentCount, openFlaggedUsersCount]
  );

  const flaggingActivityRows = useMemo(() => {
    const ownerByKey = {};
    for (const e of events) {
      if (e?.id && e?.created_by_id) ownerByKey[`event:${e.id}`] = e.created_by_id;
    }
    for (const a of ads) {
      if (a?.user_id) {
        if (a.ad_library_id) ownerByKey[`ad:${a.ad_library_id}`] = a.user_id;
        if (a.id) ownerByKey[`ad:${a.id}`] = a.user_id;
      }
    }
    for (const [userId, content] of Object.entries(userContentById || {})) {
      for (const e of content.events || []) {
        if (e?.id) ownerByKey[`event:${e.id}`] = userId;
      }
      for (const c of content.comments || []) {
        if (c?.id) ownerByKey[`comment:${c.id}`] = userId;
      }
      for (const a of content.ads || []) {
        if (a?.id) ownerByKey[`ad:${a.id}`] = userId;
      }
    }

    const filedCounts = {};
    const receivedCounts = {};
    for (const f of flags) {
      if (f.reporter_id) {
        filedCounts[f.reporter_id] = (filedCounts[f.reporter_id] || 0) + 1;
      }
      if (f.target_type === "user" && f.target_id) {
        receivedCounts[f.target_id] = (receivedCounts[f.target_id] || 0) + 1;
      } else if (f.target_type && f.target_id) {
        const ownerId = ownerByKey[`${f.target_type}:${f.target_id}`];
        if (ownerId) receivedCounts[ownerId] = (receivedCounts[ownerId] || 0) + 1;
      }
    }

    const resolveRowUser = (userId, fallbackName = null) => {
      const profile = users.find((u) => u.id === userId);
      const name =
        organizerMap[userId]
        || fallbackName
        || profile?.full_name
        || (profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() : "")
        || profile?.email
        || "Unknown";
      return {
        userId,
        name,
        email: profile?.email || "",
        isDisabled: disabledUsers.has(userId) || profile?.role === "disabled",
      };
    };

    const rows = [];
    for (const [userId, count] of Object.entries(filedCounts)) {
      if (count <= 0) continue;
      rows.push({
        key: `flagging:${userId}`,
        kind: "flagging",
        count,
        ...resolveRowUser(userId),
      });
    }
    for (const [userId, count] of Object.entries(receivedCounts)) {
      if (count <= 0) continue;
      rows.push({
        key: `being_flagged:${userId}`,
        kind: "being_flagged",
        count,
        ...resolveRowUser(userId),
      });
    }

    rows.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.userId === b.userId) return a.kind === "flagging" ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
    });
    return rows;
  }, [flags, users, events, ads, userContentById, organizerMap, disabledUsers]);

  const filteredFlaggingActivityRows = useMemo(() => {
    let list = flaggingActivityRows;
    if (flaggingActivityFilter === "flagging") {
      list = list.filter((r) => r.kind === "flagging");
    } else if (flaggingActivityFilter === "being_flagged") {
      list = list.filter((r) => r.kind === "being_flagged");
    }
    if (flaggingUserSearch.trim()) {
      const q = flaggingUserSearch.trim().toLowerCase();
      list = list.filter((r) => {
        const hay = [r.name, r.email, String(r.count), r.kind].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [flaggingActivityRows, flaggingActivityFilter, flaggingUserSearch]);

  const toggleUserContentPanel = (userId, panel) => {
    setUserContentPanelById((prev) => ({
      ...prev,
      [userId]: prev[userId] === panel ? null : panel,
    }));
  };

  const toggleItemFlagsExpand = (key) => {
    setExpandedItemFlags((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const flaggingStatsByUserId = useMemo(() => {
    const map = {};
    for (const f of flags) {
      if (!f.reporter_id) continue;
      if (!map[f.reporter_id]) {
        map[f.reporter_id] = { activities: 0, comments: 0, ads: 0, users: 0, total: 0 };
      }
      const bucket = map[f.reporter_id];
      if (f.target_type === "event") bucket.activities += 1;
      else if (f.target_type === "comment") bucket.comments += 1;
      else if (f.target_type === "ad") bucket.ads += 1;
      else if (f.target_type === "user") bucket.users += 1;
      bucket.total += 1;
    }
    return map;
  }, [flags]);

  const filteredAndSortedEvents = useMemo(() => {
    let filtered = events;
    if (eventStatusFilter === "active") {
      filtered = filtered.filter((e) => e.status === "active");
    } else if (eventStatusFilter === "inactive") {
      filtered = filtered.filter((e) => e.status !== "active");
    }
    if (eventSearch.trim()) {
      const search = eventSearch.toLowerCase();
      filtered = filtered.filter((e) =>
        e.title.toLowerCase().includes(search) || (e.zip_code || "").includes(eventSearch.trim())
      );
    }
    let sorted = [...filtered];
    if (eventSortBy === "title") {
      sorted.sort((a, b) => {
        const aTitle = (a.title || "").toLowerCase();
        const bTitle = (b.title || "").toLowerCase();
        return eventSortOrder === "asc" ? aTitle.localeCompare(bTitle) : bTitle.localeCompare(aTitle);
      });
    } else {
      sorted.sort((a, b) => {
        const aDate = new Date(a.start_date);
        const bDate = new Date(b.start_date);
        return eventSortOrder === "asc" ? aDate - bDate : bDate - aDate;
      });
    }
    return sorted;
  }, [events, eventSearch, eventStatusFilter, eventSortBy, eventSortOrder]);

  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users;
    if (userSearch.trim()) {
      const search = userSearch.trim().toLowerCase();
      if (userSearchExactEmail) {
        filtered = users.filter((u) => (u.email || "").toLowerCase() === search);
      } else {
        filtered = users.filter((u) =>
          (u.full_name || "").toLowerCase().includes(search)
          || (u.first_name || "").toLowerCase().includes(search)
          || (u.last_name || "").toLowerCase().includes(search)
          || (u.email || "").toLowerCase().includes(search)
          || (u.zip_code || "").toLowerCase().includes(search)
        );
      }
    }
    if (userListFilter === "admin") {
      filtered = filtered.filter((u) => u.role === "admin");
    } else if (userListFilter === "community_member") {
      filtered = filtered.filter((u) => u.role === "community_member");
    } else if (userListFilter === "organizer") {
      filtered = filtered.filter((u) => u.role === "organizer" || Boolean(organizerMap[u.id]));
    } else if (userListFilter === "supporter") {
      filtered = filtered.filter((u) => Boolean(u.is_advertiser));
    }
    let sorted = [...filtered];
    if (userSortBy === "name") {
      sorted.sort((a, b) => {
        const aName = (a.full_name || "").toLowerCase();
        const bName = (b.full_name || "").toLowerCase();
        return userSortOrder === "asc" ? aName.localeCompare(bName) : bName.localeCompare(aName);
      });
    } else if (userSortBy === "email") {
      sorted.sort((a, b) => {
        const aEmail = a.email.toLowerCase();
        const bEmail = b.email.toLowerCase();
        return userSortOrder === "asc" ? aEmail.localeCompare(bEmail) : bEmail.localeCompare(aEmail);
      });
    } else if (userSortBy === "zip") {
      sorted.sort((a, b) => {
        const aZip = a.zip_code || "";
        const bZip = b.zip_code || "";
        return userSortOrder === "asc"
          ? aZip.localeCompare(bZip, undefined, { numeric: true })
          : bZip.localeCompare(aZip, undefined, { numeric: true });
      });
    } else {
      sorted.sort((a, b) => {
        const aDate = new Date(a.created_date);
        const bDate = new Date(b.created_date);
        return userSortOrder === "asc" ? aDate - bDate : bDate - aDate;
      });
    }
    return sorted;
  }, [users, userSearch, userSearchExactEmail, userListFilter, organizerMap, userSortBy, userSortOrder]);

  const filteredReactivationRequests = useMemo(() => {
    let list = [...reactivationRequests];
    if (reactivationStatusFilter === "open") {
      list = list.filter((r) => r.status === "pending");
    } else if (reactivationStatusFilter === "closed") {
      list = list.filter((r) => r.status === "declined" || r.status === "reactivated");
    }
    if (reactivationSearch.trim()) {
      const q = reactivationSearch.trim().toLowerCase();
      list = list.filter((r) =>
        [r.sender_name, r.sender_email, r.sender_phone, r.message, r.admin_note, r.status]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    list.sort((a, b) => new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0));
    return list;
  }, [reactivationRequests, reactivationSearch, reactivationStatusFilter]);

  const pendingReactivations = useMemo(
    () => reactivationRequests.filter((r) => r.status === "pending").length,
    [reactivationRequests]
  );

  const contactSectionNav = useMemo(
    () =>
      MESSAGE_SECTIONS.map((section) => {
        if (section.id === "messages-deleted") return { ...section, badge: 0 };
        const box = MESSAGE_TYPE_BOXES.find((b) => b.id === section.id);
        return {
          ...section,
          badge: box ? unreadCountForTypeBox(messages, box) : 0,
        };
      }),
    [messages]
  );

  const flagsSectionNav = useMemo(
    () =>
      FLAGS_SECTIONS.map((section) => ({
        ...section,
        badge:
          section.id === "flags-flagged-content"
            ? openFlaggedContentCount
            : section.id === "flags-flagged-users"
              ? openFlaggedUsersCount
              : 0,
      })),
    [openFlaggedContentCount, openFlaggedUsersCount]
  );

  const reviewSectionNav = useMemo(
    () =>
      REVIEW_SECTIONS.map((section) => ({
        ...section,
        badge:
          section.id === "review-activity"
            ? (stats.unreadReviewsActivity || 0)
            : section.id === "review-advertising"
              ? (stats.unreadReviewsAds || 0)
              : 0,
      })),
    [stats.unreadReviewsActivity, stats.unreadReviewsAds]
  );

  const userSectionNav = useMemo(
    () =>
      USER_SECTIONS.map((section) => ({
        ...section,
        badge: section.id === "users-reactivation" ? pendingReactivations : 0,
      })),
    [pendingReactivations]
  );

  const noteDialogConfig = (() => {
    const mode = noteDialog.mode;
    if (mode === "remove_activity") {
      const title = noteDialog.context?.event?.title || "this activity";
      return {
        title: "Remove Activity",
        description: `Remove "${title}" from the public site? The poster will see your note in My Messages and on My Activity Posts. Savers get a generic notice only.`,
        noteLabel: "Note to Poster",
        notePlaceholder: "Explain why this activity is being removed…",
        noteRequired: true,
        emailMode: "never",
        confirmLabel: "Remove Activity",
      };
    }
    if (mode === "deactivate_comment") {
      return {
        title: "Deactivate Comment",
        description: "Hide this comment from the public site? The author will receive an inbox Message with your note.",
        noteLabel: "Note to Author",
        notePlaceholder: "Explain why this comment is being removed…",
        noteRequired: true,
        emailMode: "never",
        confirmLabel: "Deactivate Comment",
      };
    }
    if (mode === "deactivate_ad") {
      return {
        title: "Disable Ad Creative",
        description: "Disable this ad creative across all zip placements using it? Billing stays active; the Supporter must assign a different approved creative.",
        noteLabel: "Note to Supporter",
        notePlaceholder: "Explain why this ad creative is being disabled…",
        noteRequired: true,
        emailMode: "always",
        confirmLabel: "Disable Creative",
      };
    }
    if (mode === "clear_flag") {
      return {
        title: "Clear Flag",
        description: "Remove this flag from the item’s count? The report stays for admin history. The same reporter still cannot flag this item again.",
        noteLabel: "Note to Owner",
        notePlaceholder: "Optional note included in their inbox Message…",
        noteRequired: false,
        emailMode: "never",
        confirmLabel: "Clear Flag",
        confirmVariant: "mint",
      };
    }
    if (mode === "clear_flags") {
      const n = noteDialog.context?.uncleared?.length || 0;
      return {
        title: "Clear All Flags",
        description: `Clear all ${n} flags on this item? Reports stay for admin history. Community auto-hide can apply again if flags build up.`,
        noteLabel: "Note to Owner",
        notePlaceholder: "Optional note included in their inbox Message…",
        noteRequired: false,
        emailMode: "never",
        confirmLabel: "Clear Flags",
        confirmVariant: "mint",
      };
    }
    if (mode === "clear_user_flag") {
      return {
        title: "Clear User Flag",
        description: "Remove this flag from the account’s count? The report stays for admin history. The same reporter still cannot flag this user again.",
        noteLabel: "Note to User",
        notePlaceholder: "Optional note included in their inbox Message…",
        noteRequired: false,
        emailMode: "never",
        confirmLabel: "Clear Flag",
        confirmVariant: "mint",
      };
    }
    if (mode === "clear_user_flags") {
      const n = noteDialog.context?.uncleared?.length || 0;
      return {
        title: "Clear All User Flags",
        description: `Clear all ${n} flags on this user? Reports stay for admin history. Further flags could suspend the account again.`,
        noteLabel: "Note to User",
        notePlaceholder: "Optional note included in their inbox Message…",
        noteRequired: false,
        emailMode: "never",
        confirmLabel: "Clear Flags",
        confirmVariant: "mint",
      };
    }
    return null;
  })();


  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-mint-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-heading font-bold text-2xl">Admin Dashboard</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
        {[
          { label: "Active Events", value: stats.totalEvents, icon: CalendarDays },
          { label: "Users", value: stats.totalUsers, icon: Users },
          { label: "Organizers", value: stats.organizers, icon: BarChart3 },
          { label: "Flags", value: stats.totalFlags, icon: Flag },
          { label: "Active Ads", value: stats.activeAds, icon: Megaphone },
          { label: "Unread Messages", value: stats.unreadMessages, icon: Mail },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-border p-4">
            <s.icon className="w-4 h-4 text-muted-foreground mb-1" />
            <p className="text-xl font-heading font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="activities" className="rounded-lg text-sm">Activities</TabsTrigger>
          <TabsTrigger value="ads" className="rounded-lg text-sm">Ads</TabsTrigger>
          <TabsTrigger value="beta" className="rounded-lg text-sm">Beta</TabsTrigger>
          <TabsTrigger value="contact" className="rounded-lg text-sm">
            Contact Us {stats.unreadMessages > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-peach-100 text-peach-500 text-xs font-bold">{stats.unreadMessages}</span>}
          </TabsTrigger>
          <TabsTrigger value="faq" className="rounded-lg text-sm">FAQs</TabsTrigger>
          <TabsTrigger value="flags" className="rounded-lg text-sm">
            Flags {openFlagCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-peach-100 text-peach-500 text-xs font-bold">{openFlagCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="manual" className="rounded-lg text-sm">Manual</TabsTrigger>
          <TabsTrigger value="mass-messages" className="rounded-lg text-sm">Mass Messages</TabsTrigger>
          <TabsTrigger value="previews" className="rounded-lg text-sm">Previews</TabsTrigger>
          <TabsTrigger value="review" className="rounded-lg text-sm">
            Reviews {stats.unreadReviews > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-peach-100 text-peach-500 text-xs font-bold">{stats.unreadReviews}</span>}
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-lg text-sm">
            Users {pendingReactivations > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-peach-100 text-peach-500 text-xs font-bold">{pendingReactivations}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activities">
          <AdminActivitiesTab ctx={{
            eventSearch, setEventSearch, eventStatusFilter, setEventStatusFilter,
            eventSortBy, setEventSortBy, eventSortOrder, setEventSortOrder,
            eventsPage, setEventsPage, expandedEventNotes, filteredAndSortedEvents,
            toggleEventNotes, navigate, handleDeleteEvent, handleReactivateItem, openFlagsForActivity,
          }} />
        </TabsContent>

        <TabsContent value="flags">
          <AdminFlagsTab ctx={{
            flagsSection, setFlagsSection, flagsSectionNav,
            flagSearch, setFlagSearch, flagTypeFilter, setFlagTypeFilter, flag3PlusOnly, setFlag3PlusOnly,
            flaggedContentPage, setFlaggedContentPage, flaggedContentCards,
            expandedFlagHistory, setExpandedFlagHistory,
            flaggedUserSearch, setFlaggedUserSearch, flaggedUserRoleFilter, setFlaggedUserRoleFilter,
            flaggedUsersPage, setFlaggedUsersPage, flaggedUserCards, disabledUsers,
            flaggingUserSearch, setFlaggingUserSearch, flaggingActivityFilter, setFlaggingActivityFilter,
            flaggingUsersPage, setFlaggingUsersPage, filteredFlaggingActivityRows, flaggingActivityRows,
            handleClearFlag, handleClearFlags, handleDeactivatedOverride, handleDeactivatedManuallyDeactivate,
            handleDeactivatedReviewed, handleDeactivatedMarkUnreviewed, handleReactivateFromFlag,
            handleClearUserFlag, handleClearUserFlags, handleUserFlagReviewed, handleUserFlagMarkUnreviewed,
            openReactivateUserDialog, openDisableUserDialog, openUserInUsersList,
            users, organizerMap,
          }} />
        </TabsContent>

        <TabsContent value="ads">
          <AdminSubNav
            sections={ADS_SECTIONS}
            value={adsSection}
            onChange={setAdsSection}
            label="Ads sections"
          />

          {adsSection === "ads-supporter-ads" && (
            <>
              <AdminSectionHeader title="All Supporter Ads" icon={Megaphone} />
              <AdminPanelShell>
                <AdminAdsPanel ads={ads} users={users} onRefresh={loadAll} toast={toast} />
              </AdminPanelShell>
            </>
          )}
          {adsSection === "ads-zip-config" && (
            <>
              <AdminSectionHeader title="Custom Zip Code Configurations" icon={MapPin} />
              <AdminPanelShell>
                <AdminZipConfigPanel ads={ads} toast={toast} />
              </AdminPanelShell>
            </>
          )}
          {adsSection === "ads-waitlist" && (
            <>
              <AdminSectionHeader title="Waitlist Management" icon={Clock} />
              <AdminPanelShell>
                <AdminWaitlistPanel toast={toast} />
              </AdminPanelShell>
            </>
          )}
          {adsSection === "ads-rates" && (
            <>
              <AdminSectionHeader title="Ad Rates" icon={DollarSign} />
              <AdminPanelShell>
                <AdminAdRatesPanel toast={toast} />
              </AdminPanelShell>
            </>
          )}
          {adsSection === "ads-discounts" && (
            <>
              <AdminSectionHeader title="Discount Codes" icon={Tag} />
              <AdminPanelShell>
                <DiscountCodesPanel toast={toast} />
              </AdminPanelShell>
            </>
          )}
          {adsSection === "ads-default-filler" && (
            <>
              <AdminSectionHeader title="Default/Filler Ads" icon={ImagePlus} />
              <AdminPanelShell>
                <AdminDefaultAdsPanel toast={toast} />
              </AdminPanelShell>
            </>
          )}
        </TabsContent>

        <TabsContent value="users">
          <AdminUsersTab ctx={{
            userSectionNav, usersSection, setUsersSection,
            userSearch, setUserSearch, setUserSearchExactEmail, userListFilter, setUserListFilter,
            usersPage, setUsersPage, filteredAndSortedUsers, users, disabledUsers, organizerMap,
            userContentById, userContentPanelById, toggleUserContentPanel, expandedUserComments, setExpandedUserComments,
            expandedItemFlags, toggleItemFlagsExpand, flaggingStatsByUserId, flags,
            flagsFiledByUserIncludingUsers, flagsReceivedByUser, flagsOnTarget, groupFlagsByTarget, eventMap, events,
            setUserContentPreviewUrl, setUsers, toast, openDisableUserDialog, openReactivateUserDialog,
            reactivationSearch, setReactivationSearch, reactivationStatusFilter, setReactivationStatusFilter,
            reactivationPage, setReactivationPage, filteredReactivationRequests, reactivationRequests,
            expandedReactivationContext, setExpandedReactivationContext, setDeclineDialog,
          }} />
        </TabsContent>
        <TabsContent value="beta">
          <AdminSectionHeader title="Beta Mode" subtitle="When on, the site banner appears and only listed zip codes are functional." icon={FlaskConical} />
          <AdminBetaPanel toast={toast} />
        </TabsContent>

        <TabsContent value="previews">
          <AdminSubNav
            sections={PREVIEW_SECTIONS}
            value={previewsSection}
            onChange={setPreviewsSection}
            label="Previews sections"
          />

          {previewsSection === "previews-emails" && (
            <>
              <AdminSectionHeader title="Emails" icon={Mail} />
              <AdminPanelShell>
                <EmailsPreviewSimplified />
              </AdminPanelShell>
            </>
          )}

          {previewsSection === "previews-automated" && (
            <>
              <AdminSectionHeader title="Automated Messages" icon={MessageSquare} />
              <AdminPanelShell>
                <AutomatedMessagesPreview />
              </AdminPanelShell>
            </>
          )}

          {previewsSection === "previews-site-notices" && (
            <>
              <AdminSectionHeader title="Site Notices" icon={Megaphone} />
              <AdminPanelShell>
                <SiteNoticesPreview />
              </AdminPanelShell>
            </>
          )}
        </TabsContent>

        <TabsContent value="faq">
          <AdminSectionHeader title="FAQs" icon={HelpCircle} />
          <div className="bg-white rounded-2xl border border-border p-6">
            <FAQManagerV2 />
          </div>
        </TabsContent>

        <TabsContent value="manual">
          <AdminManual />
        </TabsContent>

        <TabsContent value="review">
          <AdminSubNav
            sections={reviewSectionNav}
            value={reviewSection}
            onChange={setReviewSection}
            label="Review sections"
          />

          {reviewSection === "review-activity" && (
            <>
              <AdminSectionHeader title="Activity Manual Review" icon={Image} />
              <AdminPanelShell>
                <AdminActivityPhotoReviewPanel toast={toast} onQueueChange={refreshReviewCounts} />
              </AdminPanelShell>
            </>
          )}

          {reviewSection === "review-advertising" && (
            <>
              <AdminSectionHeader title="Advertising Manual Review" icon={Image} />
              <AdminPanelShell>
                <ManualReviewPanel toast={toast} onQueueChange={refreshReviewCounts} />
              </AdminPanelShell>
            </>
          )}
        </TabsContent>

        <TabsContent value="contact">
          <AdminContactTab ctx={{
            contactSectionNav, contactSection, setContactSection, contactPage, setContactPage,
            messages, toggleMessageAddressed, softDeleteMessage, restoreMessage,
          }} />
        </TabsContent>

        <TabsContent value="mass-messages">
          <AdminSubNav
            sections={MASS_MESSAGE_SECTIONS}
            value={massSection}
            onChange={setMassSection}
            label="Mass Messages sections"
          />
          {massSection === "mass-digest" ? (
            <AdminDigestPanel toast={toast} />
          ) : (
            <AdminMassMessagesPanel toast={toast} activeSection={massSection} />
          )}
        </TabsContent>
      </Tabs>

      <AdminNoteConfirmDialog
        open={disableDialog.open}
        onOpenChange={(open) => {
          if (!open) setDisableDialog({ open: false, userId: null, userName: "", isSupporter: false, source: "users_list", adImpact: null });
        }}
        title="Disable User Account"
        description={
          disableDialog.isSupporter
            || (disableDialog.adImpact && !disableDialog.adImpact.loading && (
              (disableDialog.adImpact.holdingCount || 0) > 0
              || (disableDialog.adImpact.waitlistCount || 0) > 0
              || (disableDialog.adImpact.withStripe || 0) > 0
            ))
            ? `Disable ${disableDialog.userName}? This is the severe path — advertising and billing for this account may be affected.`
            : `Disable ${disableDialog.userName}? This hides their active activities and comments, turns off digests, and blocks registered features. They will see your note when they sign in.`
        }
        impactDetails={(() => {
          const impact = disableDialog.adImpact;
          const showAdsPath = Boolean(
            disableDialog.isSupporter
            || (impact && !impact.loading && (
              (impact.holdingCount || 0) > 0
              || (impact.waitlistCount || 0) > 0
              || (impact.withStripe || 0) > 0
            ))
          );
          const statusBits = impact?.statusCounts
            ? Object.entries(impact.statusCounts)
              .map(([status, n]) => `${status.replace(/_/g, " ")}: ${n}`)
              .join(", ")
            : "";
          return (
            <>
              <p className="font-medium text-foreground/80">
                {showAdsPath ? "Admin — ads & billing impact" : "Admin — account impact"}
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Active activities and comments are archived (savers get a generic notice).</li>
                <li>Digests turn Off; registered features are blocked.</li>
                {!showAdsPath && (
                  <li>Organizer directory listing is hidden while disabled.</li>
                )}
                {showAdsPath && (
                  <>
                    <li>Slot-holding ads are cancelled; zip slots are released so the waitlist can advance.</li>
                    <li>Stripe subscriptions are set to cancel at period end (may bill through the current paid period, then stop renewing).</li>
                    <li>Auto-renew is turned off; ad waitlist entries for this user are cancelled.</li>
                    <li>They will see this impact explained on the Account Disabled page (and in email if you send one).</li>
                  </>
                )}
              </ul>
              <div className="mt-2 rounded-lg border border-border/60 bg-white/70 px-2.5 py-2 space-y-1">
                <p className="font-medium text-foreground/80">This account’s ads right now</p>
                {impact?.loading ? (
                  <p className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Checking ads and waitlist…
                  </p>
                ) : impact?.error ? (
                  <p className="text-destructive">Could not load ads: {impact.error}</p>
                ) : impact ? (
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>
                      {impact.holdingCount > 0
                        ? `${impact.holdingCount} slot-holding ad${impact.holdingCount === 1 ? "" : "s"} will be cancelled${statusBits ? ` (${statusBits})` : ""}`
                        : "No slot-holding ads to cancel"}
                      {impact.zips?.length
                        ? ` · zip${impact.zips.length === 1 ? "" : "s"} ${impact.zips.join(", ")}`
                        : ""}
                    </li>
                    <li>
                      {impact.withStripe > 0
                        ? `${impact.withStripe} Stripe subscription${impact.withStripe === 1 ? "" : "s"} will be set to cancel at period end`
                        : "No Stripe subscriptions linked on their ads"}
                    </li>
                    <li>
                      {impact.waitlistCount > 0
                        ? `${impact.waitlistCount} open waitlist entr${impact.waitlistCount === 1 ? "y" : "ies"} will be cancelled`
                        : "No open waitlist entries"}
                    </li>
                    {impact.totalAds > 0 && impact.autoRenewOn > 0 ? (
                      <li>
                        Auto-renew will be turned off on {impact.autoRenewOn} ad{impact.autoRenewOn === 1 ? "" : "s"}
                        {disableDialog.isSupporter ? "" : " (only if this account is marked Supporter)"}
                      </li>
                    ) : null}
                    {!disableDialog.isSupporter
                      && ((impact.holdingCount || 0) > 0 || (impact.withStripe || 0) > 0 || (impact.waitlistCount || 0) > 0) ? (
                      <li className="text-amber-800">
                        Account is not marked Supporter — disable will not run the ads/Stripe/waitlist teardown unless you Grant Supporter first (or mark is_advertiser).
                      </li>
                    ) : null}
                  </ul>
                ) : (
                  <p>Ad details unavailable.</p>
                )}
              </div>
            </>
          );
        })()}
        noteLabel="Note to User"
        notePlaceholder="Explain why this account is being disabled…"
        confirmLabel="Disable Account"
        emailMode="optional"
        loading={disableBusy}
        onConfirm={handleDisableUser}
      />

      <AdminNoteConfirmDialog
        open={reactivateDialog.open}
        onOpenChange={(open) => {
          if (!open) setReactivateDialog({ open: false, userId: null, requestId: null, userName: "", isSupporter: false });
        }}
        title="Approve Reactivation"
        description={`Reactivate ${reactivateDialog.userName}? Their prior role is restored and the Flagged Users case is marked Manually Reinstated.`}
        impactDetails={
          reactivateDialog.isSupporter ? (
            <>
              <p className="font-medium text-foreground/80">Admin — what reactivation does / does not restore</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Role restored; organizer directory returns if they were an Organizer.</li>
                <li>Digests stay Off until the user re-enables them.</li>
                <li>Optional checkboxes below can restore activities/comments archived by this disable.</li>
                <li>Cancelled ads are not restored. Stripe cancel-at-period-end is not reversed. Waitlist spots are not restored.</li>
                <li>They will need Ad Manager (new slots / Checkout) to advertise again. The inbox Message will explain this.</li>
              </ul>
            </>
          ) : (
            <>
              <p className="font-medium text-foreground/80">Admin — what reactivation does / does not restore</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Role restored; organizer directory returns if they were an Organizer.</li>
                <li>Digests stay Off until the user re-enables them.</li>
                <li>Optional checkboxes below can restore activities/comments archived by this disable.</li>
                <li>Ads and Stripe (if any) are not restored automatically.</li>
              </ul>
            </>
          )
        }
        noteLabel="Note to User"
        notePlaceholder="Explain why you are approving — included in their inbox Message…"
        noteRequired
        confirmLabel="Reactivate Account"
        confirmVariant="mint"
        emailMode="never"
        deliveryHint="They will receive an inbox Message with your note and a clear summary of what was / was not restored."
        restoreOptions={REACTIVATE_RESTORE_OPTIONS}
        restoreOptionsTitle="Also restore (optional)"
        loading={disableBusy}
        onConfirm={handleApproveReactivation}
      />

      <AdminNoteConfirmDialog
        open={declineDialog.open}
        onOpenChange={(open) => {
          if (!open) setDeclineDialog({ open: false, request: null });
        }}
        title="Decline Reactivation Request"
        description="This closes the request for this disable cycle. The user will see your decline note on the Account Disabled page."
        noteLabel="Note to User"
        notePlaceholder="Explain why this request is being declined…"
        confirmLabel="Decline Request"
        emailMode="never"
        deliveryHint="They will see this note on the Account Disabled page (no email)."
        loading={disableBusy}
        onConfirm={handleDeclineReactivation}
      />

      {noteDialogConfig ? (
        <AdminNoteConfirmDialog
          open={noteDialog.open}
          onOpenChange={(open) => {
            if (!open) closeNoteDialog();
          }}
          title={noteDialogConfig.title}
          description={noteDialogConfig.description}
          noteLabel={noteDialogConfig.noteLabel}
          notePlaceholder={noteDialogConfig.notePlaceholder}
          noteRequired={noteDialogConfig.noteRequired}
          emailMode={noteDialogConfig.emailMode}
          confirmLabel={noteDialogConfig.confirmLabel}
          confirmVariant={noteDialogConfig.confirmVariant || "destructive"}
          loading={noteDialog.busy}
          onConfirm={handleNoteDialogConfirm}
        />
      ) : null}

      <ImagePreviewModal
        imageUrl={userContentPreviewUrl}
        onOpenChange={setUserContentPreviewUrl}
      />
    </div>
  );
}