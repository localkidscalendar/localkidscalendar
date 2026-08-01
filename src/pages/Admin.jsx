import React, { useState, useEffect, useMemo } from "react";
import { useOutletContext, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { apiUrl } from "@/lib/apiBase";
import { formatPhoneDisplay } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Shield, CalendarDays, Flag, Megaphone, Users, Trash2, Eye, BarChart3, Mail, Image, Clock, DollarSign, Tag, ImagePlus, MapPin, FlaskConical, HelpCircle, MessageSquare, RotateCcw, Check, Undo2, ChevronDown, ChevronUp } from "lucide-react";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import AdminNoteConfirmDialog from "@/components/admin/AdminNoteConfirmDialog";
import { restoreRoleFromProfile } from "@/lib/authRoles";

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
  notifyAdCreativeDisabledAdmin,
  notifyBecameSupporter,
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
  { id: "flags-users-flagging", label: "Users Flagging Content" },
];

const USER_SECTIONS = [
  { id: "users-zip-reports", label: "Zip Code Reports" },
  { id: "users-list", label: "List of Users" },
  { id: "users-reactivation", label: "Reactivation Requests" },
];

const FLAGGING_MIN_OPTIONS = [
  { id: "all", label: "All", min: 0 },
  { id: "3", label: "3+ Flags", min: 3 },
  { id: "5", label: "5+ Flags", min: 5 },
  { id: "10", label: "10+ Flags", min: 10 },
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
  const [userSortBy, setUserSortBy] = useState("joined");
  const [userSortOrder, setUserSortOrder] = useState("desc");
  const [activeTab, setActiveTab] = useState("activities");
  const [flagSearch, setFlagSearch] = useState("");
  const [flagTypeFilter, setFlagTypeFilter] = useState("all"); // all | event | comment | ad
  const [flag3PlusOnly, setFlag3PlusOnly] = useState(false); // 3+ Deactivation cards only
  const [expandedFlagHistory, setExpandedFlagHistory] = useState(() => new Set());
  const [flaggingUserSearch, setFlaggingUserSearch] = useState("");
  const [flaggingMinFlags, setFlaggingMinFlags] = useState("all");
  const [expandedFlaggingUsers, setExpandedFlaggingUsers] = useState(() => new Set());
  const [disabledUsers, setDisabledUsers] = useState(new Set());
  const [organizerMap, setOrganizerMap] = useState({});
  const [reactivationRequests, setReactivationRequests] = useState([]);
  const [reactivationSearch, setReactivationSearch] = useState("");
  const [reactivationPage, setReactivationPage] = useState(1);
  const [disableDialog, setDisableDialog] = useState({
    open: false,
    userId: null,
    userName: "",
    isSupporter: false,
  });
  const [declineDialog, setDeclineDialog] = useState({ open: false, request: null });
  const [disableBusy, setDisableBusy] = useState(false);

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
      const flg = (flagsRes.data || []).map(withCreatedDate);
      const adsList = (adsRes.data || []).map(withCreatedDate);
      const usersList = (usersRes.data || []).map((u) => {
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

  const handleDeleteEvent = async (event) => {
    if (!window.confirm(`Delete "${event.title}"? This will remove it from the public site immediately.`)) return;
    const notes = window.prompt("Provide an explanation for removing this activity. This will be shown to the contributor on their Dashboard:");
    if (notes === null) return;
    if (!notes.trim()) { toast({ title: "An explanation is required to delete this activity.", variant: "destructive" }); return; }
    const { error } = await supabase.from("events").update({
      status: "deleted",
      admin_notes: notes.trim(),
      updated_at: new Date().toISOString(),
    }).eq("id", event.id);
    if (error) {
      toast({ title: "Failed to remove activity", description: error.message, variant: "destructive" });
      return;
    }
    void notifyActivityRemovedAdmin(event, notes.trim());
    // Savers are notified by DB trigger when admin_notes is set on delete.
    toast({ title: "Activity removed" });
    loadAll();
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
  const [flaggingUsers, setFlaggingUsers] = useState([]);

  useEffect(() => {
    if (flags.length > 0) loadEventTitles();
  }, [flags]);

  useEffect(() => {
    loadDeletedItems();
  }, [events, flags]);

  useEffect(() => {
    loadFlaggingUsers();
  }, [flags, users, organizerMap]);

  const loadEventTitles = async () => {
    try {
      const eventIds = [...new Set(flags.filter((f) => f.target_type === "event").map((f) => f.target_id))];
      const commentIds = [...new Set(flags.filter((f) => f.target_type === "comment").map((f) => f.target_id))];
      const adIds = [...new Set(flags.filter((f) => f.target_type === "ad").map((f) => f.target_id))];
      const titles = {};

      if (eventIds.length) {
        const { data } = await supabase.from("events").select("id, title, status").in("id", eventIds);
        (data || []).forEach((e) => { titles[e.id] = { type: "event", title: e.title, status: e.status }; });
      }

      if (commentIds.length) {
        const { data: comments } = await supabase.from("comments").select("id, content, event_id, status").in("id", commentIds);
        for (const c of comments || []) {
          titles[c.id] = { type: "comment", content: c.content, event_id: c.event_id, status: c.status };
          if (c.event_id && !titles[c.event_id]) {
            const { data: e } = await supabase.from("events").select("id, title, status").eq("id", c.event_id).maybeSingle();
            if (e) titles[e.id] = { type: "event", title: e.title, status: e.status };
          }
        }
      }

      if (adIds.length) {
        // Flags target Ad Library assets; fall back to placements for any unmigrated rows.
        const { data: assets } = await supabase
          .from("ad_library")
          .select("id, ad_name, moderation_status, image_url, link_url")
          .in("id", adIds);
        (assets || []).forEach((a) => {
          titles[a.id] = {
            type: "ad",
            title: a.ad_name || "Ad Asset",
            status: a.moderation_status,
            image_url: a.image_url,
            link_url: a.link_url,
          };
        });
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

  const isManuallyDeactivatedTarget = (targetId, targetType) =>
    flags.some(
      (f) =>
        f.target_id === targetId &&
        f.target_type === targetType &&
        f.admin_action === "manually_deactivated"
    );

  const syncTargetStatusWithFlagThreshold = async (table, targetId, targetType, nextCount, currentStatus) => {
    if (targetType === "ad") {
      if (nextCount >= 3) {
        const { data: asset } = await supabase
          .from("ad_library")
          .select("flag_auto_hide_exempt")
          .eq("id", targetId)
          .maybeSingle();
        if (asset?.flag_auto_hide_exempt) return;
        if (currentStatus !== "flagged") {
          await disableAdAsset(
            targetId,
            "Ad creative flagged by 3+ community members and disabled across all zip placements."
          );
        }
        return;
      }
      if (currentStatus === "flagged" && !isManuallyDeactivatedTarget(targetId, targetType)) {
        await reactivateAdAsset(targetId);
      }
      return;
    }

    const hiddenStatus = "archived";
    const updates = { updated_at: new Date().toISOString() };

    if (nextCount >= 3) {
      const { data: row } = await supabase
        .from(table)
        .select("flag_auto_hide_exempt")
        .eq("id", targetId)
        .maybeSingle();
      if (row?.flag_auto_hide_exempt) return;
      if (currentStatus !== hiddenStatus) {
        updates.status = hiddenStatus;
        await supabase.from(table).update(updates).eq("id", targetId);
      }
      return;
    }

    // Below threshold: undo auto-hide, but keep Admin Manual Deactivate in place
    if (currentStatus === "archived" && !isManuallyDeactivatedTarget(targetId, targetType)) {
      updates.status = "active";
      await supabase.from(table).update(updates).eq("id", targetId);
    }
  };

  const clearFlagFromTarget = async (report) => {
    const isAd = report.target_type === "ad";
    const table =
      report.target_type === "event"
        ? "events"
        : report.target_type === "comment"
          ? "comments"
          : isAd
            ? "ad_library"
            : null;
    if (!table) return;

    const { data: row } = await supabase
      .from(table)
      .select(isAd ? "flag_count, flagged_by, moderation_status" : "flag_count, flagged_by, status")
      .eq("id", report.target_id)
      .maybeSingle();
    if (!row) return;

    const nextBy = (row.flagged_by || []).filter((id) => id !== report.reporter_id);
    // Prefer array length as source of truth after removing this reporter
    const resolvedCount = nextBy.length;

    await supabase.from(table).update({
      flag_count: resolvedCount,
      flagged_by: nextBy,
      updated_at: new Date().toISOString(),
    }).eq("id", report.target_id);

    if (isAd) {
      await supabase.from("banner_ads").update({
        flag_count: resolvedCount,
        flagged_by: nextBy,
        updated_at: new Date().toISOString(),
      }).eq("ad_library_id", report.target_id);
    }

    await syncTargetStatusWithFlagThreshold(
      table,
      report.target_id,
      report.target_type,
      resolvedCount,
      isAd ? row.moderation_status : row.status
    );
  };

  const restoreFlagOnTarget = async (report) => {
    if (!report?.reporter_id) return;
    const isAd = report.target_type === "ad";
    const table =
      report.target_type === "event"
        ? "events"
        : report.target_type === "comment"
          ? "comments"
          : isAd
            ? "ad_library"
            : null;
    if (!table) return;

    const { data: row } = await supabase
      .from(table)
      .select(isAd ? "flag_count, flagged_by, moderation_status" : "flag_count, flagged_by, status")
      .eq("id", report.target_id)
      .maybeSingle();
    if (!row) return;

    const flaggedBy = row.flagged_by || [];
    if (flaggedBy.includes(report.reporter_id)) return;

    const nextBy = [...flaggedBy, report.reporter_id];
    const resolvedCount = nextBy.length;

    await supabase.from(table).update({
      flag_count: resolvedCount,
      flagged_by: nextBy,
      updated_at: new Date().toISOString(),
    }).eq("id", report.target_id);

    if (isAd) {
      await supabase.from("banner_ads").update({
        flag_count: resolvedCount,
        flagged_by: nextBy,
        updated_at: new Date().toISOString(),
      }).eq("ad_library_id", report.target_id);
    }

    await syncTargetStatusWithFlagThreshold(
      table,
      report.target_id,
      report.target_type,
      resolvedCount,
      isAd ? row.moderation_status : row.status
    );
  };

  const loadFlaggingUsers = async () => {
    try {
      // Count all flags filed by each user (for abuse review); include cleared reports
      const tally = {};
      flags.forEach((f) => {
        if (!f.reporter_id) return;
        if (!tally[f.reporter_id]) {
          tally[f.reporter_id] = { id: f.reporter_id, name: null, count: 0, flagIds: [] };
        }
        tally[f.reporter_id].count += 1;
        tally[f.reporter_id].flagIds.push(f.id);
        if (f.reporter_name) tally[f.reporter_id].name = tally[f.reporter_id].name || f.reporter_name;
      });
      const result = Object.values(tally).map((t) => {
        const profile = users.find((u) => u.id === t.id);
        const name =
          organizerMap[t.id]
          || t.name
          || profile?.full_name
          || (profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() : "")
          || profile?.email
          || "Unknown";
        const email = profile?.email || "";
        return { ...t, name, email };
      }).sort((a, b) => b.count - a.count);
      setFlaggingUsers(result);
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

  const toggleEventNotes = (eventId) => {
    setExpandedEventNotes((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const openDisableUserDialog = (userId, userName, isSupporter = false) => {
    setDisableDialog({
      open: true,
      userId,
      userName: userName || "this user",
      isSupporter: Boolean(isSupporter),
    });
  };

  const handleDisableUser = async (note) => {
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

      const supporterNote = payload.is_supporter
        ? ` Ads cancelled: ${payload.ads_cancelled || 0}. Waitlist released: ${payload.waitlist_released || 0}.`
        : " Digest notifications turned off.";
      toast({
        title: "User account disabled",
        description: payload.is_supporter
          ? `Full Supporter disable applied.${supporterNote}`
          : supporterNote.trim(),
      });
      setDisableDialog({ open: false, userId: null, userName: "", isSupporter: false });
      setDisabledUsers((prev) => new Set([...prev, userId]));
      setUsers((prev) => prev.map((u) => (
        u.id === userId
          ? {
            ...u,
            role: "disabled",
            role_before_disabled: payload.prior_role || priorRole,
            disabled_note: note,
            disabled_at: new Date().toISOString(),
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

  const handleReactivateUser = async (userId, { requestId } = {}) => {
    const profile = users.find((u) => u.id === userId);
    const restoreRole = restoreRoleFromProfile(profile);
    const roleLabel =
      restoreRole === "organizer"
        ? "Organizer"
        : restoreRole === "admin"
          ? "Admin"
          : "Community Member";
    if (!window.confirm(`Reactivate this user as ${roleLabel}?`)) return;

    const { error } = await supabase.from("profiles").update({
      role: restoreRole,
      role_before_disabled: null,
      disabled_note: null,
      disabled_at: null,
      disabled_by: null,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);
    if (error) {
      toast({ title: "Failed to reactivate user", description: error.message, variant: "destructive" });
      return;
    }

    const now = new Date().toISOString();
    if (requestId) {
      await supabase.from("account_reactivation_requests").update({
        status: "reactivated",
        reviewed_at: now,
        reviewed_by: user?.id || null,
        updated_at: now,
      }).eq("id", requestId).eq("status", "pending");
    } else {
      await supabase.from("account_reactivation_requests").update({
        status: "reactivated",
        reviewed_at: now,
        reviewed_by: user?.id || null,
        updated_at: now,
      }).eq("user_id", userId).eq("status", "pending");
    }

    toast({ title: "User account reactivated" });
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
        }
        : u
    )));
    setReactivationRequests((prev) => prev.map((r) => {
      if (requestId && r.id === requestId) {
        return { ...r, status: "reactivated", reviewed_at: now, reviewed_by: user?.id || null };
      }
      if (!requestId && r.user_id === userId && r.status === "pending") {
        return { ...r, status: "reactivated", reviewed_at: now, reviewed_by: user?.id || null };
      }
      return r;
    }));
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
    setDisableBusy(false);
    if (error) {
      toast({ title: "Failed to decline request", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Reactivation request declined" });
    setDeclineDialog({ open: false, request: null });
    setReactivationRequests((prev) => prev.map((r) => (
      r.id === req.id
        ? { ...r, status: "declined", admin_note: note, reviewed_at: now, reviewed_by: user?.id || null }
        : r
    )));
  };

  const adminActionLabel = {
    manually_deactivated: "Manually Deactivated",
    flag_cleared: "Flag Cleared",
    flags_cleared: "Flags Cleared",
    reviewed: "Reviewed",
    overridden: "Override 3+",
    reactivated: "Reactivated",
    flag_reactivated: "Flag Reactivated",
    unreviewed: "Marked Unreviewed",
  };

  const adminName = () => {
    const fromProfile = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
    return fromProfile || user?.full_name || user?.email || "Admin";
  };

  const getFlagHistory = (report) =>
    Array.isArray(report?.admin_action_history) ? report.admin_action_history : [];

  // Flagged Content cards: only this report's own actions (never Deactivated Content case history)
  const getFlaggedCardHistory = (report) =>
    getFlagHistory(report).filter((entry) => entry?.scope !== "deactivated_content");

  const getDeactivatedCaseHistory = (item) =>
    Array.isArray(item?.item?.flag_case_admin_history) ? item.item.flag_case_admin_history : [];

  const REOPEN_FLAG_ACTIONS = new Set(["reactivated", "overridden", "flag_reactivated", "unreviewed"]);

  const buildFlagDispositionUpdate = (report, action) => {
    const history = [
      ...getFlagHistory(report),
      {
        action,
        at: new Date().toISOString(),
        by: adminName(),
        scope: "flagged_content",
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

  const recordFlagAdminAction = async (flagId, action) => {
    const report = flags.find((f) => f.id === flagId);
    if (!report) return { error: { message: "Flag report not found" } };

    const updates = buildFlagDispositionUpdate(report, action);
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

  const recordDeactivatedCaseAction = async (item, action) => {
    const table = item.type === "event" ? "events" : item.type === "comment" ? "comments" : "ad_library";
    const history = [
      ...getDeactivatedCaseHistory(item),
      {
        action,
        at: new Date().toISOString(),
        by: adminName(),
        scope: "deactivated_content",
      },
    ];
    const updates = {
      flag_case_admin_history: history,
      flag_case_admin_action: action === "unreviewed" ? null : action,
      updated_at: new Date().toISOString(),
    };
    return supabase.from(table).update(updates).eq("id", item.item.id);
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
    const { error: historyError } = await recordDeactivatedCaseAction(item, "overridden");
    if (historyError) {
      toast({ title: "Override applied, but failed to record admin action", description: historyError.message, variant: "destructive" });
      loadAll();
      return;
    }
    await notifyOwnerAfterFlagAdminAction(item, "overridden");
    toast({
      title: "Override 3+ applied",
      description: targetType === "ad"
        ? "The creative is live again and protected from community auto-hide."
        : "The item is live again and protected from community auto-hide.",
    });
    loadAll();
  };

  const handleDeactivatedManuallyDeactivate = async (item) => {
    const label = item.type === "event" ? "activity" : item.type === "comment" ? "comment" : "ad";
    if (!window.confirm(
      item.type === "ad"
        ? "Manually deactivate this ad creative? It will be disabled across all zip placements using it."
        : `Manually deactivate this ${label}? It will be hidden from the public site.`
    )) return;

    const targetId = item.item.id;
    let error;
    let disableResult = null;
    if (item.type === "ad") {
      const reason = "Ad creative manually deactivated by Admin.";
      ({ data: disableResult, error } = await disableAdAsset(targetId, reason));
      if (!error && disableResult && !disableResult.already_disabled) {
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
    } else {
      const table = item.type === "event" ? "events" : "comments";
      ({ error } = await supabase.from(table).update({
        status: "archived",
        updated_at: new Date().toISOString(),
      }).eq("id", targetId));
    }
    if (error) {
      toast({ title: "Failed to deactivate", description: error.message, variant: "destructive" });
      return;
    }
    const { error: historyError } = await recordDeactivatedCaseAction(item, "manually_deactivated");
    if (historyError) {
      toast({ title: "Deactivated, but failed to record admin action", description: historyError.message, variant: "destructive" });
      loadAll();
      return;
    }
    toast({
      title: item.type === "ad" ? "Ad creative disabled" : `${label === "activity" ? "Activity" : "Comment"} deactivated`,
    });
    loadAll();
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

  const handleManuallyDeactivate = async (flagId, targetId, targetType) => {
    const label = targetType === "event" ? "activity" : targetType === "comment" ? "comment" : "ad";
    if (!window.confirm(
      targetType === "ad"
        ? "Manually deactivate this ad creative? It will be disabled across all zip placements using it."
        : `Manually deactivate this ${label}? It will be hidden from the public site.`
    )) return;

    let error;
    if (targetType === "ad") {
      const reason = "Ad creative manually deactivated by Admin.";
      const { data: disableResult, error: disableError } = await disableAdAsset(targetId, reason);
      error = disableError;
      if (!error && disableResult && !disableResult.already_disabled) {
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
    } else {
      const table = targetType === "event" ? "events" : "comments";
      ({ error } = await supabase.from(table).update({
        status: "archived",
        updated_at: new Date().toISOString(),
      }).eq("id", targetId));
    }
    if (error) {
      toast({ title: "Failed to deactivate", description: error.message, variant: "destructive" });
      return;
    }

    if (flagId) {
      const { error: historyError } = await recordFlagAdminAction(flagId, "manually_deactivated");
      if (historyError) {
        toast({ title: "Deactivated, but failed to record admin action", description: historyError.message, variant: "destructive" });
        loadAll();
        return;
      }
    }
    toast({ title: targetType === "ad" ? "Ad creative disabled" : `${label === "activity" ? "Activity" : "Comment"} deactivated` });
    loadAll();
  };

  const handleReactivateFromFlag = async (flagId, targetId, targetType) => {
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

  const handleClearFlag = async (flagId) => {
    const report = flags.find((f) => f.id === flagId);
    if (!report) return;
    if (!window.confirm("Clear this flag? It will be removed from the item’s flag count, but the report stays for admin history.")) return;

    // Keep the report row for audit history; clear it from the target content counters
    await clearFlagFromTarget(report);

    const { error } = await recordFlagAdminAction(flagId, "flag_cleared");
    if (error) {
      toast({ title: "Failed to clear flag", description: error.message, variant: "destructive" });
      return;
    }

    // Notify owner with remaining count after this clear
    const isAd = report.target_type === "ad";
    const table = report.target_type === "event" ? "events" : report.target_type === "comment" ? "comments" : "ad_library";
    const { data: row } = await supabase
      .from(table)
      .select(isAd ? "flag_count, user_id, ad_name" : "flag_count, created_by_id, title, content")
      .eq("id", report.target_id)
      .maybeSingle();
    if (row) {
      const ownerId = isAd ? row.user_id : row.created_by_id;
      if (ownerId) {
        await notifyOwnerFlagLifecycle({
          userId: ownerId,
          targetType: report.target_type,
          targetId: report.target_id,
          event: "partial_cleared",
          flagCount: Number(row.flag_count || 0),
          itemLabel: isAd ? row.ad_name : report.target_type === "event" ? row.title : null,
        });
      }
    }

    toast({ title: "Flag cleared" });
    loadAll();
  };

  const handleClearFlags = async (item) => {
    const label = item.type === "event" ? "activity" : item.type === "comment" ? "comment" : "ad";
    const uncleared = (item.flags || []).filter((f) => f.admin_action !== "flag_cleared");
    if (uncleared.length === 0) {
      toast({ title: "No flags to clear" });
      return;
    }
    if (!window.confirm(`Clear all ${uncleared.length} flags on this ${label}? They will be removed from the item’s flag count, but reports stay for admin history. Community auto-hide can apply again if flags build up.`)) return;

    for (const report of uncleared) {
      await clearFlagFromTarget(report);
      const { error } = await recordFlagAdminAction(report.id, "flag_cleared");
      if (error) {
        toast({ title: "Failed to clear flags", description: error.message, variant: "destructive" });
        loadAll();
        return;
      }
    }

    // Second chance: clear any Override 3+ exemption so auto-hide can apply again
    const clearTable = item.type === "event" ? "events" : item.type === "comment" ? "comments" : "ad_library";
    const { error: exemptError } = await supabase.from(clearTable).update({
      flag_auto_hide_exempt: false,
      updated_at: new Date().toISOString(),
    }).eq("id", item.item.id);
    if (exemptError) {
      toast({ title: "Flags cleared, but failed to reset auto-hide override", description: exemptError.message, variant: "destructive" });
      loadAll();
      return;
    }

    const { error: caseError } = await recordDeactivatedCaseAction(item, "flags_cleared");
    if (caseError) {
      toast({ title: "Flags cleared, but failed to record case history", description: caseError.message, variant: "destructive" });
      loadAll();
      return;
    }

    const clearOwnerId = resolveOwnerIdForFlagItem(item);
    if (clearOwnerId) {
      await notifyOwnerFlagLifecycle({
        userId: clearOwnerId,
        targetType: item.type,
        targetId: item.item.id,
        event: "cleared",
        flagCount: 0,
        itemLabel: resolveItemLabelForFlagItem(item),
      });
    }

    toast({ title: "Flags cleared" });
    loadAll();
  };

  const handleReactivateFlag = async (flagId) => {
    const report = flags.find((f) => f.id === flagId);
    if (!report) return;

    await restoreFlagOnTarget(report);

    const { error } = await recordFlagAdminAction(flagId, "flag_reactivated");
    if (error) {
      toast({ title: "Failed to reactivate flag", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Flag reactivated" });
    loadAll();
  };

  const handleReviewedFlag = async (flagId) => {
    const { error } = await recordFlagAdminAction(flagId, "reviewed");
    if (error) {
      toast({ title: "Failed to mark reviewed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Marked as reviewed" });
    loadAll();
  };

  const handleMarkUnreviewed = async (flagId) => {
    const { error } = await recordFlagAdminAction(flagId, "unreviewed");
    if (error) {
      toast({ title: "Failed to mark unreviewed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Marked as unreviewed" });
    loadAll();
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

  const resolveContributorName = (f) => {
    if (f.target_type === "event") {
      const ev = events.find((e) => e.id === f.target_id);
      if (ev?.org_name) return ev.org_name;
      if (ev?.created_by_id && organizerMap[ev.created_by_id]) return organizerMap[ev.created_by_id];
    }
    return f.target_contributor_name || "—";
  };

  const isFlagOpen = (f) => !f.admin_action && !f.reviewed;

  const getReportedFlagOrdinal = (report) => {
    const related = flags
      .filter((f) => f.target_type === report.target_type && f.target_id === report.target_id)
      .sort(
        (a, b) =>
          new Date(a.created_at || a.created_date || 0) - new Date(b.created_at || b.created_date || 0)
      );
    const index = related.findIndex((f) => f.id === report.id);
    return {
      position: index >= 0 ? index + 1 : 1,
      total: related.length || 1,
    };
  };

  const formatFlagSubmittedAt = (createdDate) => {
    const local = moment.utc(createdDate).local();
    return `${local.format("MMM D, YYYY h:mm A")} · ${local.fromNow()}`;
  };

  const formatAdminHistoryEntry = (entry) => {
    const label = adminActionLabel[entry?.action] || entry?.action || "Action";
    const when = entry?.at ? formatFlagSubmittedAt(entry.at) : "";
    const by = entry?.by ? ` · ${entry.by}` : "";
    return `${label} — ${when}${by}`;
  };

  const getDeactivationSortAt = (item) => {
    const sorted = [...(item.flags || [])].sort(
      (a, b) =>
        new Date(a.created_at || a.created_date || 0) - new Date(b.created_at || b.created_date || 0)
    );
    if (sorted.length >= 3) {
      return sorted[2].created_at || sorted[2].created_date;
    }
    const latest = sorted[sorted.length - 1];
    return latest?.created_at || latest?.created_date || item.item.updated_at || item.item.created_at;
  };

  const flaggedFeedItems = useMemo(() => {
    const flagEntries = flags.map((f) => ({
      kind: "flag",
      id: `flag-${f.id}`,
      sortAt: f.created_at || f.created_date,
      targetType: f.target_type,
      flag: f,
    }));

    const deactivationEntries = deletedItems.map((item) => ({
      kind: "deactivation",
      id: `deact-${item.type}-${item.item.id}`,
      sortAt: getDeactivationSortAt(item),
      targetType: item.type === "event" ? "event" : item.type === "comment" ? "comment" : "ad",
      item,
    }));

    let list = [...flagEntries, ...deactivationEntries];

    if (flag3PlusOnly) {
      list = list.filter((entry) => entry.kind === "deactivation");
    }

    if (flagTypeFilter !== "all") {
      list = list.filter((entry) => entry.targetType === flagTypeFilter);
    }

    if (flagSearch.trim()) {
      const q = flagSearch.trim().toLowerCase();
      list = list.filter((entry) => {
        if (entry.kind === "flag") {
          const f = entry.flag;
          const title =
            f.target_type === "event"
              ? eventMap[f.target_id]?.title || ""
              : f.target_type === "comment"
                ? `${eventMap[f.target_id]?.content || ""} ${eventMap[eventMap[f.target_id]?.event_id]?.title || ""}`
                : eventMap[f.target_id]?.title || f.target_contributor_name || "";
          const historyText = getFlaggedCardHistory(f)
            .map((e) => `${adminActionLabel[e?.action] || e?.action || ""} ${e?.by || ""}`)
            .join(" ");
          const hay = [
            title,
            f.reporter_name,
            f.target_contributor_name,
            f.reason,
            f.details,
            resolveReporterName(f),
            resolveContributorName(f),
            adminActionLabel[f.admin_action] || "",
            historyText,
            "flag",
          ].join(" ").toLowerCase();
          return hay.includes(q);
        }

        const item = entry.item;
        const historyText = getDeactivatedCaseHistory(item)
          .map((e) => `${adminActionLabel[e?.action] || e?.action || ""} ${e?.by || ""}`)
          .join(" ");
        const title =
          item.type === "event"
            ? item.item.title || ""
            : item.type === "comment"
              ? `${item.item.content || ""} ${item.eventTitle || ""}`
              : `${item.item.business_name || ""} ${item.item.link_url || ""}`;
        const hay = [
          title,
          resolveDeactivatedContributor(item),
          ...(item.flags || []).flatMap((f) => [resolveReporterName(f), f.reason, f.details]),
          adminActionLabel[item.item.flag_case_admin_action] || "",
          historyText,
          "3+ deactivation",
          "deactivation",
        ].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }

    list.sort((a, b) => new Date(b.sortAt || 0) - new Date(a.sortAt || 0));
    return list;
  }, [flags, deletedItems, flagTypeFilter, flag3PlusOnly, flagSearch, eventMap, users, organizerMap, events]);

  const openFlagCount = useMemo(() => {
    const openSingles = flags.filter(isFlagOpen).length;
    const openDeactivations = deletedItems.filter((item) => {
      const action = item.item.flag_case_admin_action || null;
      const hidden = isDeactivatedItemHidden(item);
      return hidden && action !== "reviewed" && action !== "flags_cleared";
    }).length;
    return openSingles + openDeactivations;
  }, [flags, deletedItems]);

  const filteredFlaggingUsers = useMemo(() => {
    const minOpt = FLAGGING_MIN_OPTIONS.find((o) => o.id === flaggingMinFlags) || FLAGGING_MIN_OPTIONS[0];
    let list = flaggingUsers.filter((u) => u.count >= minOpt.min);
    if (flaggingUserSearch.trim()) {
      const q = flaggingUserSearch.trim().toLowerCase();
      list = list.filter((u) => {
        const hay = [u.name, u.email, String(u.count)].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [flaggingUsers, flaggingUserSearch, flaggingMinFlags]);

  const flagsFiledByUser = (userId) =>
    flags
      .filter((f) => f.reporter_id === userId)
      .sort(
        (a, b) =>
          new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0)
      );

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
      const search = userSearch.toLowerCase();
      filtered = users.filter((u) =>
        (u.full_name || "").toLowerCase().includes(search)
        || (u.first_name || "").toLowerCase().includes(search)
        || (u.last_name || "").toLowerCase().includes(search)
        || (u.email || "").toLowerCase().includes(search)
        || (u.zip_code || "").toLowerCase().includes(search)
      );
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
  }, [users, userSearch, userSortBy, userSortOrder]);

  const filteredReactivationRequests = useMemo(() => {
    let list = [...reactivationRequests];
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
  }, [reactivationRequests, reactivationSearch]);

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
              <Input
                placeholder="Search by title or zip code…"
                value={eventSearch}
                onChange={(e) => { setEventSearch(e.target.value); setEventsPage(1); }}
                className="rounded-lg h-8 text-sm sm:max-w-xs"
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
            sections={FLAGS_SECTIONS}
            value={flagsSection}
            onChange={setFlagsSection}
            label="Flags sections"
          />

          {flagsSection === "flags-flagged-content" && (
            <>
            <AdminSectionHeader title="Flagged Content (Activities, Comments, Ad Assets)" icon={Flag} />
              <AdminPanelShell>
                <div className="pb-4 mb-4 border-b border-border flex flex-col sm:flex-row gap-2 sm:items-center">
                  <Input
                    placeholder="Search flags…"
                    value={flagSearch}
                    onChange={(e) => { setFlagSearch(e.target.value); setFlaggedContentPage(1); }}
                    className="rounded-lg h-8 text-sm sm:max-w-xs"
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
                {flaggedFeedItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    {flagSearch.trim() || flagTypeFilter !== "all" || flag3PlusOnly
                      ? "No flags match your search or filters"
                      : "No flags reported"}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {flaggedFeedItems
                      .slice((flaggedContentPage - 1) * PAGE_SIZE, flaggedContentPage * PAGE_SIZE)
                      .map((entry) => {
                        if (entry.kind === "flag") {
                          const f = entry.flag;
                          const open = isFlagOpen(f);
                          const action = f.admin_action || (f.reviewed ? "reviewed" : null);
                          const history = getFlaggedCardHistory(f);
                          const historyOpen = expandedFlagHistory.has(f.id);
                          const targetMeta = eventMap[f.target_id];
                          const typeLabel = f.target_type === "event" ? "Activity" : f.target_type === "comment" ? "Comment" : "Ad";
                          const hasReviewPane = f.target_type === "comment" || f.target_type === "ad";
                          const reportedFlags = getReportedFlagOrdinal(f);

                          const actionButtons = (
                            <div className="flex flex-wrap gap-1.5">
                              {action === "manually_deactivated" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs h-7 text-mint-600 border-mint-200"
                                  onClick={() => handleReactivateFromFlag(f.id, f.target_id, f.target_type)}
                                >
                                  Reactivate
                                </Button>
                              ) : action === "flag_cleared" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs h-7 text-mint-600 border-mint-200"
                                  onClick={() => handleReactivateFlag(f.id)}
                                >
                                  Reactivate Flag
                                </Button>
                              ) : action === "reviewed" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs h-7 text-mint-600 border-mint-200"
                                  onClick={() => handleMarkUnreviewed(f.id)}
                                >
                                  Mark Unreviewed
                                </Button>
                              ) : open ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg text-xs h-7 text-destructive border-destructive/20"
                                    onClick={() => handleManuallyDeactivate(f.id, f.target_id, f.target_type)}
                                  >
                                    Manually Deactivate
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg text-xs h-7 text-gray-600 border-gray-200"
                                    onClick={() => handleClearFlag(f.id)}
                                  >
                                    Clear Flag
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg text-xs h-7 text-mint-600 border-mint-200"
                                    onClick={() => handleReviewedFlag(f.id)}
                                  >
                                    Reviewed
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          );

                          return (
                            <div
                              key={entry.id}
                              className={`rounded-xl border p-3 shadow-sm ${
                                open ? "border-peach-200 bg-peach-50/50" : "border-border bg-white"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    f.target_type === "event"
                                      ? "bg-mint-100 text-mint-600"
                                      : f.target_type === "comment"
                                        ? "bg-amber-100 text-amber-600"
                                        : "bg-peach-100 text-peach-600"
                                  }`}>
                                    {typeLabel}
                                  </span>
                                  {action && (
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                      action === "manually_deactivated"
                                        ? "bg-red-100 text-red-600"
                                        : action === "flag_cleared"
                                          ? "bg-gray-100 text-gray-600"
                                          : "bg-mint-100 text-mint-700"
                                    }`}>
                                      {adminActionLabel[action] || "Reviewed"}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted-foreground shrink-0 text-right leading-5">
                                  {formatFlagSubmittedAt(f.created_date || f.created_at)}
                                </p>
                              </div>

                              <div className={`grid gap-3 ${hasReviewPane ? "lg:grid-cols-[minmax(0,1fr)_minmax(200px,280px)]" : ""}`}>
                                <div className="min-w-0 space-y-2">
                                  {f.target_type === "event" ? (
                                    <Link to={`/event/${f.target_id}`} className="text-sm font-semibold text-mint-600 hover:underline block truncate">
                                      {targetMeta?.title || "Activity"}
                                    </Link>
                                  ) : f.target_type === "comment" ? (
                                    targetMeta?.event_id ? (
                                      <Link
                                        to={`/event/${targetMeta.event_id}`}
                                        className="text-sm font-semibold text-mint-600 hover:underline block truncate"
                                      >
                                        {eventMap[targetMeta.event_id]?.title || "Activity"}
                                      </Link>
                                    ) : (
                                      <p className="text-sm font-semibold">Comment</p>
                                    )
                                  ) : (
                                    <p className="text-sm font-semibold truncate">
                                      {targetMeta?.title || f.target_contributor_name || "Ad Asset"}
                                    </p>
                                  )}

                                  <div className="text-xs text-muted-foreground space-y-0.5">
                                    <p>
                                      <span className="font-medium text-foreground/80">
                                        {f.target_type === "comment" ? "Comment by" : f.target_type === "ad" ? "Ad Asset" : "Contributor"}:
                                      </span>{" "}
                                      {resolveContributorName(f)}
                                    </p>
                                    <p>
                                      <span className="font-medium text-foreground/80">Flagged By:</span> {resolveReporterName(f)}
                                    </p>
                                    <p>
                                      <span className="font-medium text-foreground/80">Reported Flags:</span>{" "}
                                      {reportedFlags.position} of {reportedFlags.total}
                                    </p>
                                    <p>
                                      <span className="font-medium text-foreground/80">Reason:</span>{" "}
                                      <span className="capitalize">{f.reason || "—"}</span>
                                    </p>
                                    {f.details && (
                                      <p>
                                        <span className="font-medium text-foreground/80">Comments:</span> {f.details}
                                      </p>
                                    )}
                                    {history.length > 0 && (
                                      <div className="pt-1">
                                        <button
                                          type="button"
                                          className="text-xs font-medium text-mint-600 hover:underline"
                                          onClick={() => {
                                            setExpandedFlagHistory((prev) => {
                                              const next = new Set(prev);
                                              if (next.has(f.id)) next.delete(f.id);
                                              else next.add(f.id);
                                              return next;
                                            });
                                          }}
                                        >
                                          {historyOpen ? "Hide Admin History" : `Admin History (${history.length})`}
                                        </button>
                                        {historyOpen && (
                                          <div className="mt-1 space-y-0.5 pl-0.5">
                                            {history.map((histEntry, idx) => (
                                              <p key={`${f.id}-hist-${idx}`}>
                                                • {formatAdminHistoryEntry(histEntry)}
                                              </p>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {actionButtons}
                                </div>

                                {f.target_type === "comment" && (
                                  <div className="rounded-lg border border-border/70 bg-white/80 p-2.5 min-w-0">
                                    <p className="text-[11px] font-medium text-foreground/70 mb-1">Comment</p>
                                    <p className="text-xs text-foreground whitespace-pre-wrap break-words max-h-36 overflow-y-auto">
                                      {targetMeta?.content || "—"}
                                    </p>
                                  </div>
                                )}

                                {f.target_type === "ad" && (
                                  <div className="rounded-lg border border-border/70 bg-white/80 p-2.5 min-w-0 space-y-2">
                                    <p className="text-[11px] font-medium text-foreground/70">Ad Creative</p>
                                    {targetMeta?.image_url ? (
                                      <a
                                        href={targetMeta.image_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="View full size"
                                        className="shrink-0 w-20 aspect-[2/1] rounded-lg border border-border bg-muted/30 overflow-hidden flex items-center justify-center hover:ring-2 hover:ring-mint-300 transition"
                                      >
                                        <img
                                          src={targetMeta.image_url}
                                          alt={targetMeta?.title || "Ad creative"}
                                          className="max-w-full max-h-full object-contain"
                                        />
                                      </a>
                                    ) : (
                                      <div className="shrink-0 w-20 aspect-[2/1] rounded-lg border border-dashed border-border bg-muted/20" />
                                    )}
                                    {targetMeta?.link_url ? (
                                      <p className="text-[11px] break-all">
                                        <span className="font-medium text-foreground/80">URL:</span>{" "}
                                        <a
                                          href={targetMeta.link_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-mint-600 hover:underline"
                                        >
                                          {targetMeta.link_url}
                                        </a>
                                      </p>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">No URL</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // 3+ Deactivation card
                        const item = entry.item;
                        const typeLabel = item.type === "event" ? "Activity" : item.type === "comment" ? "Comment" : "Ad";
                        const hasReviewPane = item.type === "comment" || item.type === "ad";
                        const history = getDeactivatedCaseHistory(item);
                        const historyKey = `case-${item.item.id}`;
                        const historyOpen = expandedFlagHistory.has(historyKey);
                        const action = item.item.flag_case_admin_action || null;
                        const hidden = isDeactivatedItemHidden(item);
                        const highlighted = hidden && action !== "reviewed" && action !== "flags_cleared";
                        const stampedAt = entry.sortAt || item.item.updated_at || item.item.created_at;
                        const commentText = (item.item.content || "")
                          .replace(/\n\n\[DEMO 3+\][\s\S]*$/, "")
                          .trim();
                        const totalFlags = item.flags?.length || Number(item.item.flag_count || 0);

                        const actionButtons = (
                          <div className="flex flex-wrap gap-1.5">
                            {action === "reviewed" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg text-xs h-7 text-mint-600 border-mint-200"
                                onClick={() => handleDeactivatedMarkUnreviewed(item)}
                              >
                                Mark Unreviewed
                              </Button>
                            ) : !hidden || action === "reactivated" || action === "overridden" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs h-7 text-destructive border-destructive/20"
                                  onClick={() => handleDeactivatedManuallyDeactivate(item)}
                                >
                                  Manually Deactivate
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs h-7 text-gray-600 border-gray-200"
                                  onClick={() => handleClearFlags(item)}
                                >
                                  Clear Flags
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs h-7 text-mint-600 border-mint-200"
                                  onClick={() => handleDeactivatedReviewed(item)}
                                >
                                  Reviewed
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs h-7 text-mint-600 border-mint-200"
                                  onClick={() => handleDeactivatedOverride(item)}
                                >
                                  Override 3+
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs h-7 text-gray-600 border-gray-200"
                                  onClick={() => handleClearFlags(item)}
                                >
                                  Clear Flags
                                </Button>
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
                        );

                        return (
                          <div
                            key={entry.id}
                            className={`rounded-xl border p-3 shadow-sm ${
                              highlighted
                                ? "border-violet-300 bg-violet-50/60"
                                : "border-violet-200 bg-violet-50/30"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-200 text-violet-800">
                                  3+ Deactivation
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  item.type === "event"
                                    ? "bg-mint-100 text-mint-600"
                                    : item.type === "comment"
                                      ? "bg-amber-100 text-amber-600"
                                      : "bg-peach-100 text-peach-600"
                                }`}>
                                  {typeLabel}
                                </span>
                                {action && (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    action === "manually_deactivated"
                                      ? "bg-red-100 text-red-600"
                                      : action === "flags_cleared"
                                        ? "bg-gray-100 text-gray-600"
                                        : "bg-mint-100 text-mint-700"
                                  }`}>
                                    {adminActionLabel[action] || "Reviewed"}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground shrink-0 text-right leading-5">
                                {formatFlagSubmittedAt(stampedAt)}
                              </p>
                            </div>

                            <div className={`grid gap-3 ${hasReviewPane ? "lg:grid-cols-[minmax(0,1fr)_minmax(200px,280px)]" : ""}`}>
                              <div className="min-w-0 space-y-2">
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

                                <div className="text-xs text-muted-foreground space-y-0.5">
                                  <p>
                                    <span className="font-medium text-foreground/80">
                                      {item.type === "comment" ? "Comment by" : item.type === "ad" ? "Ad Asset" : "Contributor"}:
                                    </span>{" "}
                                    {resolveDeactivatedContributor(item)}
                                  </p>
                                  <p>
                                    <span className="font-medium text-foreground/80">Flagged By ({totalFlags}):</span>
                                  </p>
                                  {totalFlags === 0 ? (
                                    <p>—</p>
                                  ) : (
                                    (item.flags || []).map((flag, idx) => (
                                      <p key={flag.id || idx}>
                                        • {resolveReporterName(flag)} ({flag.reason})
                                      </p>
                                    ))
                                  )}
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

                                {actionButtons}
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
                          </div>
                        );
                      })}
                    {flaggedFeedItems.length > PAGE_SIZE && (
                      <Paginator total={flaggedFeedItems.length} page={flaggedContentPage} onPage={setFlaggedContentPage} />
                    )}
                  </div>
                )}
              </AdminPanelShell>
            </>
          )}

          {flagsSection === "flags-users-flagging" && (
            <>
            <AdminSectionHeader title="Users Flagging Content" icon={Users} />
              <AdminPanelShell>
                <div className="pb-4 mb-4 border-b border-border flex flex-col sm:flex-row gap-2 sm:items-center">
                  <Input
                    placeholder="Search users…"
                    value={flaggingUserSearch}
                    onChange={(e) => { setFlaggingUserSearch(e.target.value); setFlaggingUsersPage(1); }}
                    className="rounded-lg h-8 text-sm sm:max-w-xs"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {FLAGGING_MIN_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => { setFlaggingMinFlags(opt.id); setFlaggingUsersPage(1); }}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                          flaggingMinFlags === opt.id
                            ? "border-mint-300 bg-mint-50 text-mint-700"
                            : "border-border bg-white text-muted-foreground hover:bg-mint-50 hover:border-mint-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {filteredFlaggingUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    {flaggingUsers.length === 0 ? "No users with flags yet" : "No users match your search or filter"}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredFlaggingUsers
                      .slice((flaggingUsersPage - 1) * PAGE_SIZE, flaggingUsersPage * PAGE_SIZE)
                      .map((u) => {
                        const profile = users.find((p) => p.id === u.id);
                        const isDisabled = disabledUsers.has(u.id) || profile?.role === "disabled";
                        const expanded = expandedFlaggingUsers.has(u.id);
                        const userFlags = expanded ? flagsFiledByUser(u.id) : [];

                        return (
                          <div
                            key={u.id}
                            className={`rounded-xl border p-3 shadow-sm ${
                              u.count >= 5 ? "border-peach-200 bg-peach-50/40" : "border-border bg-white"
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">{u.name || "Unknown"}</p>
                                {u.email ? (
                                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                ) : null}
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                      u.count >= 5
                                        ? "bg-destructive/10 text-destructive"
                                        : "bg-peach-50 text-peach-500"
                                    }`}
                                  >
                                    {u.count} Flag{u.count === 1 ? "" : "s"}
                                  </span>
                                  {isDisabled && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                                      Disabled
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs h-7"
                                  onClick={() => {
                                    setExpandedFlaggingUsers((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(u.id)) next.delete(u.id);
                                      else next.add(u.id);
                                      return next;
                                    });
                                  }}
                                >
                                  {expanded ? (
                                    <>
                                      <ChevronUp className="w-3.5 h-3.5 mr-1" />
                                      Hide Flagged Items
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="w-3.5 h-3.5 mr-1" />
                                      View Flagged Items
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`rounded-lg text-xs h-7 ${
                                    isDisabled
                                      ? "text-mint-500 border-mint-200"
                                      : "text-destructive border-destructive/20"
                                  }`}
                                  onClick={() =>
                                    isDisabled
                                      ? handleReactivateUser(u.id)
                                      : openDisableUserDialog(
                                          u.id,
                                          u.name || u.email,
                                          profile?.is_advertiser
                                        )
                                  }
                                >
                                  {isDisabled ? "Reactivate User" : "Disable User"}
                                </Button>
                              </div>
                            </div>

                            {expanded && (
                              <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
                                {userFlags.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">No flags found for this user.</p>
                                ) : (
                                  userFlags.map((f) => {
                                    const action = f.admin_action || (f.reviewed ? "reviewed" : null);
                                    const targetMeta = eventMap[f.target_id];
                                    const typeLabel =
                                      f.target_type === "event"
                                        ? "Activity"
                                        : f.target_type === "comment"
                                          ? "Comment"
                                          : "Ad";
                                    const hasReviewPane =
                                      f.target_type === "comment" || f.target_type === "ad";
                                    const reportedFlags = getReportedFlagOrdinal(f);
                                    const history = getFlaggedCardHistory(f);
                                    const historyKey = `flagging-${f.id}`;
                                    const historyOpen = expandedFlagHistory.has(historyKey);

                                    return (
                                      <div
                                        key={f.id}
                                        className={`rounded-xl border p-3 ${
                                          action ? "border-border bg-white" : "border-peach-200 bg-peach-50/50"
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                                            <span
                                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                f.target_type === "event"
                                                  ? "bg-mint-100 text-mint-600"
                                                  : f.target_type === "comment"
                                                    ? "bg-amber-100 text-amber-600"
                                                    : "bg-peach-100 text-peach-600"
                                              }`}
                                            >
                                              {typeLabel}
                                            </span>
                                            {action && (
                                              <span
                                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                  action === "manually_deactivated"
                                                    ? "bg-red-100 text-red-600"
                                                    : action === "flag_cleared"
                                                      ? "bg-gray-100 text-gray-600"
                                                      : "bg-mint-100 text-mint-700"
                                                }`}
                                              >
                                                {adminActionLabel[action] || "Reviewed"}
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[11px] text-muted-foreground shrink-0 text-right leading-5">
                                            {formatFlagSubmittedAt(f.created_date || f.created_at)}
                                          </p>
                                        </div>

                                        <div
                                          className={`grid gap-3 ${
                                            hasReviewPane
                                              ? "lg:grid-cols-[minmax(0,1fr)_minmax(200px,280px)]"
                                              : ""
                                          }`}
                                        >
                                          <div className="min-w-0 space-y-2">
                                            {f.target_type === "event" ? (
                                              <Link
                                                to={`/event/${f.target_id}`}
                                                className="text-sm font-semibold text-mint-600 hover:underline block truncate"
                                              >
                                                {targetMeta?.title || "Activity"}
                                              </Link>
                                            ) : f.target_type === "comment" ? (
                                              targetMeta?.event_id ? (
                                                <Link
                                                  to={`/event/${targetMeta.event_id}`}
                                                  className="text-sm font-semibold text-mint-600 hover:underline block truncate"
                                                >
                                                  {eventMap[targetMeta.event_id]?.title || "Activity"}
                                                </Link>
                                              ) : (
                                                <p className="text-sm font-semibold">Comment</p>
                                              )
                                            ) : (
                                              <p className="text-sm font-semibold truncate">
                                                {targetMeta?.title || f.target_contributor_name || "Ad Asset"}
                                              </p>
                                            )}

                                            <div className="text-xs text-muted-foreground space-y-0.5">
                                              <p>
                                                <span className="font-medium text-foreground/80">
                                                  {f.target_type === "comment"
                                                    ? "Comment by"
                                                    : f.target_type === "ad"
                                                      ? "Ad Asset"
                                                      : "Contributor"}
                                                  :
                                                </span>{" "}
                                                {resolveContributorName(f)}
                                              </p>
                                              <p>
                                                <span className="font-medium text-foreground/80">
                                                  Reported Flags:
                                                </span>{" "}
                                                {reportedFlags.position} of {reportedFlags.total}
                                              </p>
                                              <p>
                                                <span className="font-medium text-foreground/80">Reason:</span>{" "}
                                                <span className="capitalize">{f.reason || "—"}</span>
                                              </p>
                                              {f.details && (
                                                <p>
                                                  <span className="font-medium text-foreground/80">
                                                    Comments:
                                                  </span>{" "}
                                                  {f.details}
                                                </p>
                                              )}
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
                                                    {historyOpen
                                                      ? "Hide Admin History"
                                                      : `Admin History (${history.length})`}
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
                                          </div>

                                          {f.target_type === "comment" && (
                                            <div className="rounded-lg border border-border/70 bg-white/80 p-2.5 min-w-0">
                                              <p className="text-[11px] font-medium text-foreground/70 mb-1">
                                                Comment
                                              </p>
                                              <p className="text-xs text-foreground whitespace-pre-wrap break-words max-h-36 overflow-y-auto">
                                                {targetMeta?.content || "—"}
                                              </p>
                                            </div>
                                          )}
                                          {f.target_type === "ad" && (
                                            <div className="rounded-lg border border-border/70 bg-white/80 p-2.5 min-w-0 space-y-2">
                                              {targetMeta?.image_url ? (
                                                <img
                                                  src={targetMeta.image_url}
                                                  alt=""
                                                  className="w-20 aspect-[2/1] object-cover rounded-md border border-border"
                                                />
                                              ) : (
                                                <div className="w-20 aspect-[2/1] rounded-md border border-dashed border-border bg-muted/40 flex items-center justify-center">
                                                  <Image className="w-4 h-4 text-muted-foreground" />
                                                </div>
                                              )}
                                              {targetMeta?.link_url ? (
                                                <a
                                                  href={targetMeta.link_url}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="text-xs text-mint-600 hover:underline break-all"
                                                >
                                                  {targetMeta.link_url}
                                                </a>
                                              ) : (
                                                <p className="text-xs text-muted-foreground">No URL</p>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    {filteredFlaggingUsers.length > PAGE_SIZE && (
                      <Paginator
                        total={filteredFlaggingUsers.length}
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
                <AdminAdsPanel ads={ads} onRefresh={loadAll} toast={toast} />
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
              <AdminPanelShell wipNote="Admin CRUD works; applying codes at Stripe checkout returns after beta.">
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
                <div className="pb-4 mb-4 border-b border-border">
                  <Input
                    placeholder="Search users by name, email, or zip..."
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); setUsersPage(1); }}
                    className="rounded-lg h-8 text-sm"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th
                          className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/70"
                          onClick={() => {
                            if (userSortBy === "name") { setUserSortOrder(userSortOrder === "asc" ? "desc" : "asc"); }
                            else { setUserSortBy("name"); setUserSortOrder("asc"); }
                            setUsersPage(1);
                          }}
                        >
                          Name {userSortBy === "name" && (userSortOrder === "asc" ? "↑" : "↓")}
                        </th>
                        <th
                          className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/70"
                          onClick={() => {
                            if (userSortBy === "email") { setUserSortOrder(userSortOrder === "asc" ? "desc" : "asc"); }
                            else { setUserSortBy("email"); setUserSortOrder("asc"); }
                            setUsersPage(1);
                          }}
                        >
                          Email {userSortBy === "email" && (userSortOrder === "asc" ? "↑" : "↓")}
                        </th>
                        <th
                          className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/70"
                          onClick={() => {
                            if (userSortBy === "zip") { setUserSortOrder(userSortOrder === "asc" ? "desc" : "asc"); }
                            else { setUserSortBy("zip"); setUserSortOrder("asc"); }
                            setUsersPage(1);
                          }}
                        >
                          Zip {userSortBy === "zip" && (userSortOrder === "asc" ? "↑" : "↓")}
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                        <th
                          className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/70"
                          onClick={() => {
                            if (userSortBy === "joined") { setUserSortOrder(userSortOrder === "asc" ? "desc" : "asc"); }
                            else { setUserSortBy("joined"); setUserSortOrder("desc"); }
                            setUsersPage(1);
                          }}
                        >
                          Joined {userSortBy === "joined" && (userSortOrder === "asc" ? "↑" : "↓")}
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredAndSortedUsers.slice((usersPage - 1) * PAGE_SIZE, usersPage * PAGE_SIZE).map((u) => {
                        const isDisabled = u.role === "disabled" || disabledUsers.has(u.id);
                        const displayName = organizerMap[u.id]
                          ? organizerMap[u.id]
                          : (u.first_name || u.last_name)
                            ? `${u.first_name || ""} ${u.last_name || ""}`.trim()
                            : (u.full_name && !u.full_name.includes("@")) ? u.full_name : "—";
                        return (
                          <tr key={u.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3">{displayName}</td>
                            <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                            <td className="px-4 py-3 text-muted-foreground tabular-nums">{u.zip_code || "—"}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted capitalize">
                                {u.role === "community_member" ? "Community Member" : u.role === "organizer" ? "Organizer" : u.role === "admin" ? "Admin" : u.role === "disabled" ? "Disabled" : "Needs Setup"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{moment(u.created_date).format("MMM D, YYYY")}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`rounded-lg text-xs h-7 ${u.is_advertiser ? "text-peach-500 border-peach-200" : "text-muted-foreground border-border"}`}
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
                                    if (next) {
                                      await notifyBecameSupporter(u.id);
                                    }
                                    toast({ title: next ? "Supporter role granted" : "Supporter role removed" });
                                  }}
                                >
                                  {u.is_advertiser ? "✦ Supporter" : "Grant Supporter"}
                                </Button>
                                {u.role !== "admin" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className={`rounded-lg text-xs h-7 ${isDisabled ? "text-mint-500 border-mint-200" : "text-destructive border-destructive/20"}`}
                                    onClick={() =>
                                      isDisabled
                                        ? handleReactivateUser(u.id)
                                        : openDisableUserDialog(u.id, displayName, u.is_advertiser)
                                    }
                                  >
                                    {isDisabled ? "Reactivate" : "Disable"}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Paginator total={filteredAndSortedUsers.length} page={usersPage} onPage={setUsersPage} />
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
                <div className="pb-4 mb-4 border-b border-border">
                  <Input
                    placeholder="Search reactivation requests…"
                    value={reactivationSearch}
                    onChange={(e) => { setReactivationSearch(e.target.value); setReactivationPage(1); }}
                    className="rounded-lg h-8 text-sm sm:max-w-xs"
                  />
                </div>
                {filteredReactivationRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    {reactivationRequests.length === 0
                      ? "No reactivation requests yet"
                      : "No requests match your search"}
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
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-semibold text-sm">{r.sender_name}</span>
                                <span className="text-xs text-muted-foreground">{r.sender_email}</span>
                                {r.sender_phone && (
                                  <span className="text-xs text-muted-foreground">· {formatPhoneDisplay(r.sender_phone)}</span>
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
                              <p className="text-xs font-medium text-muted-foreground">Request to Reactivate My Account</p>
                              <p className="text-sm whitespace-pre-wrap">{r.message}</p>
                              {profile?.disabled_note && pending && (
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground/80">Original disable note:</span>{" "}
                                  {profile.disabled_note}
                                </p>
                              )}
                              {declined && r.admin_note && (
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground/80">Decline note:</span> {r.admin_note}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {formatMessageSubmittedAt(r.created_date || r.created_at)}
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
                                  onClick={() => handleReactivateUser(r.user_id, { requestId: r.id })}
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
          if (!open) setDisableDialog({ open: false, userId: null, userName: "", isSupporter: false });
        }}
        title="Disable User Account"
        description={
          disableDialog.isSupporter
            ? `Disable ${disableDialog.userName}? As a Supporter this turns off digests, blocks sign-in, cancels active ads (and Stripe auto-renew), releases zip slots, and clears their waitlist.`
            : `Disable ${disableDialog.userName}? They will be treated as signed out, digests will be turned off, and they will see your note when they sign in.`
        }
        noteLabel="Note to User"
        notePlaceholder="Explain why this account is being disabled…"
        confirmLabel="Disable Account"
        loading={disableBusy}
        onConfirm={handleDisableUser}
      />

      <AdminNoteConfirmDialog
        open={declineDialog.open}
        onOpenChange={(open) => {
          if (!open) setDeclineDialog({ open: false, request: null });
        }}
        title="Decline Reactivation Request"
        description="This closes the request. The user will see your decline note and cannot submit another request."
        noteLabel="Note to User"
        notePlaceholder="Explain why this request is being declined…"
        confirmLabel="Decline Request"
        loading={disableBusy}
        onConfirm={handleDeclineReactivation}
      />
    </div>
  );
}