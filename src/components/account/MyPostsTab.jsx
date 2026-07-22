import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { CalendarDays, Edit, Copy, Eye, Bookmark, MessageSquare, TrendingUp, Trash2, RotateCcw } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import moment from "moment";

export default function MyPostsTab({ user }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [myEvents, setMyEvents] = useState([]);
  const [commentCounts, setCommentCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const allMyEvents = await base44.entities.Event.filter({ created_by_id: user.id }, "-created_date", 100);
      const activeAndDeleted = allMyEvents.filter((e) => e.status === "active" || e.status === "deleted");
      setMyEvents(activeAndDeleted);
      const counts = await Promise.all(
        activeAndDeleted.map((e) => base44.entities.Comment.filter({ event_id: e.id, status: "active" }))
      );
      const countsMap = {};
      activeAndDeleted.forEach((e, i) => { countsMap[e.id] = counts[i].length; });
      setCommentCounts(countsMap);
    } catch {}
    setLoading(false);
  };

  const handleMarkFull = async (eventId) => {
    await base44.entities.Event.update(eventId, { registration_full: true });
    loadData();
  };

  const handleDeactivate = async (event) => {
    if (!window.confirm(`Deactivate "${event.title}"? This will remove it from the public site until you reactivate it. NOTE: If your activity is complete, we recommend keeping it active (rather than removing it) in case users are searching for it in the past.`)) return;
    await base44.entities.Event.update(event.id, { status: "deleted", admin_notes: "" });
    toast({ title: "Activity deactivated" });
    loadData();
  };

  const handleReactivate = async (event) => {
    if (!window.confirm(`Reactivate "${event.title}"? This will make it visible on the public site again.`)) return;
    await base44.entities.Event.update(event.id, { status: "active" });
    toast({ title: "Activity reactivated" });
    loadData();
  };

  if (loading) {
    return <LoadingState text="Loading your posts..." />;
  }

  if (myEvents.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No Activities Posted"
        description="Share your first activity with the community."
        actionLabel="Post Your First Activity"
        onAction={() => navigate("/post-event")}
      />
    );
  }

  return (
    <div className="space-y-3">
      {myEvents.map((e) => (
        <div key={e.id} className="bg-white rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between gap-4">
            {e.status === "active" ? (
              <Link to={`/event/${e.id}`} className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate hover:text-mint-500 transition-colors">{e.title}</p>
                <p className="text-xs text-muted-foreground">{moment(e.start_date).format("MMM D, YYYY")} · {e.city}, {e.state}</p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <TrendingUp className="w-3.5 h-3.5" /> {e.impression_count || 0} impressions
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="w-3.5 h-3.5" /> {e.view_count || 0} views
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Bookmark className="w-3.5 h-3.5" /> {e.save_count || 0} saves
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="w-3.5 h-3.5" /> {commentCounts[e.id] || 0} comments
                  </span>
                </div>
              </Link>
            ) : (
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm truncate">{e.title}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${e.admin_notes ? "bg-red-100 text-red-600" : "bg-muted text-muted-foreground"}`}>
                    {e.admin_notes ? "Removed by Admin" : "Deactivated"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{moment(e.start_date).format("MMM D, YYYY")} · {e.city}, {e.state}</p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <TrendingUp className="w-3.5 h-3.5" /> {e.impression_count || 0} impressions
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="w-3.5 h-3.5" /> {e.view_count || 0} views
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Bookmark className="w-3.5 h-3.5" /> {e.save_count || 0} saves
                  </span>
                </div>
              </div>
            )}
            {e.status === "active" && (
              <div className="flex items-center gap-1.5 shrink-0">
                {!e.registration_full && (
                  <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={() => handleMarkFull(e.id)}>
                    Mark Full
                  </Button>
                )}
                {e.registration_full && (
                  <span className="text-xs text-peach-500 font-medium px-2">Full</span>
                )}
                <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => navigate(`/post-event?edit=${e.id}`)}>
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => navigate(`/post-event?duplicate=${e.id}`)}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => handleDeactivate(e)} title="Deactivate">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            {e.status === "deleted" && !e.admin_notes && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Button variant="outline" size="sm" className="rounded-lg text-xs text-mint-600 border-mint-200" onClick={() => handleReactivate(e)}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reactivate
                </Button>
              </div>
            )}
          </div>
          {e.status === "deleted" && e.admin_notes && (
            <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700">
              <p className="font-semibold mb-1">Reason for removal:</p>
              <p>{e.admin_notes}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}