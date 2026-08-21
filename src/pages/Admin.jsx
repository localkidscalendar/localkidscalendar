import React, { useState, useEffect, useMemo } from "react";
import { useOutletContext, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { apiUrl } from "@/lib/apiBase";
import { formatPhoneDisplay } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, Shield, CalendarDays, Flag, Megaphone, Users, Trash2, Eye, BarChart3, Mail, Image, Clock, DollarSign, Tag, ImagePlus, MapPin, FlaskConical, HelpCircle, MessageSquare, RotateCcw, Check, Undo2, ChevronDown, ChevronUp, ExternalLink, Link2, MoreHorizontal } from "lucide-react";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import AdminNoteConfirmDialog from "@/components/admin/AdminNoteConfirmDialog";
import { restoreRoleFromProfile } from "@/lib/authRoles";
import ImagePreviewModal from "@/components/ads/ImagePreviewModal";
import SearchClearField from "@/components/shared/SearchClearField";

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
import Paginator, { PAGE_SIZE } from "@/components/admin/Paginator";
import {
  disableAdAsset,
  reactivateAdAsset,
  sendAdAssetDisabledEmail,
  markAdAssetDisableNotified,
} from "@/lib/quarantineAdLibrary";
import {
  notifyActivityRemovedAdmin,
  notifyCommentRemovedAdmin,
  notifyAdCreativeDisabledAdmin,
  notifyBecameSupporter,
  notifyAccountReactivated,
  notifyOwnerFlagLifecycle,
} from "@/lib/userMessages";
import moment from "moment";

const PREVIEW_SECTIONS = [
  { id: "previews-emails", label: "Emails" },
  { id: "previews-automated", label: "Automated Messages" },
  { id: "previews-site-notices", label: "Site Notices" },
];

const ADS_SECTIONS = [
  { id: "ads-supporter-ads", label: "Supporter Ads" },
  { id: "ads-zip-config", label: "Zip Config" },
  { id: "ads-waitlist", label: "Waitlist" },
  { id: "ads-rates", label: "Ad Rates" },
  { id: "ads-discounts", label: "Discounts" },
  { id: "ads-default-filler", label: "Default/Filler" },
];

const REVIEW_SECTIONS = [
  { id: "review-activity", label: "Activity Manual Review" },
  { id: "review-advertising", label: "Advertising Manual Review" },
];

const MESSAGE_TYPE_BOXES = [
  { id: "messages-technical", title: "Report Technical Issues", subjects: ["Report Technical Issues"] },
  { id: "messages-general", title: "General Questions", subjects: ["General Questions", "Inquire About Activity Details"] },
  { id: "messages-ideas", title: "Submit New Ideas & Suggestions", subjects: ["Submit New Ideas & Suggestions"] },
];

const MESSAGE_SECTIONS = [
  { id: "messages-technical", label: "Report Technical Issues" },
  { id: "messages-general", label: "General Questions" },
  { id: "messages-ideas", label: "Submit New Ideas & Suggestions" },
  { id: "messages-deleted", label: "Deleted Messages" },
];

const MASS_MESSAGE_SECTIONS = [
  { id: "mass-compose", label: "Compose Mass Message" },
  { id: "mass-archive", label: "Archived Mass Messages" },
  { id: "mass-digest", label: "Digest Notification" },
];

const FLAGS_SECTIONS = [
  { id: "flags-flagged-content", label: "Flagged Content" },
  { id: "flags-flagged-users", label: "Flagged Users" },
  { id: "flags-users-flagging", label: "Top Flagging Activity Ranking" },
];

const FLAGGED_USER_ROLE_FILTERS = [
  { id: "all", label: "All" },
  { id: "community_member", label: "Community Members" },
  { id: "organizer", label: "Organizers" },
  { id: "3plus", label: "3+" },
];

const USER_FLAG_REASON_LABELS = {
  misrepresented_user: "Misrepresented User",
  disregard_rules: "Disregard for Our Community Rules",
  other: "Other",
};

function userFlagReasonLabel(reason) {
  return USER_FLAG_REASON_LABELS[reason] || (reason ? String(reason).replace(/_/g, " ") : "—");
}

const CONTENT_FLAG_REASON_LABELS = {
  inaccurate: "Inaccurate",
  inappropriate: "Inappropriate",
  spam: "Spam",
  other: "Other",
};

function contentFlagReasonLabel(reason) {
  return CONTENT_FLAG_REASON_LABELS[reason] || (reason ? String(reason).replace(/_/g, " ") : "—");
}

const USER_SECTIONS = [
  { id: "users-list", label: "List of Users" },
  { id: "users-reactivation", label: "Reactivation Requests" },
  { id: "users-zip-reports", label: "Zip Code Reports" },
];

const USER_LIST_FILTERS = [
  { id: "all", label: "All" },
  { id: "admin", label: "Admins" },
  { id: "community_member", label: "Community Members" },
  { id: "organizer", label: "Organizers" },
  { id: "supporter", label: "Supporters" },
];

const FLAGGING_ACTIVITY_FILTERS = [
  { id: "all", label: "All" },
  { id: "flagging", label: "Flagging" },
  { id: "being_flagged", label: "Being Flagged" },
];

const KNOWN_MESSAGE_SUBJECTS = new Set(MESSAGE_TYPE_BOXES.flatMap((box) => box.subjects));

function isMessageDeleted(m) {
  return Boolean(m.deleted_at);
}

function isMessageAddressed(m) {
  return m.status === "resolved";
}

function messagesForTypeBox(messages, box) {
  const active = messages.filter((m) => !isMessageDeleted(m));
  if (box.title === "General Questions") {
    return active.filter((m) => box.subjects.includes(m.subject) || !KNOWN_MESSAGE_SUBJECTS.has(m.subject));
  }
  return active.filter((m) => box.subjects.includes(m.subject));
}

function unreadCountForTypeBox(messages, box) {
  return messagesForTypeBox(messages, box).filter((m) => m.status === "unread").length;
}

function formatMessageSubmittedAt(createdDate) {
  const local = moment.utc(createdDate).local();
  return `${local.format("MMM D, YYYY h:mm A")} · ${local.fromNow()}`;
}

/** Status / reason for Admin → All Activities (matches My Posts inactive labels). */
function getActivityStatusMeta(event) {
  const notes = String(event?.admin_notes || "").trim();
  const flags = Number(event?.flag_count || 0);

  if (event?.status === "active") {
    return {
      key: "active",
      label: "Active",
      reason: null,
      chipClass: "bg-mint-50 text-mint-600",
      adminNotes: null,
      canAdminRestore: false,
      isCommunityFlagged: false,
    };
  }

  if (event?.status === "archived" && flags >= 3) {
    return {
      key: "flagged",
      label: "Inactive",
      reason: "Community flags",
      chipClass: "bg-peach-50 text-peach-600",
      adminNotes: null,
      canAdminRestore: false,
      isCommunityFlagged: true,
    };
  }

  if (event?.status === "deleted" && notes) {
    return {
      key: "admin_removed",
      label: "Inactive",
      reason: "Admin removed",
      chipClass: "bg-red-50 text-red-600",
      adminNotes: notes,
      canAdminRestore: true,
      isCommunityFlagged: false,
    };
  }

  if (event?.status === "deleted") {
    return {
      key: "user_deactivated",
      label: "Inactive",
      reason: "User deactivated",
      chipClass: "bg-muted text-muted-foreground",
      adminNotes: null,
      canAdminRestore: false,
      isCommunityFlagged: false,
    };
  }

  if (event?.status === "archived") {
    return {
      key: "archived",
      label: "Inactive",
      reason: "Admin",
      chipClass: "bg-red-50 text-red-600",
      adminNotes: notes || null,
      canAdminRestore: false,
      isCommunityFlagged: false,
    };
  }

  return {
    key: event?.status || "unknown",
    label: event?.status || "Unknown",
    reason: null,
    chipClass: "bg-muted text-muted-foreground",
    adminNotes: notes || null,
    canAdminRestore: false,
    isCommunityFlagged: false,
  };
}

