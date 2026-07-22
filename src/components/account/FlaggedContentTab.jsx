import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ShieldAlert, Flag, CalendarDays, MessageSquare } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";

export default function FlaggedContentTab({ user }) {
  const [flaggedItems, setFlaggedItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const allMyEvents = await base44.entities.Event.filter({ created_by_id: user.id }, "-created_date", 100);
      const flaggedEvents = allMyEvents
        .filter((e) => (e.flag_count || 0) > 0 && e.created_by_id === user.id)
        .map((e) => ({
          type: "activity",
          id: e.id,
          title: e.title,
          flag_count: e.flag_count || 0,
          removed: e.status === "deleted" || e.status === "archived",
          link: `/event/${e.id}`,
        }));

      const allComments = await base44.entities.Comment.filter({ created_by_id: user.id }, "-created_date", 200);
      const myComments = allComments.filter((c) => c.created_by_id === user.id);
      const flaggedComments = myComments.filter((c) => (c.flag_count || 0) > 0);

      const commentItems = await Promise.all(
        flaggedComments.map(async (c) => {
          let eventTitle = "an activity";
          try {
            const ev = await base44.entities.Event.get(c.event_id);
            if (ev) eventTitle = ev.title;
          } catch {}
          return {
            type: "comment",
            id: c.id,
            title: `Comment on "${eventTitle}"`,
            excerpt: c.content?.substring(0, 80) + (c.content?.length > 80 ? "…" : ""),
            flag_count: c.flag_count || 0,
            removed: c.status === "deleted" || c.status === "archived",
            link: `/event/${c.event_id}`,
          };
        })
      );

      setFlaggedItems([...flaggedEvents, ...commentItems]);
    } catch {}
    setLoading(false);
  };

  if (loading) {
    return <LoadingState text="Loading your flagged content..." />;
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">
        When community members flag your posted activities or comments, they appear here. Content flagged 3 or more times is automatically removed from the site and reviewed by our team.
      </p>
      {flaggedItems.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No Flagged Content"
          description="You're all good — none of your posts or comments have been flagged."
        />
      ) : (
        <div className="space-y-3">
          {flaggedItems.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className={`flex items-start gap-3 rounded-xl border p-3 ${item.removed ? "bg-red-50/40 border-red-100" : "bg-peach-50/40 border-peach-100"}`}
            >
              <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${item.removed ? "bg-red-100" : "bg-peach-100"}`}>
                {item.type === "comment"
                  ? <MessageSquare className={`w-3.5 h-3.5 ${item.removed ? "text-red-500" : "text-peach-500"}`} />
                  : <CalendarDays className={`w-3.5 h-3.5 ${item.removed ? "text-red-500" : "text-peach-500"}`} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <Link to={item.link} className="text-sm font-medium hover:text-mint-500 transition-colors truncate">
                    {item.title}
                  </Link>
                  {item.removed && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600 shrink-0">Removed</span>
                  )}
                </div>
                {item.excerpt && <p className="text-xs text-muted-foreground truncate">{item.excerpt}</p>}
                <div className="flex items-center gap-1 mt-1">
                  <Flag className="w-3 h-3 text-peach-400" />
                  <span className="text-xs text-peach-600 font-medium">{item.flag_count} flag{item.flag_count !== 1 ? "s" : ""}</span>
                  {item.removed && (
                    <span className="text-xs text-muted-foreground ml-1">— removed from public view</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}