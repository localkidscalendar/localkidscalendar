import React, { useState, useEffect, useMemo } from "react";
import { useOutletContext, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Shield, CalendarDays, Flag, Megaphone, Users, Trash2, Eye, BarChart3, Mail, Send, Image, Ban, Archive, Clock, DollarSign, Tag, ImagePlus, MapPin, FlaskConical, Bell, UserPlus, HelpCircle, MessageSquare, RotateCcw } from "lucide-react";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";

import FAQManagerV2 from "@/components/admin/FAQManager";
import InviteOrganizer from "@/components/admin/InviteOrganizer";
import SiteEmailsTester from "@/components/admin/SiteEmailsTester";
import AdminAdsPanel from "@/components/admin/AdminAdsPanel";
import AdminPanelShell from "@/components/admin/AdminPanelShell";
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
import moment from "moment";

const ADS_SECTIONS = [
  { id: "ads-photo-review", label: "Photo Review" },
  { id: "ads-supporter-ads", label: "Supporter Ads" },
  { id: "ads-zip-config", label: "Zip Config" },
  { id: "ads-waitlist", label: "Waitlist" },
  { id: "ads-rates", label: "Ad Rates" },
  { id: "ads-discounts", label: "Discounts" },
  { id: "ads-default-filler", label: "Default/Filler" },
];

function scrollToAdsSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  const [testEmailFreq, setTestEmailFreq] = useState("weekly");
  const [sendingTest, setSendingTest] = useState(false);
  const [eventSearch, setEventSearch] = useState("");
  const [eventSortBy, setEventSortBy] = useState("date");
  const [eventSortOrder, setEventSortOrder] = useState("desc");
  const [userSearch, setUserSearch] = useState("");
  const [userSortBy, setUserSortBy] = useState("joined");
  const [userSortOrder, setUserSortOrder] = useState("desc");
  const [activeTab, setActiveTab] = useState("activities");
  const [disabledUsers, setDisabledUsers] = useState(new Set());
  const [organizerMap, setOrganizerMap] = useState({});

  // Pagination state
  const [eventsPage, setEventsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [messagesPage, setMessagesPage] = useState(1);
  const [flaggedContentPage, setFlaggedContentPage] = useState(1);
  const [disabledContentPage, setDisabledContentPage] = useState(1);
  const [flaggingUsersPage, setFlaggingUsersPage] = useState(1);
  const [archivedItemsPage, setArchivedItemsPage] = useState(1);

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
      const [evtsRes, usersRes, msgsRes, orgRes, flagsRes, adsRes] = await Promise.all([
        supabase.from("events").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("organizers").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("flag_reports").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("banner_ads").select("*").order("created_at", { ascending: false }).limit(100),
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

      setEvents(evts);
      setFlags(flg);
      setAds(adsList);
      setUsers(usersList);
      setMessages(msgs);
      const map = {};
      orgList.forEach((o) => { if (o.user_id) map[o.user_id] = o.org_name; });
      setOrganizerMap(map);
      setStats({
        totalEvents: evts.filter((e) => e.status === "active").length,
        totalUsers: usersList.length,
        totalFlags: (flagsRes.data || []).filter((f) => !f.reviewed).length,
        activeAds: adsList.filter((a) => a.status === "active").length,
        organizers: usersList.filter((u) => u.role === "organizer").length,
        unreadMessages: msgs.filter((m) => m.status === "unread").length,
      });
    } catch (err) {
      console.error("Admin load failed", err);
      toast({ title: "Failed to load admin data", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const sendEventDeletionEmail = async (_event, _notes) => {
    // Email delivery is not wired on Supabase yet; removal notes still show on My Posts.
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
    sendEventDeletionEmail(event, notes.trim());
    toast({ title: "Activity removed" });
    loadAll();
  };

  const [sendingPreview, setSendingPreview] = useState(false);
  const [eventMap, setEventMap] = useState({});
  const [deletedItems, setDeletedItems] = useState([]);
  const [flaggingUsers, setFlaggingUsers] = useState([]);

  useEffect(() => {
    if (flags.length > 0) loadEventTitles();
  }, [flags]);

  useEffect(() => {
    if (events.length > 0) loadDeletedItems();
  }, [events]);

  useEffect(() => {
    if (events.length > 0) loadFlaggingUsers();
  }, [events, flags]);

  const loadEventTitles = async () => {
    try {
      const eventIds = [...new Set(flags.filter((f) => f.target_type === "event").map((f) => f.target_id))];
      const commentIds = [...new Set(flags.filter((f) => f.target_type === "comment").map((f) => f.target_id))];
      const titles = {};

      if (eventIds.length) {
        const { data } = await supabase.from("events").select("id, title").in("id", eventIds);
        (data || []).forEach((e) => { titles[e.id] = { type: "event", title: e.title }; });
      }

      if (commentIds.length) {
        const { data: comments } = await supabase.from("comments").select("id, content, event_id").in("id", commentIds);
        for (const c of comments || []) {
          titles[c.id] = { type: "comment", content: c.content, event_id: c.event_id };
          if (c.event_id && !titles[c.event_id]) {
            const { data: e } = await supabase.from("events").select("id, title").eq("id", c.event_id).maybeSingle();
            if (e) titles[e.id] = { type: "event", title: e.title };
          }
        }
      }
      setEventMap(titles);
    } catch {}
  };

  const loadDeletedItems = async () => {
    try {
      const [{ data: archivedEvents }, { data: archivedComments }] = await Promise.all([
        supabase.from("events").select("*").eq("status", "archived").order("created_at", { ascending: false }).limit(50),
        supabase.from("comments").select("*").eq("status", "archived").order("created_at", { ascending: false }).limit(50),
      ]);
      const itemsWithFlags = (archivedEvents || []).map((e) => {
        const relatedFlags = flags.filter((f) => f.target_id === e.id && f.target_type === "event");
        return { type: "event", item: withCreatedDate(e), flags: relatedFlags };
      });
      const commentsWithFlags = (archivedComments || []).map((c) => {
        const relatedFlags = flags.filter((f) => f.target_id === c.id && f.target_type === "comment");
        const eventTitle = eventMap[c.event_id] || "—";
        return { type: "comment", item: withCreatedDate(c), flags: relatedFlags, eventTitle };
      });
      setDeletedItems([...itemsWithFlags, ...commentsWithFlags]);
    } catch {}
  };

  const loadFlaggingUsers = async () => {
    try {
      // Count each flag report once (do not also tally events.flagged_by — that double-counts)
      const tally = {};
      flags.forEach((f) => {
        if (!f.reporter_id) return;
        if (!tally[f.reporter_id]) {
          tally[f.reporter_id] = { id: f.reporter_id, name: null, count: 0 };
        }
        tally[f.reporter_id].count += 1;
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
        return { ...t, name };
      }).sort((a, b) => b.count - a.count);
      setFlaggingUsers(result);
    } catch {}
  };

  const handleSendTestEmail = async () => {
    toast({
      title: "Not available yet",
      description: "Notification emails will be wired after the email engine is moved off Base44.",
      variant: "destructive",
    });
  };

  const handleSendPreviewToMe = async () => {
    toast({
      title: "Not available yet",
      description: "Preview emails will be wired after the email engine is moved off Base44.",
      variant: "destructive",
    });
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

  const handleReactivateItem = async (itemId, itemType) => {
    const table = itemType === "event" ? "events" : "comments";
    const updates = { status: "active", updated_at: new Date().toISOString() };
    if (itemType === "event") updates.admin_notes = "";
    const { error } = await supabase.from(table).update(updates).eq("id", itemId);
    if (error) {
      toast({ title: "Failed to reactivate", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${itemType === "event" ? "Event" : "Comment"} reactivated` });
    loadAll();
  };

  const handleApproveDelete = async (itemId) => {
    const item = deletedItems.find((d) => d.item.id === itemId);
    if (item) {
      const table = item.type === "event" ? "events" : "comments";
      const { error } = await supabase.from(table).delete().eq("id", itemId);
      if (error) {
        toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: `${item.type === "event" ? "Event" : "Comment"} permanently deleted` });
      loadAll();
    }
  };

  const handleDisableUser = async (userId) => {
    if (!window.confirm("Are you sure you want to disable this user? They will be unable to access the platform.")) return;
    const { error } = await supabase.from("profiles").update({
      role: "disabled",
      updated_at: new Date().toISOString(),
    }).eq("id", userId);
    if (error) {
      toast({ title: "Failed to disable user", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "User account disabled" });
    setDisabledUsers((prev) => new Set([...prev, userId]));
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: "disabled" } : u)));
  };

  const handleReactivateUser = async (userId) => {
    if (!window.confirm("Are you sure you want to reactivate this user?")) return;
    const { error } = await supabase.from("profiles").update({
      role: "community_member",
      updated_at: new Date().toISOString(),
    }).eq("id", userId);
    if (error) {
      toast({ title: "Failed to reactivate user", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "User account reactivated" });
    setDisabledUsers((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: "community_member" } : u)));
  };

  const handleRemoveFlaggedItem = async (flagId, targetId, targetType) => {
    if (!window.confirm("Archive this item? You can restore it later from the Archived Items section.")) return;
    const table = targetType === "event" ? "events" : "comments";
    const { error } = await supabase.from(table).update({
      status: "archived",
      updated_at: new Date().toISOString(),
    }).eq("id", targetId);
    if (error) {
      toast({ title: "Failed to archive", description: error.message, variant: "destructive" });
      return;
    }
    if (flagId) {
      await supabase.from("flag_reports").delete().eq("id", flagId);
    }
    toast({ title: `${targetType === "event" ? "Event" : "Comment"} archived` });
    loadAll();
  };

  const handleRestoreArchivedItem = async (itemId, itemType) => {
    const table = itemType === "event" ? "events" : "comments";
    const { error } = await supabase.from(table).update({
      status: "active",
      updated_at: new Date().toISOString(),
    }).eq("id", itemId);
    if (error) {
      toast({ title: "Failed to restore", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${itemType === "event" ? "Event" : "Comment"} restored` });
    loadAll();
  };

  const handlePermanentlyDeleteArchivedItem = async (itemId, itemType) => {
    if (!window.confirm("Permanently delete this item? This cannot be undone.")) return;
    const table = itemType === "event" ? "events" : "comments";
    const { error } = await supabase.from(table).delete().eq("id", itemId);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${itemType === "event" ? "Event" : "Comment"} permanently deleted` });
    loadAll();
  };

  const handleClearFlag = async (flagId) => {
    const report = flags.find((f) => f.id === flagId);
    if (!report) return;

    const { error } = await supabase.from("flag_reports").delete().eq("id", flagId);
    if (error) {
      toast({ title: "Failed to clear flag", description: error.message, variant: "destructive" });
      return;
    }

    // Fully remove this report so the user can flag again if needed
    if (report.target_type === "event" || report.target_type === "comment") {
      const table = report.target_type === "event" ? "events" : "comments";
      const { data: row } = await supabase
        .from(table)
        .select("flag_count, flagged_by")
        .eq("id", report.target_id)
        .maybeSingle();
      if (row) {
        const nextBy = (row.flagged_by || []).filter((id) => id !== report.reporter_id);
        await supabase.from(table).update({
          flag_count: Math.max(0, Number(row.flag_count || 0) - 1),
          flagged_by: nextBy,
          updated_at: new Date().toISOString(),
        }).eq("id", report.target_id);
      }
    }

    toast({ title: "Flag cleared" });
    loadAll();
  };

  const handleReviewedFlag = async (flagId) => {
    // Soft-dismiss: hide from admin list, keep the report so re-flagging stays blocked
    const { error } = await supabase
      .from("flag_reports")
      .update({ reviewed: true })
      .eq("id", flagId);
    if (error) {
      toast({ title: "Failed to mark reviewed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Marked as reviewed" });
    loadAll();
  };

  const resolveReporterName = (f) =>
    organizerMap[f.reporter_id]
    || f.reporter_name
    || users.find((u) => u.id === f.reporter_id)?.full_name
    || "—";

  const resolveContributorName = (f) => {
    if (f.target_type === "event") {
      const ev = events.find((e) => e.id === f.target_id);
      if (ev?.org_name) return ev.org_name;
      if (ev?.created_by_id && organizerMap[ev.created_by_id]) return organizerMap[ev.created_by_id];
    }
    return f.target_contributor_name || "—";
  };

  const openFlags = useMemo(() => flags.filter((f) => !f.reviewed), [flags]);

  const filteredAndSortedEvents = useMemo(() => {
    let filtered = events;
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
  }, [events, eventSearch, eventSortBy, eventSortOrder]);

  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users;
    if (userSearch.trim()) {
      const search = userSearch.toLowerCase();
      filtered = users.filter((u) =>
        (u.full_name || "").toLowerCase().includes(search)
        || (u.first_name || "").toLowerCase().includes(search)
        || (u.last_name || "").toLowerCase().includes(search)
        || (u.email || "").toLowerCase().includes(search)
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
    } else {
      sorted.sort((a, b) => {
        const aDate = new Date(a.created_date);
        const bDate = new Date(b.created_date);
        return userSortOrder === "asc" ? aDate - bDate : bDate - aDate;
      });
    }
    return sorted;
  }, [users, userSearch, userSortBy, userSortOrder]);

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
          <TabsTrigger value="email" className="rounded-lg text-sm">Email</TabsTrigger>
          <TabsTrigger value="faq" className="rounded-lg text-sm">FAQs</TabsTrigger>
          <TabsTrigger value="flags" className="rounded-lg text-sm">Flags</TabsTrigger>
          <TabsTrigger value="manual" className="rounded-lg text-sm">Manual</TabsTrigger>
          <TabsTrigger value="messages" className="rounded-lg text-sm">
            Messages {stats.unreadMessages > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-peach-100 text-peach-500 text-xs font-bold">{stats.unreadMessages}</span>}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-lg text-sm">Notifications</TabsTrigger>
          <TabsTrigger value="users" className="rounded-lg text-sm">Users</TabsTrigger>
          <TabsTrigger value="beta" className="rounded-lg text-sm">Beta</TabsTrigger>
        </TabsList>

        <TabsContent value="activities">
          <div className="mb-6">
            <AdminSectionHeader title="Activity Photo Manual Review" icon={Image} />
            <AdminActivityPhotoReviewPanel toast={toast} />
          </div>
          <AdminSectionHeader title="All Activities" icon={CalendarDays} />
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border">
              <Input
                placeholder="Search by title or zip code…"
                value={eventSearch}
                onChange={(e) => { setEventSearch(e.target.value); setEventsPage(1); }}
                className="rounded-lg h-8 text-sm"
              />
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
                  {filteredAndSortedEvents.slice((eventsPage - 1) * PAGE_SIZE, eventsPage * PAGE_SIZE).map((e) => (
                    <tr key={e.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 max-w-[200px] truncate">{e.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{moment(e.start_date).format("MMM D, YY")}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.status === "active" ? "bg-mint-50 text-mint-500" : "bg-red-50 text-red-500"}`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">{e.flag_count || 0}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/event/${e.id}`)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {e.status === "active" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteEvent(e)} title="Delete activity">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {e.status === "deleted" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleReactivateItem(e.id, "event")} title="Restore this activity to active">
                              <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginator total={filteredAndSortedEvents.length} page={eventsPage} onPage={setEventsPage} />
          </div>
        </TabsContent>

        <TabsContent value="flags">
          <div className="space-y-6">
            {/* Flagged Events (from Event records directly) */}
            <div>
              <AdminSectionHeader title="Flagged Content (Activities & Comments)" icon={Flag} />
              <div className="bg-white rounded-2xl border border-border p-4">
              {(() => {
                // Show open (not yet reviewed) flag reports only
                const pageItems = openFlags.slice((flaggedContentPage - 1) * PAGE_SIZE, flaggedContentPage * PAGE_SIZE);
                return openFlags.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No flags reported</p>
                ) : (
                  <>
                <div className="space-y-3">
                  {pageItems.map((f) => (
                    <div key={f.id} className="p-3 bg-peach-50/50 rounded-xl border border-peach-100">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.target_type === "event" ? "bg-mint-100 text-mint-600" : f.target_type === "comment" ? "bg-amber-100 text-amber-600" : "bg-peach-100 text-peach-600"}`}>
                            {f.target_type === "event" ? "Activity" : f.target_type === "comment" ? "Comment" : "Ad"}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">{moment.utc(f.created_date).local().fromNow()}</span>
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          {f.target_type === "event" ? (
                            <Link to={`/event/${f.target_id}`} className="text-sm font-medium text-mint-500 hover:underline">
                              {eventMap[f.target_id]?.title || "Loading..."}
                            </Link>
                          ) : f.target_type === "comment" ? (
                            <Link to={`/event/${eventMap[f.target_id]?.event_id}`} className="text-sm font-medium text-mint-500 hover:underline">
                              {eventMap[eventMap[f.target_id]?.event_id]?.title || "Loading..."}
                            </Link>
                          ) : (
                            <span className="text-sm font-medium">{f.target_contributor_name || "Ad"}</span>
                          )}
                        </div>
                        <div className="text-xs space-y-1 bg-white/50 rounded p-2">
                          {f.target_type === "event" ? (
                            <p><span className="font-medium">Contributor:</span> {resolveContributorName(f)}</p>
                          ) : f.target_type === "comment" ? (
                            <>
                              <p><span className="font-medium">User:</span> {resolveContributorName(f)}</p>
                              <p><span className="font-medium">Comment:</span> {eventMap[f.target_id]?.content?.substring(0, 150) || "—"}</p>
                            </>
                          ) : (
                            <p><span className="font-medium">Business:</span> {f.target_contributor_name || "—"}</p>
                          )}
                          <p><span className="font-medium">Reported by:</span> {resolveReporterName(f)}</p>
                          <p><span className="font-medium">Reason:</span> <span className="capitalize">{f.reason}</span></p>
                          {f.details && <p><span className="font-medium">Details:</span> {f.details}</p>}
                        </div>
                        <div className="flex gap-2 pt-2 flex-wrap">
                          {f.target_type !== "ad" && (
                            <Button size="sm" variant="outline" className="rounded-lg text-xs h-7 text-destructive border-destructive/20" onClick={() => handleRemoveFlaggedItem(f.id, f.target_id, f.target_type)} title="Hide this activity/comment from the public site">
                              Deactivate
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="rounded-lg text-xs h-7 text-gray-600 border-gray-200" onClick={() => handleClearFlag(f.id)} title="Remove only this report (user may flag again)">
                            Clear Flag
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-lg text-xs h-7 text-mint-600 border-mint-200" onClick={() => handleReviewedFlag(f.id)} title="Hide from this list; keeps the flag on record">
                            Reviewed/Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Paginator total={openFlags.length} page={flaggedContentPage} onPage={setFlaggedContentPage} />
                  </>
                );
              })()}
              </div>
            </div>

            {/* Disabled Items */}
            <div>
              <AdminSectionHeader title="Deactivated Content (Flagged 3+ times)" icon={Ban} />
              <div className="bg-white rounded-2xl border border-border p-4">
              {deletedItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No disabled items</p>
              ) : (
                <>
                <div className="space-y-3">
                  {deletedItems.slice((disabledContentPage - 1) * PAGE_SIZE, disabledContentPage * PAGE_SIZE).map((item) => (
                    <div key={item.item.id} className="p-3 bg-red-50/30 rounded-xl border border-red-100">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            {item.type === "event" && (
                              <Link to={`/event/${item.item.id}`} className="text-sm font-medium text-mint-500 hover:underline">
                                {item.item.title}
                              </Link>
                            )}
                            {item.type === "comment" && (
                              <div className="text-xs">
                                <Link to={`/event/${item.item.event_id}`} className="text-sm font-medium text-mint-500 hover:underline">
                                  {item.eventTitle}
                                </Link>
                                <p className="text-muted-foreground mt-1">Comment: {item.item.content?.substring(0, 100)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-xs bg-white/50 rounded p-2 space-y-1">
                          <p className="font-medium mb-1">Flagged by ({item.flags.length}):</p>
                          {item.flags.map((flag, idx) => (
                            <p key={idx} className="text-muted-foreground">
                              • {flag.reporter_name} ({flag.reason})
                            </p>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg text-xs h-7 text-mint-500 border-mint-200"
                            onClick={() => handleReactivateItem(item.item.id, item.type)}
                          >
                            Reactivate
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg text-xs h-7 text-destructive border-destructive/20"
                            onClick={() => handleApproveDelete(item.item.id)}
                          >
                            Approve Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Paginator total={deletedItems.length} page={disabledContentPage} onPage={setDisabledContentPage} />
                </>
              )}
              </div>
            </div>

            {/* Flagging Users */}
            <div>
              <AdminSectionHeader title="Users Flagging Content" icon={Users} />
              <div className="bg-white rounded-2xl border border-border p-4">
              {flaggingUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No users with flags yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Flags Count</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {flaggingUsers.slice((flaggingUsersPage - 1) * PAGE_SIZE, flaggingUsersPage * PAGE_SIZE).map((u) => (
                        <tr key={u.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">{u.name || "Unknown"}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.count >= 5 ? "bg-destructive/10 text-destructive" : "bg-peach-50 text-peach-500"}`}>
                              {u.count}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className={`rounded-lg text-xs h-7 ${disabledUsers.has(u.id) ? "text-mint-500 border-mint-200" : "text-destructive border-destructive/20"}`}
                              onClick={() => disabledUsers.has(u.id) ? handleReactivateUser(u.id) : handleDisableUser(u.id)}
                            >
                              {disabledUsers.has(u.id) ? "Reactivate User" : "Disable User"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Paginator total={flaggingUsers.length} page={flaggingUsersPage} onPage={setFlaggingUsersPage} />
                </div>
              )}
              </div>
            </div>

            {/* Archived Items (Manual Deletions) */}
            <div>
              <AdminSectionHeader title="Archived Items (Admin Manual Delete)" subtitle="Items archived by admin can be restored or permanently deleted." icon={Archive} />
              <div className="bg-white rounded-2xl border border-border p-4">
              {deletedItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No archived items</p>
              ) : (
                <>
                <div className="space-y-3">
                  {deletedItems.slice((archivedItemsPage - 1) * PAGE_SIZE, archivedItemsPage * PAGE_SIZE).map((item) => (
                    <div key={item.item.id} className="p-3 bg-amber-50/30 rounded-xl border border-amber-100">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            {item.type === "event" && (
                              <Link to={`/event/${item.item.id}`} className="text-sm font-medium text-mint-500 hover:underline">
                                {item.item.title}
                              </Link>
                            )}
                            {item.type === "comment" && (
                              <div className="text-xs">
                                <Link to={`/event/${item.item.event_id}`} className="text-sm font-medium text-mint-500 hover:underline">
                                  {item.eventTitle}
                                </Link>
                                <p className="text-muted-foreground mt-1">Comment: {item.item.content?.substring(0, 100)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg text-xs h-7 text-mint-500 border-mint-200"
                            onClick={() => handleRestoreArchivedItem(item.item.id, item.type)}
                          >
                            Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg text-xs h-7 text-destructive border-destructive/20"
                            onClick={() => handlePermanentlyDeleteArchivedItem(item.item.id, item.type)}
                          >
                            Permanently Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Paginator total={deletedItems.length} page={archivedItemsPage} onPage={setArchivedItemsPage} />
                </>
              )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ads">
          <div className="space-y-8">
            <nav
              aria-label="Ads sections"
              className="sticky top-0 z-20 -mx-1 px-1 py-2.5 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border"
            >
              <div className="flex flex-wrap gap-1.5">
                {ADS_SECTIONS.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToAdsSection(section.id)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white hover:bg-mint-50 hover:border-mint-200 hover:text-mint-700 text-muted-foreground font-medium transition-colors"
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </nav>

            <div id="ads-photo-review" className="scroll-mt-16">
              <AdminSectionHeader title="Advertising Photo Manual Review" icon={Image} />
              <AdminPanelShell>
                <ManualReviewPanel toast={toast} />
              </AdminPanelShell>
            </div>
            <div id="ads-supporter-ads" className="scroll-mt-16">
              <AdminSectionHeader title="All Supporter Ads" icon={Megaphone} />
              <AdminPanelShell>
                <AdminAdsPanel ads={ads} onRefresh={loadAll} toast={toast} />
              </AdminPanelShell>
            </div>
            <div id="ads-zip-config" className="scroll-mt-16">
              <AdminSectionHeader title="Custom Zip Code Configurations" icon={MapPin} />
              <AdminPanelShell>
                <AdminZipConfigPanel ads={ads} toast={toast} />
              </AdminPanelShell>
            </div>
            <div id="ads-waitlist" className="scroll-mt-16">
              <AdminSectionHeader title="Waitlist Management" icon={Clock} />
              <AdminPanelShell wipNote="Automated offer emails return with billing. Manual Offer Spot works when a slot is already open.">
                <AdminWaitlistPanel toast={toast} />
              </AdminPanelShell>
            </div>
            <div id="ads-rates" className="scroll-mt-16">
              <AdminSectionHeader title="Ad Rates" icon={DollarSign} />
              <AdminPanelShell>
                <AdminAdRatesPanel toast={toast} />
              </AdminPanelShell>
            </div>
            <div id="ads-discounts" className="scroll-mt-16">
              <AdminSectionHeader title="Discount Codes" icon={Tag} />
              <AdminPanelShell wipNote="Admin CRUD works; applying codes at Stripe checkout returns after beta.">
                <DiscountCodesPanel toast={toast} />
              </AdminPanelShell>
            </div>
            <div id="ads-default-filler" className="scroll-mt-16">
              <AdminSectionHeader title="Default/Filler Ads" icon={ImagePlus} />
              <AdminPanelShell>
                <AdminDefaultAdsPanel toast={toast} />
              </AdminPanelShell>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="mb-8">
            <AdminSectionHeader title="User Zip Code Reports" icon={MapPin} />
            <AdminUserZipReportsSection />
          </div>

          <AdminSectionHeader title="List of Users" icon={Users} />
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border">
              <Input
                placeholder="Search users by name or email..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setUsersPage(1); }}
                className="rounded-lg"
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
                  {filteredAndSortedUsers.slice((usersPage - 1) * PAGE_SIZE, usersPage * PAGE_SIZE).map((u) => (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">{
                        organizerMap[u.id]
                          ? organizerMap[u.id]
                          : (u.first_name || u.last_name)
                            ? `${u.first_name || ""} ${u.last_name || ""}`.trim()
                            : (u.full_name && !u.full_name.includes('@')) ? u.full_name : "—"
                      }</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
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
                              toast({ title: next ? "Supporter role granted" : "Supporter role removed" });
                            }}
                          >
                            {u.is_advertiser ? "✦ Supporter" : "Grant Supporter"}
                          </Button>
                          {u.role !== "admin" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className={`rounded-lg text-xs h-7 ${u.role === "disabled" ? "text-mint-500 border-mint-200" : "text-destructive border-destructive/20"}`}
                              onClick={() => u.role === "disabled" ? handleReactivateUser(u.id) : handleDisableUser(u.id)}
                            >
                              {u.role === "disabled" ? "Reactivate" : "Disable"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginator total={filteredAndSortedUsers.length} page={usersPage} onPage={setUsersPage} />
          </div>
        </TabsContent>
        <TabsContent value="beta">
          <AdminSectionHeader title="Beta Mode" subtitle="When on, the site banner appears and only listed zip codes are functional." icon={FlaskConical} />
          <AdminBetaPanel toast={toast} />
        </TabsContent>

        <TabsContent value="notifications">
          <AdminSectionHeader title="Manually Send Notification Emails" subtitle="Triggers the email engine now for all users with matching preferences." icon={Bell} />
          <div className="bg-white rounded-2xl border border-border p-6">
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="text-sm font-medium block mb-1">Frequency to simulate</label>
                <Select value={testEmailFreq} onValueChange={setTestEmailFreq}>
                  <SelectTrigger className="rounded-xl max-w-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="all">All frequencies</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Emails will be sent to every user whose preference frequency matches the selected value.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
                  onClick={handleSendPreviewToMe}
                  disabled={sendingPreview}
                >
                  {sendingPreview ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                  Send Preview to Me ({user?.email})
                </Button>

                <Button
                  variant="outline"
                  className="rounded-xl border-border text-foreground hover:bg-muted"
                  onClick={handleSendTestEmail}
                  disabled={sendingTest}
                >
                  {sendingTest ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Send to All Matching Users
                </Button>
              </div>

              <div className="bg-muted/40 rounded-xl p-3 text-xs text-muted-foreground space-y-1">
                <p><strong>Send Preview to Me</strong> — sends a single email only to your address ({user?.email}) using upcoming active events, regardless of your saved preferences. Safe for testing.</p>
                <p><strong>Send to All Matching Users</strong> — sends real emails to every user whose preference frequency matches the selected value.</p>
                <p className="pt-2 border-t border-muted/20"><strong>Automated Schedule:</strong> Automation runs every day at 8am PT — it automatically sends daily digests every day, weekly digests only on Mondays, and monthly digests only on the 1st of each month, all in one pass.</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="email">
          <div className="space-y-8">
            <div>
              <AdminSectionHeader title="Invite Organizer" icon={UserPlus} />
              <InviteOrganizer />
            </div>
            <div>
              <AdminSectionHeader title="Site Emails Tester" icon={Mail} />
              <SiteEmailsTester />
            </div>
          </div>
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

        <TabsContent value="messages">
          <AdminSectionHeader title="Messages" icon={MessageSquare} />
          <div className="bg-white rounded-2xl border border-border divide-y divide-border">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No messages yet</p>
            ) : (
              messages.slice((messagesPage - 1) * PAGE_SIZE, messagesPage * PAGE_SIZE).map((m) => (
                <div key={m.id} className={`p-4 flex flex-col sm:flex-row sm:items-start gap-3 ${m.status === "unread" ? "bg-mint-50/40" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm">{m.sender_name}</span>
                      <span className="text-xs text-muted-foreground">{m.sender_email}</span>
                      {m.sender_phone && <span className="text-xs text-muted-foreground">· {m.sender_phone}</span>}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.status === "unread" ? "bg-peach-50 text-peach-500" : m.status === "resolved" ? "bg-mint-50 text-mint-500" : "bg-muted text-muted-foreground"}`}>{m.status}</span>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{m.subject}</p>
                    <p className="text-sm">{m.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{moment.utc(m.created_date).local().fromNow()}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {m.status === "unread" && (
                      <Button variant="outline" size="sm" className="rounded-lg text-xs h-7" onClick={async () => {
                        const { error } = await supabase.from("contact_messages").update({ status: "read", updated_at: new Date().toISOString() }).eq("id", m.id);
                        if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
                        else loadAll();
                      }}>
                        Mark Read
                      </Button>
                    )}
                    {m.status !== "resolved" && (
                      <Button variant="outline" size="sm" className="rounded-lg text-xs h-7 text-mint-500 border-mint-200" onClick={async () => {
                        const { error } = await supabase.from("contact_messages").update({ status: "resolved", updated_at: new Date().toISOString() }).eq("id", m.id);
                        if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
                        else loadAll();
                      }}>
                        Resolve
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => {
                      const { error } = await supabase.from("contact_messages").delete().eq("id", m.id);
                      if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
                      else loadAll();
                    }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            {messages.length > PAGE_SIZE && (
              <Paginator total={messages.length} page={messagesPage} onPage={setMessagesPage} />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}