const REACTIVATE_RESTORE_OPTIONS = [
  {
    id: "activities",
    label: "Restore archived activities",
    hint: "Only items archived by this account disable (not 3+ content flags).",
    defaultChecked: false,
  },
  {
    id: "comments",
    label: "Restore archived comments",
    hint: "Only comments archived by this account disable.",
    defaultChecked: false,
  },
];

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
  const closeNoteDialog = () => setNoteDialog({ open: false, mode: null, context: {}, busy: false });

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

  const withCreatedDate = (row) => ({
    ...row,
    created_date: row.created_at || row.created_date,
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [evtsRes, usersRes, msgsRes, orgRes, flagsRes, adsRes, activityReviewRes, adReviewRes, reactivationRes] = await Promise.all([
        supabase.from("events").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("organizers").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("flag_reports").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("banner_ads").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("image_moderation_status", "manual_review"),
        supabase.from("ad_library").select("id", { count: "exact", head: true }).eq("moderation_status", "manual_review"),
        supabase.from("account_reactivation_requests").select("*").order("created_at", { ascending: false }).limit(200),
      ]);

      if (evtsRes.error) throw evtsRes.error;
      if (usersRes.error) throw usersRes.error;
      if (msgsRes.error) throw msgsRes.error;
      if (orgRes.error) throw orgRes.error;
      if (flagsRes.error) throw flagsRes.error;
      if (adsRes.error) throw adsRes.error;

      const evts = (evtsRes.data || []).map(withCreatedDate);
      let flg = (flagsRes.data || []).map(withCreatedDate);
      const adsList = (adsRes.data || []).map(withCreatedDate);
      let usersList = (usersRes.data || []).map((u) => {
        const full_name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
        return { ...withCreatedDate(u), full_name: full_name || u.email || "—" };
      });
      const msgs = (msgsRes.data || []).map(withCreatedDate);
      const orgList = orgRes.data || [];
      const activityReviewCount = activityReviewRes.count || 0;
      const adReviewCount = adReviewRes.count || 0;
      const unreadReviews = activityReviewCount + adReviewCount;
      const reactivationList = reactivationRes.error
        ? []
        : (reactivationRes.data || []).map(withCreatedDate);
      const pendingReactivations = reactivationList.filter((r) => r.status === "pending").length;

      // Ensure reactivation + flagged-user targets are in the Users index (profiles select is capped)
      const reactivationUserIds = [...new Set(reactivationList.map((r) => r.user_id).filter(Boolean))];
      const flaggedUserTargetIds = [
        ...new Set(
          (flg || [])
            .filter((f) => f.target_type === "user" && f.target_id)
            .map((f) => f.target_id)
        ),
      ];
      const knownUserIds = new Set(usersList.map((u) => u.id));
      const missingProfileIds = [...new Set([...reactivationUserIds, ...flaggedUserTargetIds])].filter(
        (id) => !knownUserIds.has(id)
      );
      if (missingProfileIds.length > 0) {
        const { data: missingProfiles } = await supabase
          .from("profiles")
          .select("*")
          .in("id", missingProfileIds);
        for (const u of missingProfiles || []) {
          const full_name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
          usersList.push({ ...withCreatedDate(u), full_name: full_name || u.email || "—" });
          knownUserIds.add(u.id);
        }
      }

      // Pull all user-target flag reports for reactivation users (global flags feed is capped)
      if (reactivationUserIds.length > 0) {
        const { data: reactivationFlags } = await supabase
          .from("flag_reports")
          .select("*")
          .eq("target_type", "user")
          .in("target_id", reactivationUserIds)
          .order("created_at", { ascending: false })
          .limit(500);
        const byId = new Map(flg.map((f) => [f.id, f]));
        for (const row of reactivationFlags || []) {
          byId.set(row.id, withCreatedDate(row));
        }
        flg = Array.from(byId.values()).sort(
          (a, b) =>
            new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0)
        );
      }

      setEvents(evts);
      setFlags(flg);
      setAds(adsList);
      setUsers(usersList);
      setMessages(msgs);
      setReactivationRequests(reactivationList);
      setDisabledUsers(new Set(usersList.filter((u) => u.role === "disabled").map((u) => u.id)));
      const map = {};
      orgList.forEach((o) => { if (o.user_id) map[o.user_id] = o.org_name; });
      setOrganizerMap(map);

      // Per-user contribution index for Admin → Users → Content column
      const userIds = usersList.map((u) => u.id).filter(Boolean);
      const emptyContent = () => ({
        events: [],
        comments: [],
        ads: [],
        activityFlagTotal: 0,
        commentFlagTotal: 0,
        adFlagTotal: 0,
        userFlagCount: 0,
        hasContent: false,
      });
      const contentMap = Object.fromEntries(userIds.map((id) => [id, emptyContent()]));
      usersList.forEach((u) => {
        if (contentMap[u.id]) contentMap[u.id].userFlagCount = Number(u.user_flag_count || 0);
      });

      if (userIds.length > 0) {
        const chunk = (arr, size) => {
          const out = [];
          for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
          return out;
        };
        try {
          for (const ids of chunk(userIds, 100)) {
            const [userEvtsRes, userCommentsRes, userAdsRes] = await Promise.all([
              supabase
                .from("events")
                .select("id, title, zip_code, flag_count, status, created_by_id")
                .in("created_by_id", ids)
                .limit(500),
              supabase
                .from("comments")
                .select("id, content, flag_count, status, created_by_id, event_id")
                .in("created_by_id", ids)
                .neq("status", "deleted")
                .limit(500),
              supabase
                .from("ad_library")
                .select("id, ad_name, flag_count, link_url, image_url, user_id, moderation_status")
                .in("user_id", ids)
                .is("deleted_at", null)
                .limit(500),
            ]);
            for (const e of userEvtsRes.data || []) {
              const bucket = contentMap[e.created_by_id];
              if (!bucket) continue;
              bucket.events.push(e);
              bucket.activityFlagTotal += Number(e.flag_count || 0);
            }
            for (const c of userCommentsRes.data || []) {
              const bucket = contentMap[c.created_by_id];
              if (!bucket) continue;
              bucket.comments.push(c);
              bucket.commentFlagTotal += Number(c.flag_count || 0);
            }
            const adsRows = userAdsRes.data || [];
            const adLibIds = adsRows.map((a) => a.id).filter(Boolean);
            const zipByAdId = {};
            if (adLibIds.length > 0) {
              const { data: placements } = await supabase
                .from("banner_ads")
                .select("ad_library_id, zip_code")
                .in("ad_library_id", adLibIds);
              for (const p of placements || []) {
                if (!p.ad_library_id || !p.zip_code) continue;
                if (!zipByAdId[p.ad_library_id]) zipByAdId[p.ad_library_id] = [];
                if (!zipByAdId[p.ad_library_id].includes(p.zip_code)) {
                  zipByAdId[p.ad_library_id].push(p.zip_code);
                }
              }
            }
            for (const a of adsRows) {
              const bucket = contentMap[a.user_id];
              if (!bucket) continue;
              const zips = zipByAdId[a.id] || [];
              bucket.ads.push({
                ...a,
                zip_code: zips[0] || null,
                zip_codes: zips,
              });
              bucket.adFlagTotal += Number(a.flag_count || 0);
            }
          }
        } catch (contentErr) {
          console.error("Admin user content index failed", contentErr);
        }
      }

      Object.values(contentMap).forEach((bucket) => {
        bucket.hasContent =
          bucket.events.length > 0 || bucket.comments.length > 0 || bucket.ads.length > 0;
      });
      setUserContentById(contentMap);

      setStats({
        totalEvents: evts.filter((e) => e.status === "active").length,
        totalUsers: usersList.length,
        totalFlags: (flagsRes.data || []).filter((f) => f.admin_action !== "flag_cleared").length,
        activeAds: adsList.filter((a) => a.status === "active").length,
        organizers: usersList.filter((u) => u.role === "organizer").length,
        unreadMessages: msgs.filter((m) => !isMessageDeleted(m) && m.status === "unread").length,
        unreadReviews,
        unreadReviewsActivity: activityReviewCount,
        unreadReviewsAds: adReviewCount,
        pendingReactivations,
      });
    } catch (err) {
      console.error("Admin load failed", err);
      toast({ title: "Failed to load admin data", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const refreshReviewCounts = async () => {
    try {
      const [activityReviewRes, adReviewRes] = await Promise.all([
        supabase.from("events").select("id", { count: "exact", head: true }).eq("image_moderation_status", "manual_review"),
        supabase.from("ad_library").select("id", { count: "exact", head: true }).eq("moderation_status", "manual_review"),
      ]);
      const activityReviewCount = activityReviewRes.count || 0;
      const adReviewCount = adReviewRes.count || 0;
      setStats((prev) => ({
        ...prev,
        unreadReviews: activityReviewCount + adReviewCount,
        unreadReviewsActivity: activityReviewCount,
        unreadReviewsAds: adReviewCount,
      }));
    } catch {}
  };

  const handleDeleteEvent = (event) => {
    setNoteDialog({
      open: true,
      mode: "remove_activity",
      context: { event },
      busy: false,
    });
  };

  const executeRemoveActivity = async (event, notes, { flagId = null, deactivatedItem = null } = {}) => {
    const { error } = await supabase.from("events").update({
      status: "deleted",
      admin_notes: notes.trim(),
      updated_at: new Date().toISOString(),
    }).eq("id", event.id);
    if (error) {
      toast({ title: "Failed to remove activity", description: error.message, variant: "destructive" });
      return false;
    }
    void notifyActivityRemovedAdmin(event, notes.trim());
    if (flagId) {
      const { error: historyError } = await recordFlagAdminAction(flagId, "manually_deactivated");
      if (historyError) {
        toast({ title: "Removed, but failed to record admin action", description: historyError.message, variant: "destructive" });
      }
    }
    if (deactivatedItem) {
      const { error: historyError } = await recordDeactivatedCaseAction(deactivatedItem, "manually_deactivated");
      if (historyError) {
        toast({ title: "Removed, but failed to record admin action", description: historyError.message, variant: "destructive" });
      }
    }
    toast({ title: "Activity removed" });
    return true;
  };

  const executeDeactivateComment = async (comment, notes, { flagId = null, deactivatedItem = null } = {}) => {
    const { error } = await supabase.from("comments").update({
      status: "archived",
      updated_at: new Date().toISOString(),
    }).eq("id", comment.id);
    if (error) {
      toast({ title: "Failed to deactivate comment", description: error.message, variant: "destructive" });
      return false;
    }
    void notifyCommentRemovedAdmin(comment, notes.trim());
    if (flagId) {
      const { error: historyError } = await recordFlagAdminAction(flagId, "manually_deactivated");
      if (historyError) {
        toast({ title: "Deactivated, but failed to record admin action", description: historyError.message, variant: "destructive" });
      }
    }
    if (deactivatedItem) {
      const { error: historyError } = await recordDeactivatedCaseAction(deactivatedItem, "manually_deactivated");
      if (historyError) {
        toast({ title: "Deactivated, but failed to record admin action", description: historyError.message, variant: "destructive" });
      }
    }
    toast({ title: "Comment deactivated" });
    return true;
  };

  const executeDeactivateAd = async (targetId, notes, { flagId = null, deactivatedItem = null } = {}) => {
    const reason = notes.trim();
    const { data: disableResult, error } = await disableAdAsset(targetId, reason);
    if (error) {
      toast({ title: "Failed to deactivate", description: error.message, variant: "destructive" });
      return false;
    }
    if (disableResult && !disableResult.already_disabled) {
      await sendAdAssetDisabledEmail({
        userId: disableResult.user_id,
        businessName: disableResult.business_name,
        zipCodes: disableResult.zip_codes || [],
        reason,
        templateKey: "ad_flagged_admin",
      });
      await notifyAdCreativeDisabledAdmin({
        userId: disableResult.user_id,
        businessName: disableResult.business_name,
        zipCodes: disableResult.zip_codes || [],
        reason,
      });
      await markAdAssetDisableNotified(disableResult.asset_ids || []);
    }
    if (flagId) {
      const { error: historyError } = await recordFlagAdminAction(flagId, "manually_deactivated");
      if (historyError) {
        toast({ title: "Deactivated, but failed to record admin action", description: historyError.message, variant: "destructive" });
      }
    }
    if (deactivatedItem) {
      const { error: historyError } = await recordDeactivatedCaseAction(deactivatedItem, "manually_deactivated");
      if (historyError) {
        toast({ title: "Deactivated, but failed to record admin action", description: historyError.message, variant: "destructive" });
      }
    }
    toast({ title: "Ad creative disabled" });
    return true;
  };

  const updateMessageStatus = async (id, status) => {
    const { error } = await supabase
      .from("contact_messages")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else loadAll();
  };

  const toggleMessageAddressed = async (m) => {
    await updateMessageStatus(m.id, isMessageAddressed(m) ? "unread" : "resolved");
  };

  const softDeleteMessage = async (m) => {
    if (!window.confirm("Delete this message? It will move to Deleted Messages.")) return;
    const { error } = await supabase
      .from("contact_messages")
      .update({
        deleted_at: new Date().toISOString(),
        status: "resolved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", m.id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else loadAll();
  };

  const restoreMessage = async (m) => {
    const { error } = await supabase
      .from("contact_messages")
      .update({
        deleted_at: null,
        status: "unread",
        updated_at: new Date().toISOString(),
      })
      .eq("id", m.id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else loadAll();
  };

  const [eventMap, setEventMap] = useState({});
  const [deletedItems, setDeletedItems] = useState([]);

  useEffect(() => {
    if (flags.length > 0) loadEventTitles();
  }, [flags]);

  useEffect(() => {
    loadDeletedItems();
  }, [events, flags]);

  const loadEventTitles = async () => {
    try {
      const eventIds = [...new Set(flags.filter((f) => f.target_type === "event").map((f) => f.target_id))];
      const commentIds = [...new Set(flags.filter((f) => f.target_type === "comment").map((f) => f.target_id))];
      const adIds = [...new Set(flags.filter((f) => f.target_type === "ad").map((f) => f.target_id))];
      const titles = {};

      if (eventIds.length) {
        const { data } = await supabase
          .from("events")
          .select("id, title, zip_code, status, flag_count, flag_case_admin_action, flag_case_admin_history, created_by_id, org_name, updated_at, created_at")
          .in("id", eventIds);
        (data || []).forEach((e) => {
          titles[e.id] = {
            type: "event",
            title: e.title,
            zip_code: e.zip_code,
            status: e.status,
            flag_count: e.flag_count,
            flag_case_admin_action: e.flag_case_admin_action,
            flag_case_admin_history: e.flag_case_admin_history,
            created_by_id: e.created_by_id,
            org_name: e.org_name,
            updated_at: e.updated_at,
            created_at: e.created_at,
          };
        });
      }

      if (commentIds.length) {
        const { data: comments } = await supabase
          .from("comments")
          .select("id, content, event_id, status, flag_count, flag_case_admin_action, flag_case_admin_history, created_by_id, author_name, updated_at, created_at")
          .in("id", commentIds);
        for (const c of comments || []) {
          titles[c.id] = {
            type: "comment",
            content: c.content,
            event_id: c.event_id,
            status: c.status,
            flag_count: c.flag_count,
            flag_case_admin_action: c.flag_case_admin_action,
            flag_case_admin_history: c.flag_case_admin_history,
            created_by_id: c.created_by_id,
            author_name: c.author_name,
            updated_at: c.updated_at,
            created_at: c.created_at,
          };
          if (c.event_id && !titles[c.event_id]) {
            const { data: e } = await supabase.from("events").select("id, title, zip_code, status").eq("id", c.event_id).maybeSingle();
            if (e) titles[e.id] = { type: "event", title: e.title, zip_code: e.zip_code, status: e.status };
          }
        }
      }

      if (adIds.length) {
        // Flags target Ad Library assets; fall back to placements for any unmigrated rows.
        const { data: assets } = await supabase
          .from("ad_library")
          .select("id, ad_name, business_name, moderation_status, status, image_url, link_url, flag_count, flag_case_admin_action, flag_case_admin_history, user_id, updated_at, created_at")
          .in("id", adIds);
        (assets || []).forEach((a) => {
          titles[a.id] = {
            type: "ad",
            title: a.ad_name || "Ad Asset",
            ad_name: a.ad_name,
            business_name: a.business_name,
            status: a.moderation_status || a.status,
            moderation_status: a.moderation_status,
            image_url: a.image_url,
            link_url: a.link_url,
            flag_count: a.flag_count,
            flag_case_admin_action: a.flag_case_admin_action,
            flag_case_admin_history: a.flag_case_admin_history,
            user_id: a.user_id,
            updated_at: a.updated_at,
            created_at: a.created_at,
          };
        });
        const { data: placements } = await supabase
          .from("banner_ads")
          .select("ad_library_id, zip_code")
          .in("ad_library_id", adIds);
        for (const p of placements || []) {
          if (!p.ad_library_id || !titles[p.ad_library_id] || !p.zip_code) continue;
          const existing = titles[p.ad_library_id].zip_codes || [];
          if (!existing.includes(p.zip_code)) existing.push(p.zip_code);
          titles[p.ad_library_id].zip_codes = existing;
          titles[p.ad_library_id].zip_code = existing[0] || null;
        }
        const missing = adIds.filter((id) => !titles[id]);
        if (missing.length) {
          const { data: adRows } = await supabase
            .from("banner_ads")
            .select("id, business_name, status, zip_code, image_url, link_url, ad_library_id")
            .in("id", missing);
          (adRows || []).forEach((a) => {
            titles[a.id] = {
              type: "ad",
              title: a.business_name,
              status: a.status,
              zip_code: a.zip_code,
              image_url: a.image_url,
              link_url: a.link_url,
              asset_id: a.ad_library_id,
            };
          });
        }
      }
      setEventMap(titles);
    } catch {}
  };

  const loadDeletedItems = async () => {
    try {
      // Content that hit the 3-flag threshold (stays listed after Override 3+ while flag_count >= 3)
      const [{ data: multiFlagEvents }, { data: multiFlagComments }, { data: multiFlagAds }] = await Promise.all([
        supabase.from("events").select("*").gte("flag_count", 3).order("created_at", { ascending: false }).limit(50),
        supabase.from("comments").select("*").gte("flag_count", 3).order("created_at", { ascending: false }).limit(50),
        supabase.from("ad_library").select("*").gte("flag_count", 3).is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
      ]);
      const activeFlagReports = (targetId, targetType) =>
        flags.filter(
          (f) =>
            f.target_id === targetId &&
            f.target_type === targetType &&
            f.admin_action !== "flag_cleared"
        );
      const itemsWithFlags = (multiFlagEvents || []).map((e) => ({
        type: "event",
        item: withCreatedDate(e),
        flags: activeFlagReports(e.id, "event"),
      }));
      const commentsWithFlags = (multiFlagComments || []).map((c) => ({
        type: "comment",
        item: withCreatedDate(c),
        flags: activeFlagReports(c.id, "comment"),
        eventTitle: eventMap[c.event_id]?.title || "—",
      }));
      const adsWithFlags = (multiFlagAds || []).map((a) => ({
        type: "ad",
        item: withCreatedDate(a),
        flags: activeFlagReports(a.id, "ad"),
      }));
      setDeletedItems([...itemsWithFlags, ...commentsWithFlags, ...adsWithFlags]);
    } catch {}
  };

  const handleAdStatus = async (id, status) => {
    const { error } = await supabase.from("banner_ads").update({
      status,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) {
      toast({ title: "Failed to update ad", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Ad ${status}` });
    loadAll();
  };

  const handleReactivateItem = async (itemId, itemType, opts = {}) => {
    const table = itemType === "event" ? "events" : itemType === "comment" ? "comments" : "banner_ads";
    if (itemType === "event") {
      const notes = String(opts.adminNotes || "").trim();
      if (!notes) {
        toast({
          title: "Can't restore from here",
          description: "This activity was deactivated by the user. They can reactivate it from My Posts.",
          variant: "destructive",
        });
        return;
      }
      const title = opts.title || "this activity";
      if (!window.confirm(`Restore "${title}"?\n\nThis was removed by an admin and will become visible on the public site again.`)) {
        return;
      }
    }
    const updates = { status: "active", updated_at: new Date().toISOString() };
    if (itemType === "event") updates.admin_notes = "";
    const { error } = await supabase.from(table).update(updates).eq("id", itemId);
    if (error) {
      toast({ title: "Failed to reactivate", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: `${itemType === "event" ? "Activity" : itemType === "comment" ? "Comment" : "Ad"} reactivated`,
    });
    loadAll();
  };

  const openFlagsForActivity = (event) => {
    setFlagSearch(event?.title || "");
    setFlagTypeFilter("event");
    setFlagsSection("flags-flagged-content");
    setFlaggedContentPage(1);
    setActiveTab("flags");
  };

  const openUserInUsersList = (email) => {
    const value = (email || "").trim();
    setUserSearch(value);
    setUserSearchExactEmail(Boolean(value));
    setUsersSection("users-list");
    setUsersPage(1);
    setActiveTab("users");
  };

  const toggleEventNotes = (eventId) => {
    setExpandedEventNotes((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const openDisableUserDialog = (userId, userName, isSupporter = false, source = "users_list") => {
    setDisableDialog({
      open: true,
      userId,
      userName: userName || "this user",
      isSupporter: Boolean(isSupporter),
      source: source === "flagged_users" ? "flagged_users" : "users_list",
    });
  };

  const openReactivateUserDialog = (userId, { requestId = null, userName = "" } = {}) => {
    const profile = users.find((u) => u.id === userId);
    const name =
      userName
      || organizerMap[userId]
      || profile?.full_name
      || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim()
      || profile?.email
      || "this user";
    setReactivateDialog({
      open: true,
      userId,
      requestId,
      userName: name,
      isSupporter: Boolean(profile?.is_advertiser),
    });
  };

  const handleDisableUser = async (note, { sendEmail } = {}) => {
    const userId = disableDialog.userId;
    if (!userId) return;
    const profile = users.find((u) => u.id === userId);
    const currentRole = profile?.role;
    const priorRole =
      currentRole && currentRole !== "disabled" && ["community_member", "organizer", "admin"].includes(currentRole)
        ? (currentRole === "admin" ? "community_member" : currentRole)
        : (profile?.role_before_disabled || "community_member");

    setDisableBusy(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("You must be signed in.");

      const res = await fetch(apiUrl("/api/admin-disable-user"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          note,
          prior_role: priorRole,
          send_email: Boolean(sendEmail),
          disable_source: disableDialog.source || "users_list",
        }),
      });
      const raw = await res.text();
      let payload = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = {};
      }
      if (!res.ok) {
        throw new Error(payload.error || (raw && raw.length < 200 ? raw : null) || `Request failed (${res.status})`);
      }

      const contentNote = [
        payload.activities_hidden ? `${payload.activities_hidden} activit${payload.activities_hidden === 1 ? "y" : "ies"} hidden` : null,
        payload.comments_hidden ? `${payload.comments_hidden} comment${payload.comments_hidden === 1 ? "" : "s"} hidden` : null,
      ].filter(Boolean).join(", ");
      const supporterNote = payload.is_supporter
        ? ` Ads cancelled: ${payload.ads_cancelled || 0}. Waitlist released: ${payload.waitlist_released || 0}.`
        : " Digest notifications turned off.";
      toast({
        title: "User account disabled",
        description: [
          payload.is_supporter ? `Full Supporter disable applied.${supporterNote}` : supporterNote.trim(),
          contentNote ? ` ${contentNote}.` : "",
          payload.email_sent
            ? " Email sent."
            : sendEmail
              ? ` Email not sent${payload.email_error ? `: ${payload.email_error}` : "."}`
              : "",
        ].join(""),
        variant: sendEmail && !payload.email_sent ? "destructive" : undefined,
      });
      setDisableDialog({ open: false, userId: null, userName: "", isSupporter: false, source: "users_list" });
      setDisabledUsers((prev) => new Set([...prev, userId]));
      setUsers((prev) => prev.map((u) => (
        u.id === userId
          ? {
            ...u,
            role: "disabled",
            role_before_disabled: payload.prior_role || priorRole,
            disabled_note: note,
            disabled_at: new Date().toISOString(),
            user_flag_case_admin_action: "manually_deactivated",
            user_flag_case_admin_history: [
              ...(Array.isArray(u.user_flag_case_admin_history) ? u.user_flag_case_admin_history : []),
              {
                action: "manually_deactivated",
                at: new Date().toISOString(),
                by: "Admin",
                scope: "account_disabled",
                source: disableDialog.source || "users_list",
                note: note || null,
              },
            ],
          }
          : u
      )));
    } catch (err) {
      toast({
        title: "Failed to disable user",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDisableBusy(false);
    }
  };

  const handleApproveReactivation = async (note, { restore } = {}) => {
    const userId = reactivateDialog.userId;
    const requestId = reactivateDialog.requestId;
    if (!userId) return;
    const profile = users.find((u) => u.id === userId);
    const restoreRole = restoreRoleFromProfile(profile);
    const roleLabel =
      restoreRole === "organizer"
        ? "Organizer"
        : restoreRole === "admin"
          ? "Admin"
          : "Community Member";
    const restoreActivities = Boolean(restore?.activities);
    const restoreComments = Boolean(restore?.comments);

    setDisableBusy(true);
    const now = new Date().toISOString();
    const priorHistory = Array.isArray(profile?.user_flag_case_admin_history)
      ? profile.user_flag_case_admin_history
      : [];
    const reinstateEntry = {
      action: "manually_reinstated",
      at: now,
      by: "Admin",
      scope: "account_reactivated",
      note: note || null,
      restore: {
        activities: restoreActivities,
        comments: restoreComments,
      },
    };
    const nextHistory = [...priorHistory, reinstateEntry];

    const { error } = await supabase.from("profiles").update({
      role: restoreRole,
      role_before_disabled: null,
      disabled_note: null,
      disabled_at: null,
      disabled_by: null,
      user_flag_case_admin_action: "manually_reinstated",
      user_flag_case_admin_history: nextHistory,
      updated_at: now,
    }).eq("id", userId);
    if (error) {
      setDisableBusy(false);
      toast({ title: "Failed to reactivate user", description: error.message, variant: "destructive" });
      return;
    }

    if (requestId) {
      await supabase.from("account_reactivation_requests").update({
        status: "reactivated",
        admin_note: note || null,
        reviewed_at: now,
        reviewed_by: user?.id || null,
        updated_at: now,
      }).eq("id", requestId).eq("status", "pending");
    } else {
      await supabase.from("account_reactivation_requests").update({
        status: "reactivated",
        admin_note: note || null,
        reviewed_at: now,
        reviewed_by: user?.id || null,
        updated_at: now,
      }).eq("user_id", userId).eq("status", "pending");
    }

    let activitiesRestored = 0;
    let commentsRestored = 0;
    const restoreStamp = {
      action: "reactivated",
      at: now,
      by: "Admin",
      scope: "account_reactivated",
      note: note || null,
    };
    const ACCOUNT_DISABLE_NOTE = "Removed after the poster's account was disabled.";

    if (restoreActivities) {
      const { data: archivedEvents } = await supabase
        .from("events")
        .select("id, flag_case_admin_history, admin_notes, flag_case_admin_action")
        .eq("created_by_id", userId)
        .eq("status", "archived");
      for (const event of archivedEvents || []) {
        const history = Array.isArray(event.flag_case_admin_history) ? event.flag_case_admin_history : [];
        const fromAccountDisable =
          event.admin_notes === ACCOUNT_DISABLE_NOTE
          || history.some((e) => e?.scope === "account_disabled");
        if (!fromAccountDisable) continue;
        const { error: eventError } = await supabase
          .from("events")
          .update({
            status: "active",
            admin_notes: "",
            flag_case_admin_action: "reactivated",
            flag_case_admin_history: [...history, restoreStamp],
            updated_at: now,
          })
          .eq("id", event.id)
          .eq("status", "archived");
        if (!eventError) activitiesRestored += 1;
      }
    }

    if (restoreComments) {
      const { data: archivedComments } = await supabase
        .from("comments")
        .select("id, flag_case_admin_history, flag_case_admin_action")
        .eq("created_by_id", userId)
        .eq("status", "archived");
      for (const comment of archivedComments || []) {
        const history = Array.isArray(comment.flag_case_admin_history) ? comment.flag_case_admin_history : [];
        const fromAccountDisable =
          history.some((e) => e?.scope === "account_disabled")
          || (comment.flag_case_admin_action === "manually_deactivated" && history.length === 0);
        if (!fromAccountDisable) continue;
        const { error: commentError } = await supabase
          .from("comments")
          .update({
            status: "active",
            flag_case_admin_action: "reactivated",
            flag_case_admin_history: [...history, restoreStamp],
            updated_at: now,
          })
          .eq("id", comment.id)
          .eq("status", "archived");
        if (!commentError) commentsRestored += 1;
      }
    }

    const { error: msgError } = await notifyAccountReactivated(userId, {
      adminNote: note,
      isSupporter: Boolean(profile?.is_advertiser),
      restoredActivities: activitiesRestored,
      restoredComments: commentsRestored,
    });
    setDisableBusy(false);
    setReactivateDialog({ open: false, userId: null, requestId: null, userName: "", isSupporter: false });
    const restoreBits = [
      activitiesRestored ? `${activitiesRestored} activit${activitiesRestored === 1 ? "y" : "ies"}` : null,
      commentsRestored ? `${commentsRestored} comment${commentsRestored === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    const restoreNote = restoreBits.length ? ` Restored: ${restoreBits.join(", ")}.` : "";
    if (msgError) {
      toast({
        title: `User reactivated as ${roleLabel}`,
        description: `Inbox notice failed to send — you may Message them manually.${restoreNote}`,
        variant: "destructive",
      });
    } else {
      toast({
        title: `User reactivated as ${roleLabel}`,
        description: `Inbox notice sent.${restoreNote}`,
      });
    }
    setDisabledUsers((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
    setUsers((prev) => prev.map((u) => (
      u.id === userId
        ? {
          ...u,
          role: restoreRole,
          role_before_disabled: null,
          disabled_note: null,
          disabled_at: null,
          disabled_by: null,
          user_flag_case_admin_action: "manually_reinstated",
          user_flag_case_admin_history: nextHistory,
        }
        : u
    )));
    setReactivationRequests((prev) => prev.map((r) => {
      if (requestId && r.id === requestId) {
        return { ...r, status: "reactivated", admin_note: note || null, reviewed_at: now, reviewed_by: user?.id || null };
      }
      if (!requestId && r.user_id === userId && r.status === "pending") {
        return { ...r, status: "reactivated", admin_note: note || null, reviewed_at: now, reviewed_by: user?.id || null };
      }
      return r;
    }));
    if (restoreActivities || restoreComments) {
      loadAll();
    }
  };

  const handleDeclineReactivation = async (note) => {
    const req = declineDialog.request;
    if (!req) return;
    setDisableBusy(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("account_reactivation_requests").update({
      status: "declined",
      admin_note: note,
      reviewed_at: now,
      reviewed_by: user?.id || null,
      updated_at: now,
    }).eq("id", req.id).eq("status", "pending");
    if (!error) {
      await supabase.from("profiles").update({
        disabled_note: note,
        updated_at: now,
      }).eq("id", req.user_id);
    }
    setDisableBusy(false);
    if (error) {
      toast({ title: "Failed to decline request", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Reactivation request declined" });
    setDeclineDialog({ open: false, request: null });
    setUsers((prev) => prev.map((u) => (
      u.id === req.user_id ? { ...u, disabled_note: note } : u
    )));
    setReactivationRequests((prev) => prev.map((r) => (
      r.id === req.id
        ? { ...r, status: "declined", admin_note: note, reviewed_at: now, reviewed_by: user?.id || null }
        : r
    )));
  };

  const adminActionLabel = {
    manually_deactivated: "Manually Deactivated",
    manually_reinstated: "Manually Reinstated",
    flag_cleared: "Flag Cleared",
    flags_cleared: "Flags Cleared",
    reviewed: "Reviewed",
    overridden: "Override 3+",
    reactivated: "Reactivated",
    flag_reactivated: "Flag Reactivated",
    unreviewed: "Marked Unreviewed",
  };

  const normalizeFlagCaseAction = (action) =>
    String(action || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

  // Match card “white / closed” styling used in Flagged Content / Flagged Users
  const isContentFlagCaseClosed = (caseAction) =>
    ["reviewed", "flags_cleared", "manually_deactivated", "overridden"].includes(
      normalizeFlagCaseAction(caseAction)
    );

  const isUserFlagCaseClosed = (caseAction) =>
    ["reviewed", "flags_cleared", "manually_deactivated", "manually_reinstated"].includes(
      normalizeFlagCaseAction(caseAction)
    );

  const adminName = () => {
    const fromProfile = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
    return fromProfile || user?.full_name || user?.email || "Admin";
  };

  const getFlagHistory = (report) =>
    Array.isArray(report?.admin_action_history) ? report.admin_action_history : [];

  // Flagged Content cards use case history on the target item
  const getDeactivatedCaseHistory = (item) =>
    Array.isArray(item?.item?.flag_case_admin_history) ? item.item.flag_case_admin_history : [];

  const getUserFlagCaseHistory = (profile) =>
    Array.isArray(profile?.user_flag_case_admin_history) ? profile.user_flag_case_admin_history : [];

  const REOPEN_FLAG_ACTIONS = new Set(["reactivated", "overridden", "flag_reactivated", "unreviewed"]);

  const buildFlagDispositionUpdate = (report, action, scope = "flagged_content") => {
    const history = [
      ...getFlagHistory(report),
      {
        action,
        at: new Date().toISOString(),
        by: adminName(),
        scope,
      },
    ];

    const updates = { admin_action_history: history };
    if (REOPEN_FLAG_ACTIONS.has(action)) {
      // Flagged Content: re-open so Manually Deactivate / Clear Flag / Reviewed show again
      updates.admin_action = null;
      updates.reviewed = false;
    } else {
      updates.admin_action = action;
      updates.reviewed = true;
    }
    return updates;
  };

  const recordFlagAdminAction = async (flagId, action, scope = "flagged_content") => {
    const report = flags.find((f) => f.id === flagId);
    if (!report) return { error: { message: "Flag report not found" } };

    const updates = buildFlagDispositionUpdate(report, action, scope);
    const primary = await supabase.from("flag_reports").update(updates).eq("id", flagId);
    if (!primary.error) return primary;

    // Fallback if admin_action_history column has not been migrated yet
    const missingHistoryColumn =
      /admin_action_history/i.test(primary.error.message || "") ||
      primary.error.code === "PGRST204";
    if (!missingHistoryColumn) return primary;

    const { admin_action_history: _omit, ...fallback } = updates;
    const secondary = await supabase.from("flag_reports").update(fallback).eq("id", flagId);
    if (!secondary.error) {
      toast({
        title: "Action saved, but history column is missing",
        description: "Run supabase/migrations/20260726130000_flag_admin_action_history.sql in Supabase so Admin History persists.",
        variant: "destructive",
      });
    }
    return secondary;
  };

  const recordUserFlagCaseAction = async (profileId, actionOrActions) => {
    const profile = users.find((u) => u.id === profileId);
    if (!profile) return { error: { message: "User not found" } };
    const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions];
    const now = new Date().toISOString();
    const history = [
      ...getUserFlagCaseHistory(profile),
      ...actions.map((action) => ({
        action,
        at: now,
        by: adminName(),
        scope: "flagged_user",
      })),
    ];
    const lastAction = actions[actions.length - 1];
    const caseActionValue = lastAction === "unreviewed" ? null : lastAction;
    const updates = {
      user_flag_case_admin_history: history,
      user_flag_case_admin_action: caseActionValue,
      updated_at: now,
    };
    const result = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", profileId)
      .select("id, user_flag_case_admin_action, user_flag_case_admin_history")
      .maybeSingle();
    if (result.error) return result;
    if (!result.data) {
      return { error: { message: "Could not update flag case — no profile row updated (check Admin role)." } };
    }

    // Keep nested report rows in sync so the card body is not stuck peach after Reviewed
    const closingCase =
      caseActionValue === "reviewed"
      || caseActionValue === "flags_cleared"
      || caseActionValue === "manually_reinstated";
    const reopeningCase = lastAction === "unreviewed";
    if (closingCase || reopeningCase) {
      const reportIds = flags
        .filter((f) => f.target_type === "user" && f.target_id === profileId && f.admin_action !== "flag_cleared")
        .map((f) => f.id);
      if (reportIds.length > 0) {
        const reportUpdates = closingCase
          ? { reviewed: true, updated_at: now }
          : { reviewed: false, updated_at: now };
        const reportsResult = await supabase
          .from("flag_reports")
          .update(reportUpdates)
          .in("id", reportIds);
        if (!reportsResult.error) {
          setFlags((prev) => prev.map((f) => (
            reportIds.includes(f.id) ? { ...f, ...reportUpdates } : f
          )));
        }
      }
    }

    setUsers((prev) => prev.map((u) => (
      u.id === profileId
        ? {
          ...u,
          user_flag_case_admin_history: result.data.user_flag_case_admin_history ?? history,
          user_flag_case_admin_action: result.data.user_flag_case_admin_action ?? caseActionValue,
        }
        : u
    )));
    return result;
  };

  const handleClearUserFlag = (flagId) => {
    const report = flags.find((f) => f.id === flagId);
    if (!report || report.target_type !== "user") return;
    setNoteDialog({
      open: true,
      mode: "clear_user_flag",
      context: { flagId, report },
      busy: false,
    });
  };

  const executeClearUserFlag = async (flagId, report, notes) => {
    const { error } = await supabase.rpc("admin_clear_flag", {
      p_flag_id: flagId,
      p_details: notes || null,
    });
    if (error) {
      toast({ title: "Failed to clear flag", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Flag cleared" });
    return true;
  };

  const handleClearUserFlags = (card) => {
    const uncleared = (card.flags || []).filter((f) => f.admin_action !== "flag_cleared");
    if (uncleared.length === 0) {
      toast({ title: "No flags to clear" });
      return;
    }
    setNoteDialog({
      open: true,
      mode: "clear_user_flags",
      context: { card, uncleared },
      busy: false,
    });
  };

  const executeClearUserFlags = async (card, uncleared, notes) => {
    const { error } = await supabase.rpc("admin_clear_all_flags", {
      p_target_type: "user",
      p_target_id: card.userId,
      p_details: notes || null,
    });
    if (error) {
      toast({ title: "Failed to clear flags", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Flags cleared", description: "Account reinstated and marked as reviewed." });
    return true;
  };

  const handleUserFlagReviewed = async (card) => {
    const { error } = await recordUserFlagCaseAction(card.userId, "reviewed");
    if (error) {
      toast({ title: "Failed to mark reviewed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Marked as reviewed" });
    loadAll();
  };

  const handleUserFlagMarkUnreviewed = async (card) => {
    const { error } = await recordUserFlagCaseAction(card.userId, "unreviewed");
    if (error) {
      toast({ title: "Failed to mark unreviewed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Marked as unreviewed" });
    loadAll();
  };

  const recordDeactivatedCaseAction = async (item, actionOrActions) => {
    const table = item.type === "event" ? "events" : item.type === "comment" ? "comments" : "ad_library";
    const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions];
    const now = new Date().toISOString();
    const history = [
      ...getDeactivatedCaseHistory(item),
      ...actions.map((action) => ({
        action,
        at: now,
        by: adminName(),
        scope: "deactivated_content",
      })),
    ];
    const lastAction = actions[actions.length - 1];
    const updates = {
      flag_case_admin_history: history,
      flag_case_admin_action: lastAction === "unreviewed" ? null : lastAction,
      updated_at: now,
    };
    const result = await supabase.from(table).update(updates).eq("id", item.item.id);
    if (!result.error) {
      item.item.flag_case_admin_history = history;
      item.item.flag_case_admin_action = updates.flag_case_admin_action;
    }
    return result;
  };

  const isDeactivatedItemHidden = (item) =>
    item.type === "ad"
      ? item.item.moderation_status === "flagged" || item.item.status === "flagged"
      : item.item.status === "archived";

  const resolveDeactivatedContributor = (item) => {
    if (item.type === "event") {
      if (item.item.org_name) return item.item.org_name;
      if (item.item.created_by_id && organizerMap[item.item.created_by_id]) return organizerMap[item.item.created_by_id];
      const profile = users.find((u) => u.id === item.item.created_by_id);
      const fromProfile = profile
        ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || profile.full_name || ""
        : "";
      return fromProfile || "—";
    }
    if (item.type === "comment") {
      return item.item.author_name || "—";
    }
    return item.item.ad_name || item.item.business_name || item.flags?.[0]?.target_contributor_name || "—";
  };

  const resolveOwnerIdForFlagItem = (item) => {
    if (!item?.item) return null;
    if (item.type === "event" || item.type === "comment") return item.item.created_by_id || null;
    return item.item.user_id || null;
  };

  const resolveItemLabelForFlagItem = (item) => {
    if (!item?.item) return null;
    if (item.type === "event") return item.item.title || null;
    if (item.type === "ad") return item.item.ad_name || item.item.business_name || null;
    return null;
  };

  const notifyOwnerAfterFlagAdminAction = async (item, event) => {
    const userId = resolveOwnerIdForFlagItem(item);
    if (!userId) return;
    await notifyOwnerFlagLifecycle({
      userId,
      targetType: item.type,
      targetId: item.item.id,
      event,
      flagCount: Number(item.item.flag_count || 0),
      itemLabel: resolveItemLabelForFlagItem(item),
    });
  };

  const handleDeactivatedOverride = async (item) => {
    const targetType = item.type;
    const targetId = item.item.id;
    const label = targetType === "event" ? "activity" : targetType === "comment" ? "comment" : "ad creative";
    if (!window.confirm(
      `Override 3+ for this ${label}?\n\nIt will go live again, and community flags will no longer auto-hide it. Users can still flag it for Admin review. You can still manually deactivate it later.`
    )) return;

    let error;
    if (targetType === "ad") {
      ({ error } = await reactivateAdAsset(targetId));
      if (!error) {
        ({ error } = await supabase.from("ad_library").update({
          flag_auto_hide_exempt: true,
          updated_at: new Date().toISOString(),
        }).eq("id", targetId));
      }
    } else {
      const table = targetType === "event" ? "events" : "comments";
      const updates = {
        status: "active",
        flag_auto_hide_exempt: true,
        updated_at: new Date().toISOString(),
      };
      if (targetType === "event") updates.admin_notes = "";
      ({ error } = await supabase.from(table).update(updates).eq("id", targetId));
    }
    if (error) {
      toast({ title: "Failed to override", description: error.message, variant: "destructive" });
      return;
    }
    const { error: historyError } = await recordDeactivatedCaseAction(item, ["overridden", "reviewed"]);
    if (historyError) {
      toast({ title: "Override applied, but failed to record admin action", description: historyError.message, variant: "destructive" });
      loadAll();
      return;
    }
    await notifyOwnerAfterFlagAdminAction(item, "overridden");
    toast({
      title: "Override 3+ applied",
      description: targetType === "ad"
        ? "The creative is live again, protected from community auto-hide, and marked reviewed."
        : "The item is live again, protected from community auto-hide, and marked reviewed.",
    });
    loadAll();
  };

  const handleDeactivatedManuallyDeactivate = (item) => {
    if (item.type === "ad") {
      setNoteDialog({
        open: true,
        mode: "deactivate_ad",
        context: { targetId: item.item.id, deactivatedItem: item },
        busy: false,
      });
      return;
    }
    if (item.type === "comment") {
      setNoteDialog({
        open: true,
        mode: "deactivate_comment",
        context: { comment: item.item, deactivatedItem: item },
        busy: false,
      });
      return;
    }
    setNoteDialog({
      open: true,
      mode: "remove_activity",
      context: { event: item.item, deactivatedItem: item },
      busy: false,
    });
  };

  const handleDeactivatedReviewed = async (item) => {
    const { error } = await recordDeactivatedCaseAction(item, "reviewed");
    if (error) {
      toast({ title: "Failed to mark reviewed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Marked as reviewed" });
    loadAll();
  };

  const handleDeactivatedMarkUnreviewed = async (item) => {
    const { error } = await recordDeactivatedCaseAction(item, "unreviewed");
    if (error) {
      toast({ title: "Failed to mark unreviewed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Marked as unreviewed" });
    loadAll();
  };

  const handleReactivateFromFlag = async (flagId, targetId, targetType, deactivatedItem = null) => {
    let error;
    if (targetType === "ad") {
      ({ error } = await reactivateAdAsset(targetId));
    } else {
      const table = targetType === "event" ? "events" : "comments";
      const updates = { status: "active", updated_at: new Date().toISOString() };
      if (targetType === "event") updates.admin_notes = "";
      ({ error } = await supabase.from(table).update(updates).eq("id", targetId));
    }
    if (error) {
      toast({ title: "Failed to reactivate", description: error.message, variant: "destructive" });
      return;
    }
    if (flagId) {
      const { error: historyError } = await recordFlagAdminAction(flagId, "reactivated");
      if (historyError) {
        toast({ title: "Reactivated, but failed to record admin action", description: historyError.message, variant: "destructive" });
        loadAll();
        return;
      }
    }
    if (deactivatedItem) {
      const { error: historyError } = await recordDeactivatedCaseAction(deactivatedItem, "reactivated");
      if (historyError) {
        toast({ title: "Reactivated, but failed to record admin action", description: historyError.message, variant: "destructive" });
        loadAll();
        return;
      }
    }

    const isAd = targetType === "ad";
    const table = targetType === "event" ? "events" : targetType === "comment" ? "comments" : "ad_library";
    const { data: row } = await supabase
      .from(table)
      .select(isAd ? "flag_count, user_id, ad_name" : "flag_count, created_by_id, title")
      .eq("id", targetId)
      .maybeSingle();
    if (row) {
      const ownerId = isAd ? row.user_id : row.created_by_id;
      if (ownerId) {
        await notifyOwnerFlagLifecycle({
          userId: ownerId,
          targetType,
          targetId,
          event: "reactivated",
          flagCount: Number(row.flag_count || 0),
          itemLabel: isAd ? row.ad_name : row.title || null,
        });
      }
    }

    toast({
      title: targetType === "ad" ? "Ad creative restored" : "Item reactivated",
      description: targetType === "ad" ? "The creative and related zip placements are active again." : undefined,
    });
    loadAll();
  };

  const handleClearFlag = (flagId) => {
    const report = flags.find((f) => f.id === flagId);
    if (!report) return;
    setNoteDialog({
      open: true,
      mode: "clear_flag",
      context: { flagId, report },
      busy: false,
    });
  };

  const executeClearFlag = async (flagId, report, notes) => {
    const { error } = await supabase.rpc("admin_clear_flag", {
      p_flag_id: flagId,
      p_details: notes || null,
    });
    if (error) {
      toast({ title: "Failed to clear flag", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Flag cleared" });
    return true;
  };

  const handleClearFlags = (item) => {
    const uncleared = (item.flags || []).filter((f) => f.admin_action !== "flag_cleared");
    if (uncleared.length === 0) {
      toast({ title: "No flags to clear" });
      return;
    }
    setNoteDialog({
      open: true,
      mode: "clear_flags",
      context: { item, uncleared },
      busy: false,
    });
  };

  const executeClearFlags = async (item, uncleared, notes) => {
    const { error } = await supabase.rpc("admin_clear_all_flags", {
      p_target_type: item.type,
      p_target_id: item.item.id,
      p_details: notes || null,
    });
    if (error) {
      toast({ title: "Failed to clear flags", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Flags cleared", description: "Marked as reviewed." });
    return true;
  };

  const resolveReporterName = (f) => {
    const profile = users.find((u) => u.id === f.reporter_id);
    const fromProfile = profile
      ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim()
        || profile.full_name
        || ""
      : "";
    return (
      organizerMap[f.reporter_id]
      || fromProfile
      || f.reporter_name
      || profile?.email
      || "—"
    );
  };

  const isFlagOpen = (f) => !f.admin_action && !f.reviewed;

  const formatFlagSubmittedAt = (createdDate) => {
    const local = moment.utc(createdDate).local();
    return `${local.format("MMM D, YYYY h:mm A")} · ${local.fromNow()}`;
  };

  const formatAdminHistoryEntry = (entry) => {
    const label = adminActionLabel[entry?.action] || entry?.action || "Action";
    const when = entry?.at ? formatFlagSubmittedAt(entry.at) : "";
    const by = entry?.by ? ` · ${entry.by}` : "";
    const sourceLabel =
      entry?.source === "flagged_users"
        ? " · via Flagged Users"
        : entry?.source === "users_list"
          ? " · via Users list"
          : entry?.scope === "account_disabled"
            ? " · account disable"
            : "";
    return `${label}${sourceLabel} — ${when}${by}`;
  };

  const resolveAdminDisplayName = (adminId) => {
    if (!adminId) return null;
    const adminProfile = users.find((u) => u.id === adminId);
    if (!adminProfile) return null;
    return (
      [adminProfile.first_name, adminProfile.last_name].filter(Boolean).join(" ").trim()
      || adminProfile.full_name
      || adminProfile.email
      || null
    );
  };

  const describeDisableSource = (profile) => {
    const history = getUserFlagCaseHistory(profile);
    const lastDisable = [...history].reverse().find((e) => e?.action === "manually_deactivated");
    if (lastDisable?.source === "flagged_users") return "Admin → Flags → Flagged Users (Manual Disable)";
    if (lastDisable?.source === "users_list") return "Admin → Users → Disable";
    if (lastDisable?.scope === "account_disabled" || lastDisable?.action === "manually_deactivated") {
      return "Admin Disable (source not recorded)";
    }
    if (Number(profile?.user_flag_count || 0) >= 3 || profile?.suspended_at) {
      return "Likely after community user flags (3+)";
    }
    return "Admin Disable";
  };

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
          .map((e) => `${adminActionLabel[e?.action] || e?.action || ""} ${e?.by || ""}`)
          .join(" ");
        const title =
          item.type === "event"
            ? item.item.title || ""
            : item.type === "comment"
              ? `${item.item.content || ""} ${item.eventTitle || ""}`
              : `${item.item.ad_name || ""} ${item.item.business_name || ""} ${item.item.link_url || ""}`;
        const hay = [
          title,
          resolveDeactivatedContributor(item),
          ...card.flags.flatMap((f) => [resolveReporterName(f), f.reason, f.details, f.reporter_name]),
          adminActionLabel[card.caseAction] || "",
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
          .map((e) => `${adminActionLabel[e?.action] || e?.action || ""} ${e?.by || ""}`)
          .join(" ");
        const hay = [
          c.displayName,
          c.email,
          c.role,
          adminActionLabel[c.caseAction] || "",
          historyText,
          ...c.flags.flatMap((f) => [
            resolveReporterName(f),
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

  const flagsFiledByUserIncludingUsers = (userId) =>
    flags
      .filter((f) => f.reporter_id === userId)
      .sort(
        (a, b) =>
          new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0)
      );

  const flagsReceivedByUser = (userId) =>
    flags
      .filter((f) => f.target_type === "user" && f.target_id === userId)
      .sort(
        (a, b) =>
          new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0)
      );

  const flagsOnTarget = (targetType, targetId) =>
    flags
      .filter((f) => f.target_type === targetType && f.target_id === targetId)
      .sort(
        (a, b) =>
          new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0)
      );

  const groupFlagsByTarget = (list) => {
    const map = new Map();
    for (const f of list) {
      if (!f.target_id) continue;
      if (!map.has(f.target_id)) map.set(f.target_id, []);
      map.get(f.target_id).push(f);
    }
    return Array.from(map.entries()).map(([targetId, group]) => ({
      targetId,
      flags: group.sort(
        (a, b) =>
          new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0)
      ),
    }));
  };

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

  const formatAdZipLabel = (item) => {
    const zips = item?.zip_codes?.length
      ? item.zip_codes
      : (item?.zip_code ? [item.zip_code] : []);
    if (!zips.length) return null;
    return zips.length <= 2 ? zips.join(", ") : `${zips[0]} +${zips.length - 1}`;
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

  const handleNoteDialogConfirm = async (note) => {
    setNoteDialog((prev) => ({ ...prev, busy: true }));
    try {
      const ctx = noteDialog.context || {};
      let ok = false;
      if (noteDialog.mode === "remove_activity") {
        ok = await executeRemoveActivity(ctx.event, note, {
          flagId: ctx.flagId || null,
          deactivatedItem: ctx.deactivatedItem || null,
        });
      } else if (noteDialog.mode === "deactivate_comment") {
        ok = await executeDeactivateComment(ctx.comment, note, {
          flagId: ctx.flagId || null,
          deactivatedItem: ctx.deactivatedItem || null,
        });
      } else if (noteDialog.mode === "deactivate_ad") {
        ok = await executeDeactivateAd(ctx.targetId, note, {
          flagId: ctx.flagId || null,
          deactivatedItem: ctx.deactivatedItem || null,
        });
      } else if (noteDialog.mode === "clear_flag") {
        ok = await executeClearFlag(ctx.flagId, ctx.report, note);
      } else if (noteDialog.mode === "clear_flags") {
        ok = await executeClearFlags(ctx.item, ctx.uncleared, note);
      } else if (noteDialog.mode === "clear_user_flag") {
        ok = await executeClearUserFlag(ctx.flagId, ctx.report, note);
      } else if (noteDialog.mode === "clear_user_flags") {
        ok = await executeClearUserFlags(ctx.card, ctx.uncleared, note);
      }
      if (ok) {
        closeNoteDialog();
        loadAll();
      } else {
        setNoteDialog((prev) => ({ ...prev, busy: false }));
      }
    } catch (err) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
      setNoteDialog((prev) => ({ ...prev, busy: false }));
    }
  };

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
          <AdminSectionHeader title="All Activities" icon={CalendarDays} />
          <AdminPanelShell>
            <div className="pb-4 mb-4 border-b border-border flex flex-col sm:flex-row gap-2 sm:items-center">
              <SearchClearField
                placeholder="Search by title or zip code…"
                value={eventSearch}
                onValueChange={(v) => { setEventSearch(v); setEventsPage(1); }}
              />
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "all", label: "All" },
                  { id: "active", label: "Active" },
                  { id: "inactive", label: "Inactive" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setEventStatusFilter(opt.id); setEventsPage(1); }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                      eventStatusFilter === opt.id
                        ? "border-mint-300 bg-mint-50 text-mint-700"
                        : "border-border bg-white text-muted-foreground hover:bg-mint-50 hover:border-mint-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th
                      className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 select-none"
                      onClick={() => {
                        if (eventSortBy === "title") { setEventSortOrder(eventSortOrder === "asc" ? "desc" : "asc"); }
                        else { setEventSortBy("title"); setEventSortOrder("asc"); }
                        setEventsPage(1);
                      }}
                    >
                      Activity {eventSortBy === "title" && (eventSortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 select-none"
                      onClick={() => {
                        if (eventSortBy === "date") { setEventSortOrder(eventSortOrder === "asc" ? "desc" : "asc"); }
                        else { setEventSortBy("date"); setEventSortOrder("desc"); }
                        setEventsPage(1);
                      }}
                    >
                      Date {eventSortBy === "date" && (eventSortOrder === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Flags</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAndSortedEvents.slice((eventsPage - 1) * PAGE_SIZE, eventsPage * PAGE_SIZE).map((e) => {
                    const meta = getActivityStatusMeta(e);
                    const notesOpen = expandedEventNotes.has(e.id);
                    return (
                      <tr key={e.id} className="hover:bg-muted/30 align-top">
                        <td className="px-4 py-3 max-w-[220px]">
                          <p className="truncate font-medium">{e.title}</p>
                          {meta.adminNotes && (
                            <div className="mt-1">
                              <button
                                type="button"
                                onClick={() => toggleEventNotes(e.id)}
                                className="inline-flex items-center gap-0.5 text-[11px] text-mint-600 hover:underline"
                              >
                                {notesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {notesOpen ? "Hide admin note" : "Show admin note"}
                              </button>
                              {notesOpen && (
                                <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap rounded-lg bg-muted/40 border border-border px-2 py-1.5">
                                  {meta.adminNotes}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{moment(e.start_date).format("MMM D, YY")}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className={`inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-medium ${meta.chipClass}`}>
                              {meta.label}
                            </span>
                            {meta.reason && (
                              <span className="text-[11px] text-muted-foreground">{meta.reason}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">{e.flag_count || 0}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1 min-w-[4.25rem]">
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => navigate(`/event/${e.id}`)} title="View activity">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            {e.status === "active" ? (
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDeleteEvent(e)} title="Delete activity">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            ) : meta.canAdminRestore ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => handleReactivateItem(e.id, "event", { adminNotes: meta.adminNotes, title: e.title })}
                                title="Restore admin-removed activity"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </Button>
                            ) : meta.isCommunityFlagged ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-peach-600"
                                onClick={() => openFlagsForActivity(e)}
                                title="Open in Flags (search by title)"
                              >
                                <Flag className="w-3.5 h-3.5" />
                              </Button>
                            ) : (
                              <span className="inline-block h-7 w-7 shrink-0" aria-hidden />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Paginator total={filteredAndSortedEvents.length} page={eventsPage} onPage={setEventsPage} />
          </AdminPanelShell>
        </TabsContent>

        <TabsContent value="flags">
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
                                      {adminActionLabel[caseAction] || "Reviewed"}
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
                                  {resolveDeactivatedContributor(item)}
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
                                            {resolveReporterName(f)}
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
                                            {adminActionLabel[reportAction] || "Reviewed"}
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
                                      {adminActionLabel[normalizedAction] || adminActionLabel[caseAction] || "Reviewed"}
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
                                          {resolveReporterName(f)}
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
                                          {adminActionLabel[reportAction] || "Reviewed"}
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
                          ? flagsFiledByUserIncludingUsers(u.id).filter((f) => f.target_type === flaggingPanelType)
                          : [];
                        const receivedUserFlags = contentPanel === "userFlags" ? flagsReceivedByUser(u.id) : [];
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
                                    {resolveReporterName(f)}
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
                                                    {resolveReporterName(f)}
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
                                                    {adminActionLabel[reportAction] || "Reviewed"}
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
                                          const detailFlags = flagsClickable ? flagsOnTarget("event", e.id) : [];
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
                                          const detailFlags = flagsClickable ? flagsOnTarget("comment", c.id) : [];
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
                                          const detailFlags = flagsClickable ? flagsOnTarget("ad", a.id) : [];
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
                        const disabledByName = resolveAdminDisplayName(u.disabled_by);
                        const flagHistory = getUserFlagCaseHistory(u);
                        const receivedUserFlags = flagsReceivedByUser(r.user_id);
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
                                          {adminActionLabel[u.user_flag_case_admin_action] || u.user_flag_case_admin_action}
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
                                                  {resolveReporterName(f)}
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
                                                    ? ` · ${adminActionLabel[reportAction] || reportAction}`
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
          <AdminSubNav
            sections={contactSectionNav}
            value={contactSection}
            onChange={setContactSection}
            label="Contact Us sections"
          />

          {MESSAGE_TYPE_BOXES.filter((box) => box.id === contactSection).map((box) => {
            const boxMessages = messagesForTypeBox(messages, box);
            const paginatedMessages = boxMessages.slice(
              (contactPage - 1) * PAGE_SIZE,
              contactPage * PAGE_SIZE
            );
            return (
              <React.Fragment key={box.id}>
                <AdminSectionHeader title={box.title} icon={MessageSquare} />
                <AdminPanelShell>
                  {boxMessages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">No messages</p>
                  ) : (
                    <div className="space-y-3">
                      {paginatedMessages.map((m) => {
                        const addressed = isMessageAddressed(m);
                        return (
                          <div
                            key={m.id}
                            className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-start gap-3 shadow-sm ${
                              addressed ? "border-border bg-white" : "border-mint-200 bg-mint-50/50"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-semibold text-sm">{m.sender_name}</span>
                                <span className="text-xs text-muted-foreground">{m.sender_email}</span>
                                {m.sender_phone && (
                                  <span className="text-xs text-muted-foreground">· {formatPhoneDisplay(m.sender_phone)}</span>
                                )}
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatMessageSubmittedAt(m.created_date)}
                              </p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 ${addressed ? "text-mint-500" : "text-muted-foreground"}`}
                                title={addressed ? "Mark as not addressed" : "Mark as addressed"}
                                onClick={() => toggleMessageAddressed(m)}
                              >
                                <Check className="w-4 h-4" strokeWidth={addressed ? 3 : 2} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                title="Delete message"
                                onClick={() => softDeleteMessage(m)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      <Paginator total={boxMessages.length} page={contactPage} onPage={setContactPage} />
                    </div>
                  )}
                </AdminPanelShell>
              </React.Fragment>
            );
          })}

          {contactSection === "messages-deleted" && (() => {
            const deletedMessages = messages.filter(isMessageDeleted);
            const paginatedDeleted = deletedMessages.slice(
              (contactPage - 1) * PAGE_SIZE,
              contactPage * PAGE_SIZE
            );
            return (
              <>
                <AdminSectionHeader title="Deleted Messages" icon={Trash2} />
                <AdminPanelShell>
                  {deletedMessages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">No deleted messages</p>
                  ) : (
                    <div className="space-y-3">
                      {paginatedDeleted.map((m) => (
                        <div
                          key={m.id}
                          className="rounded-xl border border-border bg-white p-4 flex flex-col sm:flex-row sm:items-start gap-3 shadow-sm"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-semibold text-sm">{m.sender_name}</span>
                              <span className="text-xs text-muted-foreground">{m.sender_email}</span>
                              {m.sender_phone && (
                                <span className="text-xs text-muted-foreground">· {formatPhoneDisplay(m.sender_phone)}</span>
                              )}
                            </div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">{m.subject}</p>
                            <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatMessageSubmittedAt(m.created_date)}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground"
                              title="Restore message"
                              onClick={() => restoreMessage(m)}
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Paginator total={deletedMessages.length} page={contactPage} onPage={setContactPage} />
                    </div>
                  )}
                </AdminPanelShell>
              </>
            );
          })()}
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
          if (!open) setDisableDialog({ open: false, userId: null, userName: "", isSupporter: false, source: "users_list" });
        }}
        title="Disable User Account"
        description={
          disableDialog.isSupporter
            ? `Disable ${disableDialog.userName}? This is the severe path for a Supporter with advertising on the platform.`
            : `Disable ${disableDialog.userName}? This hides their active activities and comments, turns off digests, and blocks registered features. They will see your note when they sign in.`
        }
        impactDetails={
          disableDialog.isSupporter ? (
            <>
              <p className="font-medium text-foreground/80">Admin — ads &amp; billing impact</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Active activities and comments are archived (savers get a generic notice).</li>
                <li>Digests turn Off; registered features are blocked.</li>
                <li>Slot-holding ads are cancelled; zip slots are released so the waitlist can advance.</li>
                <li>Stripe subscriptions are set to cancel at period end (may bill through the current paid period, then stop renewing).</li>
                <li>Auto-renew is turned off; ad waitlist entries for this user are cancelled.</li>
                <li>They will see this impact explained on the Account Disabled page (and in email if you send one).</li>
              </ul>
            </>
          ) : (
            <>
              <p className="font-medium text-foreground/80">Admin — account impact</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Active activities and comments are archived (savers get a generic notice).</li>
                <li>Digests turn Off; registered features are blocked.</li>
                <li>Organizer directory listing is hidden while disabled.</li>
              </ul>
            </>
          )
        }
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