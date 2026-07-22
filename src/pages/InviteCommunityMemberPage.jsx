import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Copy, Mail, MessageSquare, Sparkles } from "lucide-react";

const MEMO_SUBJECT = "Check out LocalKidsCalendar.com — a free hub for local kids' activities";

const MEMO_BODY_SMS = `Hi! I found LocalKidsCalendar.com — a free, community-powered hub where local families discover kids' camps, classes, sports, and events. Thought you might like it too: LocalKidsCalendar.com`;

const MEMO_BODY = `Hi there,

I wanted to share LocalKidsCalendar.com with you — a free, community-powered hub where local families discover kids' camps, classes, sports, and events.

Here's why parents love it:
- It's completely free to use — browse and save as many activities as you want.
- Anyone can post and share an activity — you don't need to be a professional organizer.
- Easily filter by age, location, price, and category to find exactly what your kids will enjoy.
- Option to receive weekly email notifications with new posts that match your preferences and when your favorite organizers add new activities.

Getting started is easy:
1. Visit LocalKidsCalendar.com
2. Create a free account as a Community Member
3. Save your favorite activities and organizers
4. Check out the Tips for Community Members guide to learn more and make the most of the experience.

Hope to see you there!`;

export default function InviteCommunityMemberPage() {
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
            <h1 className="font-heading font-bold text-2xl">Invite a Community Member (Template)</h1>
          </div>
          <p className="text-sm text-muted-foreground">Send a personal invitation to bring a new family into the community.</p>
        </div>

        <div className="px-6 sm:px-8 py-6 space-y-5">
          {/* Letter preview */}
          <div className="bg-muted/40 rounded-xl border border-border p-5 text-sm leading-relaxed space-y-3">
            <p>Hi there,</p>
            <p>I wanted to share <strong>LocalKidsCalendar.com</strong> with you — a free, community-powered hub where local families discover kids' camps, classes, sports, and events.</p>
            <p className="font-semibold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-peach-500" /> Here's why parents love it:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>It's completely free to use — browse and save as many activities as you want.</li>
              <li>Anyone can post and share an activity — you don't need to be a professional organizer.</li>
              <li>Easily filter by age, location, price, and category to find exactly what your kids will enjoy.</li>
              <li>Option to receive weekly email notifications with new posts that match your preferences and when your favorite organizers add new activities.</li>
            </ul>
            <p className="font-semibold">Getting started is easy:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Visit LocalKidsCalendar.com</li>
              <li>Create a free account as a Community Member</li>
              <li>Save your favorite activities and organizers</li>
              <li>Check out the <Link to="/tips-community-members" className="text-mint-500 hover:underline">Tips for Community Members</Link> guide to learn more and make the most of the experience.</li>
            </ol>
            <p>Hope to see you there!</p>
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