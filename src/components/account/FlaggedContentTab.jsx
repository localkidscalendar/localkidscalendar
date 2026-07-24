import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { ShieldAlert } from "lucide-react";
import moment from "moment";

export default function FlaggedContentTab({ user }) {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("flag_reports")
        .select("*")
        .eq("reporter_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!error) setReports(data || []);
      setLoading(false);
    };
    load();
  }, [user?.id]);

  if (loading) return <LoadingState text="Loading your reports..." />;

  if (reports.length === 0) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="No Reports Yet"
        description="When you flag an activity or comment, it will show up here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Content you&apos;ve flagged for review.
      </p>
      <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
        {reports.map((r) => (
          <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted capitalize">{r.target_type}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-peach-50 text-peach-500 capitalize">{r.reason}</span>
              </div>
              <p className="text-sm font-medium">{r.target_contributor_name || "Reported Item"}</p>
              {r.details && <p className="text-sm text-muted-foreground mt-1">{r.details}</p>}
              <p className="text-xs text-muted-foreground mt-1">{moment(r.created_at).fromNow()}</p>
            </div>
            {r.target_type === "event" && (
              <Link to={`/event/${r.target_id}`} className="text-xs text-mint-600 hover:underline shrink-0">
                View Activity
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
