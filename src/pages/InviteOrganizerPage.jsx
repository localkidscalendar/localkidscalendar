import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Copy, Mail, MessageSquare, Sparkles } from "lucide-react";

const MEMO_SUBJECT = "I think your organization would be a great fit for LocalKidsCalendar.com";

const MEMO_BODY_SMS = `Hi! I think your organization would be a great fit for LocalKidsCalendar.com — a free, community-powered hub where local families discover kids' camps, classes, sports, and events. It's free to list your activities and reach families already searching for what you offer. Check it out: LocalKidsCalendar.com`;

const MEMO_BODY = `Hi there,

I think your organization would be a great fit for LocalKidsCalendar.com — a free, community-powered hub where local families discover kids' camps, classes, sports, and events.

Here's why organizers love it:
- It's completely free to list your activities — no directory fees, no boosted posts.
- Reach families who are already searching for exactly what you offer.
- Families can favorite your organization and get notified automatically when you post something new.
- Grow your audience beyond your existing newsletter or social media followers.

Getting started is easy:
1. Visit LocalKidsCalendar.com
2. Create a free account and choose "Organizer" as your account type
3. Post your first activity with photos and full details
4. Check out the Tips for Organizers guide to learn more and make the most of the experience.

We'd love to have you join our community!`;

export default function InviteOrganizerPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${MEMO_SUBJECT}\n\n${MEMO_BODY}`);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  const handleCreateEmail = () => {
    const mailto = `mailto:?subject=${encodeURIComponent(MEMO_SUBJECT)}&body=${encodeURIComponent(MEMO_BODY)}`;
    window.location.href = mailto;
  };

  const handleCreateText = () => {
    const sms = `sms:?&body=${encodeURIComponent(MEMO_BODY_SMS)}`;
    window.location.href = sms;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-mint-500 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Letter header */}
        <div className="bg-gradient-to-br from-mint-50 to-peach-50 px-6 sm:px-8 py-6 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-5 h-5 text-mint-500" />
            <h1 className="font-heading font-bold text-2xl">Invite an Organizer (Template)</h1>
          </div>
          <p className="text-sm text-muted-foreground">Send a personal invitation to bring a new organizer into the community.</p>
        </div>

        <div className="px-6 sm:px-8 py-6 space-y-5">
          {/* Letter preview */}
          <div className="bg-muted/40 rounded-xl border border-border p-5 text-sm leading-relaxed space-y-3">
            <p>Hi there,</p>
            <p>I think your organization would be a great fit for <strong>LocalKidsCalendar.com</strong> — a free, community-powered hub where local families discover kids' camps, classes, sports, and events.</p>
            <p className="font-semibold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-peach-500" /> Here's why organizers love it:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>It's completely free to list your activities — no directory fees, no boosted posts.</li>
              <li>Reach families who are already searching for exactly what you offer.</li>
              <li>Families can favorite your organization and get notified automatically when you post something new.</li>
              <li>Grow your audience beyond your existing newsletter or social media followers.</li>
            </ul>
            <p className="font-semibold">Getting started is easy:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Visit LocalKidsCalendar.com</li>
              <li>Create a free account and choose "Organizer" as your account type</li>
              <li>Post your first activity with photos and full details</li>
              <li>Check out the <Link to="/tips-organizers" className="text-mint-500 hover:underline">Tips for Organizers</Link> guide to learn more and make the most of the experience.</li>
            </ol>
            <p>We'd love to have you join our community!</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button type="button" onClick={handleCopy} className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white">
              <Copy className="w-4 h-4 mr-2" />
              Copy to Clipboard
            </Button>
            <Button type="button" onClick={handleCreateEmail} className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white">
              <Mail className="w-4 h-4 mr-2" />
              Create Email
            </Button>
            <Button type="button" onClick={handleCreateText} className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white">
              <MessageSquare className="w-4 h-4 mr-2" />
              Create Text
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}