import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Send, Loader2 } from "lucide-react";

export default function InviteOrganizer() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [invited, setInvited] = useState([]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      await base44.users.inviteUser(email.trim(), "user");
      setInvited((prev) => [{ email: email.trim(), date: new Date().toISOString() }, ...prev]);
      toast({ title: "Invite sent!", description: `${email.trim()} has been invited to join as an Organizer.` });
      setEmail("");
    } catch (err) {
      toast({ title: "Failed to send invite", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      <p className="text-xs text-muted-foreground mb-5">They'll receive an email to register and set up their profile.</p>

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
          <p className="text-xs font-medium text-muted-foreground mb-2">Sent this session</p>
          <div className="space-y-2">
            {invited.map((i, idx) => (
              <div key={idx} className="flex items-center justify-between bg-mint-50/50 rounded-xl px-3 py-2">
                <span className="text-sm">{i.email}</span>
                <span className="text-xs text-mint-500 font-medium">Invited ✓</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}