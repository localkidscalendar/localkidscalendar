import React, { useState, useEffect } from "react";
import { useParams, useOutletContext, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import CategoryBadge from "@/components/shared/CategoryBadge";
import ContactProtected from "@/components/shared/ContactProtected";
import ShareModal from "@/components/shared/ShareModal";
import HelpTip from "@/components/shared/HelpTip";
import { CalendarDays, MapPin, Users, Globe, DollarSign, Share2, Heart, Flag, MessageSquare, Bookmark, CalendarPlus, AlertCircle, Send, Loader2, Edit, Copy, ShieldCheck, CheckCircle2, Trash2, RotateCcw } from "lucide-react";
import moment from "moment";
import AuthPromptModal from "@/components/shared/AuthPromptModal";
import HistoryBackLink from "@/components/shared/HistoryBackLink";
import FlagReportForm, { FlagWithdrawDialog } from "@/components/shared/FlagReportForm";
import UserFlagControl from "@/components/shared/UserFlagControl";
import { alreadyFlaggedMessage, userHasFlaggedTarget, withdrawFlag } from "@/lib/flagReports";

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [posterUser, setPosterUser] = useState(null);
  const [posterOrganizer, setPosterOrganizer] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [authPrompt, setAuthPrompt] = useState(null); // string message or null
  const [flaggingCommentId, setFlaggingCommentId] = useState(null);
  const [withdrawCommentId, setWithdrawCommentId] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [savingCommentId, setSavingCommentId] = useState(null);

  useEffect(() => {
    loadEvent();
    loadComments();
    if (user) checkSaved();
  }, [id, user]);

  useEffect(() => {
    if (event?.created_by_id) {
      loadPosterUser(event.created_by_id);
      if (user && event.posted_by_role === "organizer") checkFavorite(event.created_by_id);
      else setIsFavorite(false);
    }
  }, [event?.created_by_id, event?.posted_by_role, user]);

  const loadEvent = async () => {
    setLoading(true);
    try {
      const { data: e, error } = await supabase.from("events").select("*").eq("id", id).single();
      if (error) throw error;
      setEvent(e);
      await supabase
        .from("events")
        .update({ view_count: (e.view_count || 0) + 1 })
        .eq("id", id);
    } catch {
      navigate("/");
    }
    setLoading(false);
  };

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("event_id", id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setComments(data || []);
    } catch {
      setComments([]);
    }
  };

  const loadPosterUser = async (posterId) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", posterId)
        .maybeSingle();
      if (profile) setPosterUser(profile);

      const { data: orgs } = await supabase
        .from("organizers")
        .select("*")
        .eq("user_id", posterId)
        .limit(1);
      if (orgs?.[0]) setPosterOrganizer(orgs[0]);
    } catch {}
  };

  const checkFavorite = async (posterId) => {
    try {
      const { data, error } = await supabase
        .from("favorite_organizers")
        .select("id")
        .eq("user_id", user.id)
        .eq("poster_user_id", posterId)
        .maybeSingle();
      if (error) throw error;
      setIsFavorite(Boolean(data));
    } catch {
      setIsFavorite(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user) return setAuthPrompt("Sign in to favorite this organizer and get notified about their activities.");
    if (event?.posted_by_role !== "organizer") return;
    const posterId = event?.created_by_id;
    if (!posterId) return;
    try {
      if (isFavorite) {
        const { error } = await supabase
          .from("favorite_organizers")
          .delete()
          .eq("user_id", user.id)
          .eq("poster_user_id", posterId);
        if (error) throw error;
        setIsFavorite(false);
        toast({ title: "Removed from favorites" });
      } else {
        const { error } = await supabase.from("favorite_organizers").insert({
          user_id: user.id,
          organizer_id: posterOrganizer?.id || null,
          poster_user_id: posterId,
        });
        if (error) throw error;
        setIsFavorite(true);
        toast({ title: "Added to favorites!" });
      }
    } catch (err) {
      toast({ title: "Could not update favorite", description: err.message, variant: "destructive" });
    }
  };

  const checkSaved = async () => {
    try {
      const { data, error } = await supabase
        .from("saved_events")
        .select("id")
        .eq("event_id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      setSaved(Boolean(data));
    } catch {
      setSaved(false);
    }
  };

  const handleSave = async () => {
    if (!user) return setAuthPrompt("Sign in to save activities to your personal dashboard.");
    try {
      if (saved) {
        const { error } = await supabase
          .from("saved_events")
          .delete()
          .eq("event_id", id)
          .eq("user_id", user.id);
        if (error) throw error;
        setSaved(false);
        const nextCount = Math.max(0, (event.save_count || 0) - 1);
        await supabase.from("events").update({ save_count: nextCount }).eq("id", id);
        setEvent((prev) => ({ ...prev, save_count: nextCount }));
        toast({ title: "Removed from saved" });
      } else {
        const { error } = await supabase.from("saved_events").insert({
          event_id: id,
          user_id: user.id,
        });
        if (error) throw error;
        setSaved(true);
        const nextCount = (event.save_count || 0) + 1;
        await supabase.from("events").update({ save_count: nextCount }).eq("id", id);
        setEvent((prev) => ({ ...prev, save_count: nextCount }));
        toast({ title: "Event saved!" });
      }
    } catch (err) {
      toast({ title: "Could not update saved state", description: err.message, variant: "destructive" });
    }
  };

  const handleAddComment = async () => {
    if (!user) return setAuthPrompt("Sign in to post a comment.");
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const { error } = await supabase.from("comments").insert({
        event_id: id,
        content: newComment.trim(),
        author_name: user.full_name || "Community Member",
        created_by_id: user.id,
        status: "active",
      });
      if (error) throw error;
      setNewComment("");
      loadComments();
      toast({ title: "Comment posted!" });
    } catch (err) {
      toast({ title: "Could not post comment", description: err.message, variant: "destructive" });
    }
    setSubmittingComment(false);
  };

  const startEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.content || "");
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  const handleSaveComment = async (commentId) => {
    const text = editingCommentText.trim();
    if (!text) {
      toast({ title: "Comment can’t be empty", variant: "destructive" });
      return;
    }
    setSavingCommentId(commentId);
    try {
      const { error } = await supabase
        .from("comments")
        .update({ content: text, updated_at: new Date().toISOString() })
        .eq("id", commentId)
        .eq("created_by_id", user.id);
      if (error) throw error;
      toast({ title: "Comment updated" });
      cancelEditComment();
      loadComments();
    } catch (err) {
      toast({ title: "Could not update comment", description: err.message, variant: "destructive" });
    }
    setSavingCommentId(null);
  };

  const handleDeleteComment = async (comment) => {
    if (!window.confirm("Delete this comment? It will be removed from the activity.")) return;
    setSavingCommentId(comment.id);
    try {
      const { error } = await supabase
        .from("comments")
        .update({ status: "deleted", updated_at: new Date().toISOString() })
        .eq("id", comment.id)
        .eq("created_by_id", user.id);
      if (error) throw error;
      toast({ title: "Comment deleted" });
      if (editingCommentId === comment.id) cancelEditComment();
      loadComments();
    } catch (err) {
      toast({ title: "Could not delete comment", description: err.message, variant: "destructive" });
    }
    setSavingCommentId(null);
  };

  const handleFlagEvent = async ({ reason, details }) => {
    if (!user) return setAuthPrompt("Sign in to report this event.");
    try {
      const { data, error } = await supabase.rpc("submit_flag", {
        p_target_type: "event",
        p_target_id: id,
        p_reason: reason,
        p_details: details,
      });
      if (error) throw error;
      toast({
        title: data?.archived
          ? "Activity removed pending review"
          : "Report submitted. Thank you for helping keep our community safe.",
      });
      if (data?.archived) {
        navigate("/");
      } else {
        loadEvent();
      }
    } catch (err) {
      const already = /already flagged/i.test(err.message || "");
      toast({
        title: already ? alreadyFlaggedMessage("activity") : "Could not submit report",
        description: already ? undefined : err.message,
        variant: already ? "default" : "destructive",
      });
      throw err;
    }
  };

  const handleFlagComment = async (commentId, { reason, details }) => {
    if (!user) return setAuthPrompt("Sign in to report a comment.");
    try {
      const { data, error } = await supabase.rpc("submit_flag", {
        p_target_type: "comment",
        p_target_id: commentId,
        p_reason: reason,
        p_details: details,
      });
      if (error) throw error;
      toast({
        title: data?.archived
          ? "Comment removed pending review"
          : "Report submitted. Thank you for helping keep our community safe.",
      });
      loadComments();
    } catch (err) {
      const already = /already flagged/i.test(err.message || "");
      toast({
        title: already ? alreadyFlaggedMessage("comment") : "Could not submit report",
        description: already ? undefined : err.message,
        variant: already ? "default" : "destructive",
      });
      throw err;
    }
  };

  const handleWithdrawEventFlag = async () => {
    const { error } = await withdrawFlag("event", id);
    if (error) {
      toast({ title: "Could not remove flag", description: error.message, variant: "destructive" });
      throw error;
    }
    toast({ title: "Your flag was removed" });
    loadEvent();
  };

  const handleWithdrawCommentFlag = async () => {
    if (!withdrawCommentId) return;
    const { error } = await withdrawFlag("comment", withdrawCommentId);
    if (error) {
      toast({ title: "Could not remove flag", description: error.message, variant: "destructive" });
      throw error;
    }
    toast({ title: "Your flag was removed" });
    setWithdrawCommentId(null);
    loadComments();
  };

  const openActivityFlagForm = async () => {
    if (!user) {
      setAuthPrompt("Sign in to report this activity if it's inaccurate, inappropriate, or spam.");
      return;
    }
    try {
      if (await userHasFlaggedTarget("event", id, user.id)) {
        setWithdrawOpen(true);
        return;
      }
    } catch (err) {
      toast({ title: "Could not check flag status", description: err.message, variant: "destructive" });
      return;
    }
    setFlagOpen(true);
  };

  const openCommentFlagForm = async (commentId) => {
    if (!user) {
      setAuthPrompt("Sign in to report this comment if it's inaccurate, inappropriate, or spam.");
      return;
    }
    try {
      if (await userHasFlaggedTarget("comment", commentId, user.id)) {
        setWithdrawCommentId(commentId);
        return;
      }
    } catch (err) {
      toast({ title: "Could not check flag status", description: err.message, variant: "destructive" });
      return;
    }
    setFlaggingCommentId(commentId);
  };

  const handleMarkFull = async () => {
    try {
      const { error } = await supabase
        .from("events")
        .update({ registration_full: !event.registration_full })
        .eq("id", id);
      if (error) throw error;
      loadEvent();
      toast({ title: event.registration_full ? "Marked as open" : "Marked as full" });
    } catch (err) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  };

  const handleToggleActive = async () => {
    if (event.status === "active") {
      if (!window.confirm(`Deactivate "${event.title}"? This will remove it from the public site until you reactivate it. NOTE: If your activity is complete, we recommend keeping it active (rather than removing it) in case users are searching for it in the past.`)) return;
      try {
        const { error } = await supabase
          .from("events")
          .update({ status: "deleted", admin_notes: "" })
          .eq("id", id);
        if (error) throw error;
        toast({ title: "Activity deactivated" });
        loadEvent();
      } catch (err) {
        toast({ title: "Update failed", description: err.message, variant: "destructive" });
      }
    } else {
      if (!window.confirm(`Reactivate "${event.title}"? This will make it visible on the public site again.`)) return;
      try {
        const { error } = await supabase.from("events").update({ status: "active" }).eq("id", id);
        if (error) throw error;
        toast({ title: "Activity reactivated" });
        loadEvent();
      } catch (err) {
        toast({ title: "Update failed", description: err.message, variant: "destructive" });
      }
    }
  };

  const addToCalendar = () => {
    if (!event) return;
    const start = moment(event.start_date).format("YYYYMMDDTHHmmss");
    const end = event.end_date ? moment(event.end_date).format("YYYYMMDDTHHmmss") : moment(event.start_date).add(1, "hour").format("YYYYMMDDTHHmmss");
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start}/${end}&details=${encodeURIComponent(event.description || "")}&location=${encodeURIComponent(event.address || event.city || "")}`;
    window.open(url, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-mint-500" />
      </div>
    );
  }

  if (!event) return null;

  const isOwner = user && event.created_by_id === user.id;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Back — only when visitor came from another in-app page */}
      <HistoryBackLink variant="button" />

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {/* Image */}
        {event.event_image && event.posted_by_role === "organizer" && (!event.image_moderation_status || event.image_moderation_status === "approved") && (
          <div className="aspect-video bg-muted/30 overflow-hidden flex items-center justify-center">
            <img src={event.event_image} alt={event.title} className="w-full h-full object-contain" />
          </div>
        )}

        <div className="p-6">
          {/* Header: actions above categories on mobile (right-aligned); side-by-side on desktop */}
          <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-wrap items-center justify-end gap-2 order-1 sm:order-2 shrink-0">
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl"
                onClick={addToCalendar}
                title="Add to Calendar"
              >
                <CalendarPlus className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="rounded-xl" onClick={handleSave}>
                <Bookmark className={`w-4 h-4 ${saved ? "fill-mint-500 text-mint-500" : ""}`} />
              </Button>
              <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setShareOpen(true)}>
                <Share2 className="w-4 h-4" />
              </Button>
              {!isOwner && (
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-xl text-muted-foreground hover:text-destructive ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={openActivityFlagForm}
                title={user ? "Report this activity if it's inaccurate, inappropriate, or spam." : "Report this activity if it's inaccurate, inappropriate, or spam. Requires a registered, signed-in account."}
              >
                <Flag className="w-4 h-4" />
              </Button>
              )}
            </div>

            <div className="min-w-0 flex-1 order-2 sm:order-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {(Array.isArray(event.category) ? event.category : event.category ? [event.category] : []).map((c) => (
                  <CategoryBadge key={c} category={c} />
                ))}
                {event.registration_full && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-peach-50 text-peach-500 whitespace-nowrap shrink-0">
                    <AlertCircle className="w-3 h-3" /> Registration Full
                  </span>
                )}
                {event.posted_by_role === "organizer" && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-mint-50 text-mint-500 whitespace-nowrap shrink-0">
                    Official
                  </span>
                )}
              </div>
              <h1 className="font-heading font-bold text-2xl sm:text-3xl">{event.title}</h1>
            </div>
          </div>

          {/* Owner management panel */}
          {isOwner && (
            <div className="flex flex-wrap items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4">
              <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="text-xs font-medium text-blue-700 mr-1">This is your activity:</span>
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5 bg-white" onClick={() => navigate(`/post-event?edit=${id}`)}>
                <Edit className="w-3.5 h-3.5" /> Edit
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5 bg-white" onClick={() => navigate(`/post-event?duplicate=${id}`)}>
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </Button>
              {event.status === "active" && (
                <>
                  <Button variant="outline" size="sm" className="rounded-xl gap-1.5 bg-white" onClick={handleMarkFull}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> {event.registration_full ? "Mark Open" : "Mark Full"}
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-xl gap-1.5 bg-white" onClick={handleToggleActive}>
                    <Trash2 className="w-3.5 h-3.5" /> Deactivate
                  </Button>
                </>
              )}
              {event.status === "deleted" && !event.admin_notes && (
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5 bg-white text-mint-500 border-mint-200" onClick={handleToggleActive}>
                  <RotateCcw className="w-3.5 h-3.5" /> Reactivate
                </Button>
              )}
              {event.status === "deleted" && event.admin_notes && (
                <span className="text-xs text-red-600">Removed by an Admin — see the reason on your Account page.</span>
              )}
            </div>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CalendarDays className="w-5 h-5 text-mint-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{moment(event.start_date).format("MMMM D, YYYY")}{event.end_date && event.end_date !== event.start_date ? ` — ${moment(event.end_date).format("MMMM D, YYYY")}` : ""}</p>
                  {event.time_start && <p className="text-xs text-muted-foreground">{event.time_start}{event.time_end ? ` – ${event.time_end}` : ""}</p>}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-mint-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{event.location_name || "Location"}</p>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent([event.address, event.city, event.state, event.zip_code].filter(Boolean).join(", "))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-mint-500 hover:underline"
                  >
                    {event.address}{event.city ? `, ${event.city}` : ""}{event.state ? `, ${event.state}` : ""} {event.zip_code}
                  </a>
                </div>
              </div>
              {(event.age_min != null || event.age_max != null) && (
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-mint-500 shrink-0" />
                  <p className="text-sm">Ages {event.age_min || 0}–{event.age_max || "18+"}</p>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {event.cost && (
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-mint-500 shrink-0" />
                  <p className="text-sm">{event.cost}</p>
                </div>
              )}
              {event.website && (
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-mint-500 shrink-0" />
                  <a href={event.website.startsWith("http") ? event.website : `https://${event.website}`} target="_blank" rel="noopener" className="text-sm text-mint-500 hover:underline truncate">{event.website}</a>
                </div>
              )}
              {event.contact_email && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Email:</span>
                  <ContactProtected value={event.contact_email} type="email" />
                </div>
              )}
              {event.contact_phone && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Phone:</span>
                  <ContactProtected value={event.contact_phone} type="phone" />
                </div>
              )}
              {event.registration_start && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Registration:</span>
                  <span>{moment(event.registration_start).format("MMM D")}{event.registration_end ? ` – ${moment(event.registration_end).format("MMM D, YYYY")}` : ""}</span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="font-heading font-semibold text-sm text-muted-foreground mb-2">About This Event</h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{event.description}</p>
          </div>

          {/* Posted by info */}
          <div className="relative bg-mint-50/50 rounded-xl p-4 mb-6 pr-14">
            <div className="absolute top-3 right-3 flex items-center gap-0.5">
              {event.posted_by_role === "organizer" ? (
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  title={isFavorite ? "Remove from favorites" : "Favorite this organizer"}
                  className="p-1.5 rounded-md text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                >
                  <Heart className={`w-4 h-4 ${isFavorite ? "fill-muted-foreground/40 text-muted-foreground" : ""}`} />
                </button>
              ) : null}
              {user && event.created_by_id ? (
                <UserFlagControl
                  targetUserId={event.created_by_id}
                  currentUserId={user.id}
                  label={event.posted_by_role === "organizer" ? "organizer" : "community member"}
                  variant="icon"
                  className="p-1.5 rounded-md text-muted-foreground/70 hover:text-muted-foreground hover:bg-transparent"
                />
              ) : null}
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">This activity was posted by:</p>
            <div className="flex items-center gap-3 min-w-0">
              {event.posted_by_role === "organizer" ? (
                <>
                  {(posterOrganizer?.org_logo || event.org_logo) ? (
                    <img src={posterOrganizer?.org_logo || event.org_logo} alt={posterOrganizer?.org_name || event.org_name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-mint-200 flex items-center justify-center font-bold text-mint-600">
                      {(posterOrganizer?.org_name || event.org_name || "O")[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{posterOrganizer?.org_name || event.org_name} <span className="text-xs text-mint-500 font-medium">(Organizer)</span></p>
                    {(posterOrganizer?.org_description || event.org_description) && <p className="text-xs text-muted-foreground">{posterOrganizer?.org_description || event.org_description}</p>}
                    <p className="text-xs text-muted-foreground">Posted {moment(event.created_date).format("MMMM D, YYYY")}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-mint-200 flex items-center justify-center font-bold text-mint-600">
                    {event.poster_display_name?.[0] || "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{event.poster_display_name || "Community Member"} <span className="text-xs text-muted-foreground">(Community Member)</span></p>
                    <p className="text-xs text-muted-foreground">Posted {moment(event.created_date).format("MMMM D, YYYY")}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Comments */}
          <div>
            <h3 className="font-heading font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-1">
              <MessageSquare className="w-4 h-4" /> Comments ({comments.length})
              <HelpTip text="Comments are visible to everyone. Sign in to post. You can edit or delete your own comments. Flagged by 3 users = auto-removed." />
            </h3>

            {user ? (
              <div className="flex gap-2 mb-4">
                <Textarea placeholder="Share constructive insights that are helpful to others considering this activity (sorry, this is not a platform to vent frustrations and negativity) ..." value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  className="rounded-xl text-sm min-h-[60px]" rows={2} />
                <Button size="icon" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white shrink-0 self-end" onClick={handleAddComment} disabled={submittingComment}>
                  {submittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-muted/50 rounded-xl text-sm text-center text-muted-foreground">
                <Link to="/login" className="text-mint-500 font-medium hover:underline">Sign in</Link> to leave a comment.
              </div>
            )}

            <div className="space-y-3">
              {comments.map((c) => {
                const isAuthor = Boolean(user?.id && c.created_by_id === user.id);
                const isEditing = editingCommentId === c.id;
                const busy = savingCommentId === c.id;
                return (
                <div key={c.id}>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-xs font-medium">{c.author_name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground">{moment(c.created_date || c.created_at).fromNow()}</span>
                        {isAuthor ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-mint-600"
                              onClick={() => (isEditing ? cancelEditComment() : startEditComment(c))}
                              title={isEditing ? "Cancel edit" : "Edit comment"}
                              disabled={busy}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteComment(c)}
                              title="Delete comment"
                              disabled={busy}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-6 w-6 text-muted-foreground hover:text-destructive ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
                            onClick={() => openCommentFlagForm(c.id)}
                            title={user ? "Report this comment if it's inaccurate, inappropriate, or spam." : "Report this comment if it's inaccurate, inappropriate, or spam. Requires a registered, signed-in account."}
                          >
                            <Flag className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingCommentText}
                          onChange={(e) => setEditingCommentText(e.target.value)}
                          className="rounded-xl text-sm min-h-[60px]"
                          rows={2}
                          disabled={busy}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="rounded-xl h-7 text-xs bg-mint-500 hover:bg-mint-600 text-white"
                            onClick={() => handleSaveComment(c.id)}
                            disabled={busy}
                          >
                            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl h-7 text-xs"
                            onClick={cancelEditComment}
                            disabled={busy}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm">{c.content}</p>
                    )}
                  </div>
                </div>
              );
              })}
              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No comments yet. {!user && "Sign in to be the first to comment."}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <FlagReportForm
        open={flagOpen && !isOwner}
        onOpenChange={setFlagOpen}
        targetLabel="activity"
        onSubmit={handleFlagEvent}
      />
      <FlagWithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        targetLabel="activity"
        onConfirm={handleWithdrawEventFlag}
      />
      <FlagReportForm
        open={Boolean(flaggingCommentId)}
        onOpenChange={(open) => { if (!open) setFlaggingCommentId(null); }}
        targetLabel="comment"
        onSubmit={(payload) => handleFlagComment(flaggingCommentId, payload)}
      />
      <FlagWithdrawDialog
        open={Boolean(withdrawCommentId)}
        onOpenChange={(open) => { if (!open) setWithdrawCommentId(null); }}
        targetLabel="comment"
        onConfirm={handleWithdrawCommentFlag}
      />
      <ShareModal open={shareOpen} onOpenChange={setShareOpen} url={window.location.href} title={event.title} />
      <AuthPromptModal open={!!authPrompt} onOpenChange={(o) => { if (!o) setAuthPrompt(null); }} message={authPrompt} />
    </div>
  );
}