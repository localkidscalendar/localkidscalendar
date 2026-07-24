import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Send, Loader2, Copy, Check } from "lucide-react";

/**
 * Organizer invite — until the site email engine is live, generates a registration
 * link (pre-selects Organizer) and opens a mailto / copies the link for the admin to send.
 */
export default function InviteOrganizer() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [invited, setInvited] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  const buildInviteUrl = (targetEmail) => {
    const url = new URL("/register", window.location.origin);
    url.searchParams.set("role", "organizer");
    url.searchParams.set("email", targetEmail);
    return url.toString();
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const inviteUrl = buildInviteUrl(trimmed);
      const subject = encodeURIComponent("You're invited to Local Kids Calendar as an Organizer");
      const body = encodeURIComponent(
        `Hi!\n\nYou're invited to join Local Kids Calendar as an Organizer so you can post activities for families.\n\nCreate your account here:\n${inviteUrl}\n\nThanks!\nLocal Kids Calendar`
      );
      window.open(`mailto:${trimmed}?subject=${subject}&body=${body}`, "_blank");

      setInvited((prev) => [{ email: trimmed, url: inviteUrl, date: new Date().toISOString() }, ...prev]);
      toast({
        title: "Invite ready",
        description: "A draft email opened with the registration link. You can also copy the link below.",
      });
      setEmail("");
    } catch (err) {
      toast({ title: "Failed to prepare invite", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  const copyLink = async (item, idx) => {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopiedId(idx);
      toast({ title: "Invite link copied" });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      <p className="text-xs text-muted-foreground mb-5">
        Opens a draft email with a registration link that pre-selects Organizer. Automated invite email returns with the site email engine.
      </p>

      <form onSubmit={handleInvite} className="flex gap-2 mb-6">
        <Input
          type="email"
          placeholder="organizer@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl flex-1"
          required
        />
        <Button type="submit" disabled={sending} className="rounded-xl shrink-0">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send Invite
        </Button>
      </form>

      {invited.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Prepared this session</p>
          <div className="space-y-2">
            {invited.map((i, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 bg-mint-50/50 rounded-xl px-3 py-2">
                <span className="text-sm truncate">{i.email}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs rounded-lg"
                    onClick={() => copyLink(i, idx)}
                  >
                    {copiedId === idx ? <Check className="w-3.5 h-3.5 text-mint-600" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy link
                  </Button>
                  <span className="text-xs text-mint-500 font-medium">Ready ✓</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
