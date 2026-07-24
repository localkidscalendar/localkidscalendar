import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Check, X, Loader2, MessageSquare } from "lucide-react";
import moment from "moment";

/** Email send returns with the site email engine — approve/decline still updates the DB. */
async function sendPhotoDecisionEmail(event, decision, notes) {
  try {
    if (!event.created_by_id) return;
    const { data: contributor } = await supabase
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", event.created_by_id)
      .maybeSingle();
    if (!contributor?.email) return;
    // Placeholder until Resend (or similar) is wired — keep payload ready for the mailer.
    void decision;
    void notes;
    void contributor;
  } catch (err) {
    console.error("Failed to send activity photo decision email", err);
  }
}

function ActionCell({ item, processing, onApprove, onDecline }) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const busy = processing === item.id;

  const decline = () => onDecline(item, note.trim() || null);

  return (
    <div className="flex flex-col gap-1.5 items-end">
      <div className="flex gap-1">
        <Button size="sm" className="rounded-xl h-7 text-xs bg-mint-500 hover:bg-mint-600 text-white" disabled={busy} onClick={() => onApprove(item)}>
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" />Approve</>}
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs text-destructive border-destructive/20" disabled={busy} onClick={decline}>
          <X className="w-3 h-3 mr-1" />Decline
        </Button>
        <Button size="sm" variant="ghost" className={`rounded-xl h-7 w-7 p-0 ${showNote ? "text-purple-600" : "text-muted-foreground"}`} title="Add a note to the decline" onClick={() => setShowNote((v) => !v)}>
          <MessageSquare className="w-3.5 h-3.5" />
        </Button>
      </div>
      {showNote && (
        <Input
          autoFocus
          placeholder="Optional decline note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") decline(); }}
          className="rounded-lg h-7 text-xs w-52"
        />
      )}
    </div>
  );
}

export default function AdminActivityPhotoReviewPanel({ toast }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("image_moderation_status", "manual_review")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setRequests(data || []);
    } catch {
      setRequests([]);
    }
    setLoading(false);
  };

  const handleApprove = async (item) => {
    setProcessing(item.id);
    try {
      const { error } = await supabase.from("events").update({
        image_moderation_status: "approved",
        image_moderation_notes: "Manually approved by admin.",
        image_moderation_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", item.id);
      if (error) throw error;
      sendPhotoDecisionEmail(item, "approved", null);
      toast({ title: "Photo approved", description: `"${item.title}"'s photo is now live.` });
      setRequests((r) => r.filter((x) => x.id !== item.id));
    } catch {
      toast({ title: "Failed to approve", variant: "destructive" });
    }
    setProcessing(null);
  };

  const handleDecline = async (item, note) => {
    setProcessing(item.id);
    try {
      const notes = note || item.image_moderation_notes || "Declined by admin.";
      const { error } = await supabase.from("events").update({
        event_image: null,
        image_moderation_status: "manual_review_declined",
        image_moderation_notes: notes,
        image_moderation_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", item.id);
      if (error) throw error;
      sendPhotoDecisionEmail(item, "declined", notes);
      toast({ title: "Photo declined", description: `"${item.title}"'s photo has been declined.` });
      setRequests((r) => r.filter((x) => x.id !== item.id));
    } catch {
      toast({ title: "Failed to decline", variant: "destructive" });
    }
    setProcessing(null);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-border p-4 flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-mint-500" />
      </div>
    );
  }

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold text-sm text-purple-800">
          Activity Photo Manual Review Requests
          {requests.length > 0 && (
            <span className="ml-2 bg-purple-200 text-purple-800 text-xs font-bold px-2 py-0.5 rounded-full">{requests.length}</span>
          )}
        </h3>
        <Button variant="ghost" size="sm" className="rounded-xl h-7 text-xs" onClick={load}>Refresh</Button>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-purple-600 py-2">No manual review requests at this time.</p>
      ) : (
        <div className="bg-white rounded-xl border border-purple-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-purple-50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-purple-700">Activity</th>
                <th className="text-left px-4 py-2.5 font-medium text-purple-700">Requested</th>
                <th className="text-left px-4 py-2.5 font-medium text-purple-700">AI Decline Reason</th>
                <th className="text-left px-4 py-2.5 font-medium text-purple-700">Photo</th>
                <th className="text-right px-4 py-2.5 font-medium text-purple-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-50">
              {requests.map((item) => (
                <tr key={item.id} className="hover:bg-purple-50/50">
                  <td className="px-4 py-3 font-medium max-w-[160px] truncate">
                    <Link to={`/event/${item.id}`} className="text-mint-600 hover:underline">{item.title}</Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {moment(item.created_at).format("MMM D, YYYY")}
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    {item.image_moderation_notes ? (
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.image_moderation_notes}</p>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.event_image ? (
                      <a href={item.event_image} target="_blank" rel="noopener noreferrer" title="View photo" className="inline-block">
                        <div className="w-20 aspect-video rounded border border-purple-100 bg-purple-50/50 overflow-hidden flex items-center justify-center">
                          <img src={item.event_image} alt="" className="max-w-full max-h-full object-contain" />
                        </div>
                      </a>
                    ) : <span className="text-xs text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <ActionCell item={item} processing={processing} onApprove={handleApprove} onDecline={handleDecline} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
