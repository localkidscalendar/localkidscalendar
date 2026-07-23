import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X } from "lucide-react";

/** Admin queue for creatives that failed automated review and requested manual review. */
export default function ManualReviewPanel({ toast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ad_library")
        .select("*")
        .eq("moderation_status", "manual_review")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setItems(data || []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  };

  const decide = async (item, status, notes) => {
    setBusyId(item.id);
    const { error } = await supabase.from("ad_library").update({
      moderation_status: status,
      moderation_notes: notes,
      moderation_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", item.id);
    if (error) {
      toast?.({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast?.({ title: status === "approved" ? "Creative approved" : "Creative declined" });
      load();
    }
    setBusyId(null);
  };

  if (loading) {
    return <Loader2 className="w-5 h-5 animate-spin text-mint-500" />;
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No creatives awaiting manual review. Automated approvals do not appear here — only assets where the supporter requested a manual review after an automated decline.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        These creatives failed automated review and the supporter requested a human decision.
      </p>
      {items.map((item) => (
        <div key={item.id} className="flex gap-3 p-3 bg-white rounded-xl border border-border">
          <img src={item.image_url} alt={item.ad_name} className="w-20 h-14 rounded-lg object-cover border" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{item.ad_name}</p>
            <p className="text-xs text-muted-foreground truncate">{item.link_url}</p>
            {item.moderation_notes && (
              <p className="text-xs text-amber-700 mt-1">Auto-decline note: {item.moderation_notes}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Button
              size="sm"
              className="rounded-lg text-xs h-7 bg-mint-500 hover:bg-mint-600 text-white"
              disabled={busyId === item.id}
              onClick={() => decide(item, "approved", "Manually approved by admin.")}
            >
              {busyId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" /> Approve</>}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg text-xs h-7 text-destructive"
              disabled={busyId === item.id}
              onClick={() => {
                const notes = window.prompt("Decline reason (shown to supporter):") || "Declined after manual review.";
                decide(item, "manual_review_declined", notes);
              }}
            >
              <X className="w-3 h-3 mr-1" /> Decline
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
