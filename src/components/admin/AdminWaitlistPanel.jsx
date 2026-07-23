import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, MapPin } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

export default function AdminWaitlistPanel() {
  const { toast } = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ad_waitlist")
        .select("*")
        .in("status", ["waiting", "offered"])
        .order("zip_code", { ascending: true })
        .order("position", { ascending: true })
        .limit(100);
      if (error) throw error;
      setEntries(data || []);
    } catch {
      setEntries([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const offerSpot = async (entry) => {
    setBusyId(entry.id);
    try {
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      const { error } = await supabase
        .from("ad_waitlist")
        .update({
          status: "offered",
          offer_sent_date: new Date().toISOString(),
          offer_expires_date: expires.toISOString(),
          offer_count: Number(entry.offer_count || 0) + 1,
        })
        .eq("id", entry.id);
      if (error) throw error;
      toast({ title: "Offer sent", description: `Zip ${entry.zip_code} offered to ${entry.email}.` });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setBusyId(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-mint-500" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Active waitlist entries. During beta, use <strong>Offer spot</strong> to let a Supporter claim via Ad Manager.
        Automated email offers return with billing.
      </p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No active waitlist entries.</p>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-white">
            <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {entry.zip_code} · #{entry.position} · {entry.status}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {entry.business_name} · {entry.email} · {entry.plan_type} · {moment(entry.created_at).format("MMM D")}
              </p>
            </div>
            {entry.status === "waiting" && (
              <Button
                size="sm"
                className="rounded-xl h-7 text-xs bg-mint-500 hover:bg-mint-600 text-white shrink-0"
                disabled={busyId === entry.id}
                onClick={() => offerSpot(entry)}
              >
                {busyId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3 mr-1" />}
                Offer spot
              </Button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
