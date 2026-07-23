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
import { CalendarDays, MapPin, Users, Clock, Globe, DollarSign, Share2, Heart, Flag, ArrowLeft, MessageSquare, Bookmark, CalendarPlus, AlertCircle, Send, Loader2, Star, X, Edit, Copy, ShieldCheck, CheckCircle2, Trash2, RotateCcw } from "lucide-react";
import moment from "moment";
import AuthPromptModal from "@/components/shared/AuthPromptModal";

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
  const [posterUser, setPosterUser] = useState(null);
  const [posterOrganizer, setPosterOrganizer] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [authPrompt, setAuthPrompt] = useState(null); // string message or null
  const [otherReasonText, setOtherReasonText] = useState("");
  const [selectedFlagReason, setSelectedFlagReason] = useState(null);
  const [flaggingCommentId, setFlaggingCommentId] = useState(null);

  useEffect(() => {
    loadEvent();
    loadComments();
    if (user) checkSaved();
  }, [id, user]);

  useEffect(() => {
    if (event?.created_by_id) {
      loadPosterUser(event.created_by_id);
      if (user) checkFavorite(event.created_by_id);
    }
  }, [event?.created_by_id, user]);

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
    if (!user) return setAuthPrompt("Sign in to favorite this poster and get notified about their activities.");
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

  const handleFlagEvent = async () => {
    if (!user) return setAuthPrompt("Sign in to report this event.");
    if (!selectedFlagReason) return;
    if (selectedFlagReason === "other" && !otherReasonText.trim()) {
      toast({ title: "Please provide a reason", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase.rpc("submit_flag", {
        p_target_type: "event",
        p_target_id: id,
        p_reason: selectedFlagReason,
        p_details: selectedFlagReason === "other" ? otherReasonText.trim() : null,
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
      toast({
        title: "Could not submit report",
        description: err.message,
        variant: "destructive",
      });
    }
    setFlagOpen(false);
    setSelectedFlagReason(null);
    setOtherReasonText("");
  };

  const handleFlagComment = async (commentId) => {
    if (!user) return setAuthPrompt("Sign in to report a comment.");
    if (!selectedFlagReason) return;
    if (selectedFlagReason === "other" && !otherReasonText.trim()) {
      toast({ title: "Please provide a reason", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase.rpc("submit_flag", {
        p_target_type: "comment",
        p_target_id: commentId,
        p_reason: selectedFlagReason,
        p_details: selectedFlagReason === "other" ? otherReasonText.trim() : null,
      });
      if (error) throw error;
      toast({
        title: data?.archived
          ? "Comment removed pending review"
          : "Report submitted. Thank you for helping keep our community safe.",
      });
      loadComments();
    } catch (err) {
      toast({
        title: "Could not submit report",
        description: err.message,
        variant: "destructive",
      });
    }
    setFlaggingCommentId(null);
    setSelectedFlagReason(null);
    setOtherReasonText("");
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
      {/* Back to activities */}
      <Button variant="ghost" className="mb-4 rounded-xl text-sm" asChild>
        <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Activities</Link>
      </Button>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {/* Image */}
        {event.event_image && event.posted_by_role === "organizer" && (!event.image_moderation_status || event.image_moderation_status === "approved") && (
          <div className="h-48 sm:h-64 overflow-hidden">
            <img src={event.event_image} alt={event.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {(Array.isArray(event.category) ? event.category : event.category ? [event.category] : []).map((c) => <CategoryBadge key={c} category={c} />)}
                {event.registration_full && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-peach-50 text-peach-500">
                    <AlertCircle className="w-3 h-3" /> Registration Full
                  </span>
                )}
                {event.posted_by_role === "organizer" && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-mint-50 text-mint-500">Official</span>
                )}
              </div>
              <h1 className="font-heading font-bold text-2xl sm:text-3xl">{event.title}</h1>
            </div>

            {/* Sticky actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={addToCalendar}>
                <CalendarPlus className="w-4 h-4" /> Add to Calendar
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
                onClick={() => user ? setFlagOpen(!flagOpen) : setAuthPrompt("Sign in to report this activity if it's inaccurate, inappropriate, or spam.")}
                title={user ? "Report this activity if it's inaccurate, inappropriate, or spam." : "Report this activity if it's inaccurate, inappropriate, or spam. Requires a registered, signed-in account."}
              >
                <Flag className="w-4 h-4" />
              </Button>
              )}
            </div>
          </div>

          {/* Flag dropdown */}
          {flagOpen && !isOwner && (
            <div className="bg-peach-50 rounded-xl p-4 mb-4 animate-settle">
              <p className="text-sm font-medium mb-2">Why are you flagging this event?</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {["inaccurate", "inappropriate", "spam", "other"].map((r) => (
                  <Button 
                    key={r} 
                    variant={selectedFlagReason === r ? "default" : "outline"} 
                    size="sm" 
                    className="rounded-xl text-xs capitalize" 
                    onClick={() => setSelectedFlagReason(r)}
                  >
                    {r}
                  </Button>
                ))}
              </div>
              {selectedFlagReason === "other" && (
                <div className="mb-3">
                  <textarea 
                    placeholder="Please describe the issue..." 
                    value={otherReasonText} 
                    onChange={(e) => setOtherReasonText(e.target.value)}
                    className="w-full rounded-lg border border-peach-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-peach-500"
                    rows={2}
                  />
                </div>
              )}
              {selectedFlagReason && (
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="rounded-xl text-xs"
                    onClick={() => handleFlagEvent(selectedFlagReason)}
                    disabled={selectedFlagReason === "other" && !otherReasonText.trim()}
                  >
                    Submit Report
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="rounded-xl text-xs"
                    onClick={() => { setSelectedFlagReason(null); setOtherReasonText(""); }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

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
          <div className="bg-mint-50/50 rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">This activity was posted by:</p>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {event.posted_by_role === "organizer" ? (
                  <>
                    {(posterOrganizer?.org_logo || event.org_logo) ? (
                      <img src={posterOrganizer?.org_logo || event.org_logo} alt={posterOrganizer?.org_name || event.org_name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-mint-200 flex items-center justify-center font-bold text-mint-600">
                        {(posterOrganizer?.org_name || event.org_name || "O")[0]}
                      </div>
                    )}
                    <div>
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
                    <div>
                      <p className="font-medium text-sm">{event.poster_display_name || "Community Member"} <span className="text-xs text-muted-foreground">(Community Member)</span></p>
                      <p className="text-xs text-muted-foreground">Posted {moment(event.created_date).format("MMMM D, YYYY")}</p>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={handleToggleFavorite}
                title={isFavorite ? "Remove from favorites" : "Favorite this poster"}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${isFavorite ? "bg-red-50 border-red-200 text-red-500 hover:bg-red-100" : "bg-white border-border text-muted-foreground hover:border-mint-300 hover:text-mint-500"}`}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
                {isFavorite ? "Favorited" : "Favorite"}
              </button>
            </div>
          </div>

          {/* Comments */}
          <div>
            <h3 className="font-heading font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-1">
              <MessageSquare className="w-4 h-4" /> Comments ({comments.length})
              <HelpTip text="Comments are visible to everyone. Sign in to post a comment. Flagged by 3 users = auto-removed." />
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
              {comments.map((c) => (
                <div key={c.id}>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{c.author_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{moment(c.created_date).fromNow()}</span>
                        {user?.id !== c.created_by_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-6 w-6 text-muted-foreground hover:text-destructive ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
                          onClick={() => user ? setFlaggingCommentId(c.id) : setAuthPrompt("Sign in to report this comment if it's inaccurate, inappropriate, or spam.")}
                          title={user ? "Report this comment if it's inaccurate, inappropriate, or spam." : "Report this comment if it's inaccurate, inappropriate, or spam. Requires a registered, signed-in account."}
                        >
                          <Flag className="w-3 h-3" />
                        </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm">{c.content}</p>
                  </div>
                  {flaggingCommentId === c.id && user?.id !== c.created_by_id && (
                    <div className="bg-peach-50 rounded-xl p-3 mt-2 animate-settle text-xs">
                      <p className="font-medium mb-2">Why are you flagging this comment?</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {["inaccurate", "inappropriate", "spam", "other"].map((r) => (
                          <Button 
                            key={r} 
                            variant={selectedFlagReason === r ? "default" : "outline"} 
                            size="sm" 
                            className="rounded-lg text-xs capitalize h-7" 
                            onClick={() => setSelectedFlagReason(r)}
                          >
                            {r}
                          </Button>
                        ))}
                      </div>
                      {selectedFlagReason === "other" && (
                        <div className="mb-2">
                          <textarea 
                            placeholder="Please describe the issue..." 
                            value={otherReasonText} 
                            onChange={(e) => setOtherReasonText(e.target.value)}
                            className="w-full rounded-lg border border-peach-200 p-2 text-xs focus:outline-none focus:ring-2 focus:ring-peach-500"
                            rows={2}
                          />
                        </div>
                      )}
                      {selectedFlagReason && (
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="rounded-lg text-xs h-7"
                            onClick={() => handleFlagComment(c.id)}
                            disabled={selectedFlagReason === "other" && !otherReasonText.trim()}
                          >
                            Submit
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="rounded-lg text-xs h-7"
                            onClick={() => { setFlaggingCommentId(null); setSelectedFlagReason(null); setOtherReasonText(""); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No comments yet. {!user && "Sign in to be the first to comment."}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <ShareModal open={shareOpen} onOpenChange={setShareOpen} url={window.location.href} title={event.title} />
      <AuthPromptModal open={!!authPrompt} onOpenChange={(o) => { if (!o) setAuthPrompt(null); }} message={authPrompt} />
    </div>
  );
}