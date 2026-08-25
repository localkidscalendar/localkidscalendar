import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiUrl } from "@/lib/apiBase";
import { restoreRoleFromProfile } from "@/lib/authRoles";
import { QUEUE_STATUSES, SLOT_HOLDING_STATUSES } from "@/lib/waitlistQueue";
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
  notifyAccountReactivated,
  notifyOwnerFlagLifecycle,
} from "@/lib/userMessages";
import { REOPEN_FLAG_ACTIONS } from "@/components/admin/adminPageConstants";
import {
  isMessageDeleted,
  isMessageAddressed,
  getFlagHistory,
  getDeactivatedCaseHistory,
  getUserFlagCaseHistory,
} from "@/components/admin/adminPageHelpers";

export function useAdminPageActions(deps) {
  const {
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
  } = deps;

  const closeNoteDialog = () => setNoteDialog({ open: false, mode: null, context: {}, busy: false });

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
      adImpact: { loading: true },
    });

    (async () => {
      try {
        const [{ data: userAds, error: adsError }, { data: waitlistRows, error: waitError }] = await Promise.all([
          supabase
            .from("banner_ads")
            .select("id, status, zip_code, auto_renew, stripe_subscription_id")
            .eq("user_id", userId),
          supabase
            .from("ad_waitlist")
            .select("id, status, zip_code")
            .eq("user_id", userId)
            .in("status", QUEUE_STATUSES),
        ]);
        if (adsError) throw adsError;
        if (waitError) throw waitError;

        const list = userAds || [];
        const holding = list.filter((ad) => SLOT_HOLDING_STATUSES.includes(ad.status));
        const statusCounts = {};
        for (const ad of holding) {
          const key = ad.status || "unknown";
          statusCounts[key] = (statusCounts[key] || 0) + 1;
        }
        const zips = [...new Set(holding.map((ad) => ad.zip_code).filter(Boolean))];
        const withStripe = list.filter((ad) => Boolean(ad.stripe_subscription_id)).length;
        const autoRenewOn = list.filter((ad) => ad.auto_renew !== false).length;
        const waitlistCount = (waitlistRows || []).length;

        setDisableDialog((prev) => {
          if (!prev.open || prev.userId !== userId) return prev;
          return {
            ...prev,
            adImpact: {
              loading: false,
              error: null,
              totalAds: list.length,
              holdingCount: holding.length,
              statusCounts,
              zips,
              withStripe,
              autoRenewOn,
              waitlistCount,
            },
          };
        });
      } catch (err) {
        setDisableDialog((prev) => {
          if (!prev.open || prev.userId !== userId) return prev;
          return {
            ...prev,
            adImpact: {
              loading: false,
              error: err.message || "Could not load ads",
            },
          };
        });
      }
    })();
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
      setDisableDialog({ open: false, userId: null, userName: "", isSupporter: false, source: "users_list", adImpact: null });
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

  const ADMIN_ACTION_LABEL = {
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

  // Match card “white / closed” styling used in Flagged Content / Flagged Users
  const adminName = () => {
    const fromProfile = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
    return fromProfile || user?.full_name || user?.email || "Admin";
  };

  // Flagged Content cards use case history on the target item
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

  useEffect(() => {
    if (flags.length > 0) loadEventTitles();
  }, [flags]);

  useEffect(() => {
    loadDeletedItems();
  }, [events, flags]);

  return {
    loadAll, refreshReviewCounts, handleDeleteEvent, executeRemoveActivity, executeDeactivateComment,
    executeDeactivateAd, toggleMessageAddressed, softDeleteMessage, restoreMessage,
    handleReactivateItem, openFlagsForActivity, openUserInUsersList, toggleEventNotes,
    openDisableUserDialog, openReactivateUserDialog, handleDisableUser, handleApproveReactivation,
    handleDeclineReactivation, handleClearUserFlag, handleClearUserFlags, handleUserFlagReviewed,
    handleUserFlagMarkUnreviewed, handleDeactivatedOverride, handleDeactivatedManuallyDeactivate,
    handleDeactivatedReviewed, handleDeactivatedMarkUnreviewed, handleReactivateFromFlag,
    handleClearFlag, handleClearFlags, handleNoteDialogConfirm, closeNoteDialog,
  };
}
