import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { notifyAdCreativeApprovedAdmin, notifyAdCreativeDeclinedAdmin } from "@/lib/userMessages";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, X, Loader2 } from "lucide-react";
import moment from "moment";

function formatSubmittedAt(createdAt) {
  const local = moment.utc(createdAt).local();
  return `${local.format("MMM D, YYYY h:mm A")} · ${local.fromNow()}`;
}

function profileDisplayName(profile, orgName) {
  if (orgName) return orgName;
  if (!profile) return "";
  const fromParts = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  if (fromParts) return fromParts;
  return profile.email || "";
}

function ensureHttpUrl(url) {
  if (!url) return "";
  return url.startsWith("http") ? url : `https://${url}`;
}

export default function ManualReviewPanel({ toast, onQueueChange }) {
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [declineItem, setDeclineItem] = useState(null);

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
        const [{ data: profiles }, { data: orgs }] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, first_name, last_name, email")
            .in("id", userIds),
          supabase
            .from("organizers")
            .select("user_id, org_name")
            .in("user_id", userIds),
        ]);
        const orgByUser = {};
        (orgs || []).forEach((o) => {
          if (o.user_id && o.org_name) orgByUser[o.user_id] = o.org_name;
        });
        const map = {};
        (profiles || []).forEach((u) => {
          map[u.id] = {
            name: profileDisplayName(u, orgByUser[u.id]) || "Supporter",
            email: u.email || "",
          };
        });
        // Cover any user_id with an org but missing profile row
        userIds.forEach((id) => {
          if (!map[id] && orgByUser[id]) {
            map[id] = { name: orgByUser[id], email: "" };
          }
        });
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
      void notifyAdCreativeApprovedAdmin(item);
      toast?.({ title: "Asset approved", description: `"${item.ad_name}" is now available for use.` });
      setRequests((r) => r.filter((x) => x.id !== item.id));
      onQueueChange?.();
    } catch {
      toast?.({ title: "Failed to approve", variant: "destructive" });
    }
    setProcessing(null);
  };

  const confirmDecline = async () => {
    if (!declineItem) return;
    const item = declineItem;
    setProcessing(item.id);
    setDeclineItem(null);
    try {
      // Manual-review decline: hard-delete — asset never went live; no need to keep disabled.
      const { error } = await supabase.from("ad_library").delete().eq("id", item.id);
      if (error) throw error;
      void notifyAdCreativeDeclinedAdmin(item, item.moderation_notes || "");
      toast?.({ title: "Asset declined and removed", description: `"${item.ad_name}" was deleted from the library.` });
      setRequests((r) => r.filter((x) => x.id !== item.id));
      onQueueChange?.();
    } catch {
      toast?.({ title: "Failed to decline", variant: "destructive" });
    }
    setProcessing(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-mint-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-muted-foreground">
          {requests.length === 0
            ? "No manual review requests"
            : `${requests.length} pending review${requests.length === 1 ? "" : "s"}`}
        </p>
        <Button variant="ghost" size="sm" className="rounded-xl h-7 text-xs" onClick={load}>
          Refresh
        </Button>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No advertising assets waiting for review</p>
      ) : (
        <div className="space-y-3">
          {requests.map((item) => {
            const person = users[item.user_id];
            const href = ensureHttpUrl(item.link_url);
            const busy = processing === item.id;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-white p-4 flex flex-col sm:flex-row sm:items-start gap-3 shadow-sm"
              >
                {item.image_url ? (
                  <a
                    href={item.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View full size"
                    className="shrink-0 w-20 aspect-[2/1] rounded-lg border border-border bg-muted/30 overflow-hidden flex items-center justify-center hover:ring-2 hover:ring-mint-300 transition"
                  >
                    <img src={item.image_url} alt={item.ad_name || "Ad creative"} className="max-w-full max-h-full object-contain" />
                  </a>
                ) : (
                  <div className="shrink-0 w-20 aspect-[2/1] rounded-lg border border-dashed border-border bg-muted/20" />
                )}

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{person?.name || "Supporter"}</span>
                    {person?.email && (
                      <span className="text-xs text-muted-foreground">{person.email}</span>
                    )}
                  </div>
                  {item.ad_name && (
                    <p className="text-sm text-foreground">{item.ad_name}</p>
                  )}
                  {item.moderation_notes && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      <span className="font-medium text-foreground/80">Decline reason: </span>
                      {item.moderation_notes}
                    </p>
                  )}
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-mint-600 hover:underline break-all"
                    >
                      {item.link_url}
                    </a>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatSubmittedAt(item.created_at)}
                  </p>
                </div>

                <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                  <Button
                    size="sm"
                    className="rounded-xl h-7 text-xs bg-mint-500 hover:bg-mint-600 text-white"
                    disabled={busy}
                    onClick={() => handleApprove(item)}
                  >
                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" />Approve</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl h-7 text-xs text-destructive border-destructive/20"
                    disabled={busy}
                    onClick={() => {
                      setDeclineNote("");
                      setDeclineItem(item);
                    }}
                  >
                    <X className="w-3 h-3 mr-1" />Decline
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={Boolean(declineItem)}
        onOpenChange={(open) => {
          if (!open) {
            setDeclineItem(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Decline & Delete This Creative?</AlertDialogTitle>
            <AlertDialogDescription>
              Decline “{declineItem?.ad_name || "this creative"}”? It will be permanently removed from the library (it was never live on the site).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <Button
              className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={processing === declineItem?.id}
              onClick={confirmDecline}
            >
              {processing === declineItem?.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Decline & Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
