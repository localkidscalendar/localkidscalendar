import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, ExternalLink, ImageIcon, Loader2, ChevronUp, ChevronDown, MessageSquare } from "lucide-react";
import moment from "moment";

function ActionCell({ item, processing, onApprove, onDecline }) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const busy = processing === item.id;

  const decline = () => onDecline(item, note.trim() || null);

  return (
    <div className="flex flex-col gap-1.5 items-end">
      <div className="flex gap-1">
        <Button
          size="sm"
          className="rounded-xl h-7 text-xs bg-mint-500 hover:bg-mint-600 text-white"
          disabled={busy}
          onClick={() => onApprove(item)}
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" />Approve</>}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-7 text-xs text-destructive border-destructive/20"
          disabled={busy}
          onClick={decline}
        >
          <X className="w-3 h-3 mr-1" />Decline
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={`rounded-xl h-7 w-7 p-0 ${showNote ? "text-purple-600" : "text-muted-foreground"}`}
          title="Add a note to the decline"
          onClick={() => setShowNote((v) => !v)}
        >
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

export default function ManualReviewPanel({ toast }) {
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: fetched, error } = await supabase
        .from("ad_library")
        .select("*")
        .eq("moderation_status", "manual_review")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setRequests(fetched || []);

      const userIds = [...new Set((fetched || []).map((r) => r.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        const map = {};
        (profiles || []).forEach((u) => { map[u.id] = u.full_name || u.email || u.id; });
        setUsers(map);
      } else {
        setUsers({});
      }
    } catch {
      setRequests([]);
      setUsers({});
    }
    setLoading(false);
  };

  const handleApprove = async (item) => {
    setProcessing(item.id);
    try {
      const { error } = await supabase.from("ad_library").update({
        moderation_status: "approved",
        moderation_notes: "Manually approved by admin.",
        moderation_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", item.id);
      if (error) throw error;
      toast?.({ title: "Asset approved", description: `"${item.ad_name}" is now available for use.` });
      setRequests((r) => r.filter((x) => x.id !== item.id));
    } catch {
      toast?.({ title: "Failed to approve", variant: "destructive" });
    }
    setProcessing(null);
  };

  const handleDecline = async (item, note) => {
    setProcessing(item.id);
    try {
      const { error } = await supabase.from("ad_library").update({
        moderation_status: "manual_review_declined",
        moderation_notes: note || item.moderation_notes || "Declined by admin.",
        moderation_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", item.id);
      if (error) throw error;
      toast?.({ title: "Asset declined", description: `"${item.ad_name}" has been declined.` });
      setRequests((r) => r.filter((x) => x.id !== item.id));
    } catch {
      toast?.({ title: "Failed to decline", variant: "destructive" });
    }
    setProcessing(null);
  };

  const toggleSort = (col) => {
    if (sortBy === col) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortOrder("asc"); }
  };

  const arrow = (col) => (sortBy === col ? (sortOrder === "asc" ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />) : null);

  const sorted = [...requests].sort((a, b) => {
    const aVal = sortBy === "user_name" ? (users[a.user_id] || "").toLowerCase() : (a.created_at || "");
    const bVal = sortBy === "user_name" ? (users[b.user_id] || "").toLowerCase() : (b.created_at || "");
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortOrder === "asc" ? cmp : -cmp;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-mint-500" />
      </div>
    );
  }

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold text-sm text-purple-800">
          Manual Ad Asset Approval Requests
          {requests.length > 0 && (
            <span className="ml-2 bg-purple-200 text-purple-800 text-xs font-bold px-2 py-0.5 rounded-full">{requests.length}</span>
          )}
        </h3>
        <Button variant="ghost" size="sm" className="rounded-xl h-7 text-xs" onClick={load}>Refresh</Button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-purple-600 py-2">No manual review requests at this time.</p>
      ) : (
        <div className="bg-white rounded-xl border border-purple-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-purple-50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-purple-700 cursor-pointer hover:bg-purple-100 select-none" onClick={() => toggleSort("user_name")}>
                  <span className="flex items-center gap-1">User {arrow("user_name")}</span>
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-purple-700">Ad Asset</th>
                <th className="text-left px-4 py-2.5 font-medium text-purple-700 cursor-pointer hover:bg-purple-100 select-none" onClick={() => toggleSort("created_at")}>
                  <span className="flex items-center gap-1">Requested {arrow("created_at")}</span>
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-purple-700">AI Decline Reason</th>
                <th className="text-left px-4 py-2.5 font-medium text-purple-700">Links</th>
                <th className="text-right px-4 py-2.5 font-medium text-purple-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-50">
              {sorted.map((item) => (
                <tr key={item.id} className="hover:bg-purple-50/50">
                  <td className="px-4 py-3 font-medium max-w-[140px] truncate">
                    {users[item.user_id] || `${item.user_id?.slice(0, 8)}…`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.image_url && (
                        <img src={item.image_url} alt={item.ad_name} className="w-12 h-8 object-cover rounded border border-border shrink-0" />
                      )}
                      <span className="font-medium text-sm truncate max-w-[140px]">{item.ad_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {moment(item.created_at).format("MMM D, YYYY")}
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    {item.moderation_notes ? (
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.moderation_notes}</p>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {item.image_url && (
                        <a href={item.image_url} target="_blank" rel="noopener noreferrer" title="View image">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-purple-600">
                            <ImageIcon className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                      {item.link_url && (
                        <a href={item.link_url.startsWith("http") ? item.link_url : `https://${item.link_url}`} target="_blank" rel="noopener noreferrer" title="Visit URL">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-purple-600">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                    </div>
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
