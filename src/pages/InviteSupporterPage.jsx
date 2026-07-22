import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Copy, Mail, MessageSquare, Sparkles } from "lucide-react";

const MEMO_SUBJECT = "I think your business would be a great Supporter for LocalKidsCalendar.com";

const MEMO_BODY_SMS = `Hi! I think your business would be a great Supporter for LocalKidsCalendar.com — a free, community-powered hub where local families discover kids' camps, classes, sports, and events. It's a great way to reach local parents. Check it out: LocalKidsCalendar.com`;

const MEMO_BODY = `Hi there,

I think your business would be a great Supporter (advertiser) for LocalKidsCalendar.com — a free, community-powered hub where local families discover kids' camps, classes, sports, and events.

Here's why businesses love supporting it:
- Reach families right where they are, planning their kids' next activity.
- Zip code targeting means you can focus your reach on the exact community you serve.
- Flexible monthly or discounted annual plans, with no long-term commitment required.
- Supporting the platform helps keep it free for every parent in the community.

Getting started is easy:
1. Visit LocalKidsCalendar.com
2. Create a free account and upgrade to add Supporter features
3. Upload your ad image and link for approval
4. Check out the Tips for Supporters guide to learn more and make the most of the experience.

We'd love to have your business join our community!`;

export default function InviteSupporterPage() {
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
            <h1 className="font-heading font-bold text-2xl">Invite a Supporter/Advertiser (Template)</h1>
          </div>
          <p className="text-sm text-muted-foreground">Send a personal invitation to bring a new business supporter into the community.</p>
        </div>

        <div className="px-6 sm:px-8 py-6 space-y-5">
          {/* Letter preview */}
          <div className="bg-muted/40 rounded-xl border border-border p-5 text-sm leading-relaxed space-y-3">
            <p>Hi there,</p>
            <p>I think your business would be a great Supporter (advertiser) for <strong>LocalKidsCalendar.com</strong> — a free, community-powered hub where local families discover kids' camps, classes, sports, and events.</p>
            <p className="font-semibold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-peach-500" /> Here's why businesses love supporting it:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Reach families right where they are, planning their kids' next activity.</li>
              <li>Zip code targeting means you can focus your reach on the exact community you serve.</li>
              <li>Flexible monthly or discounted annual plans, with no long-term commitment required.</li>
              <li>Supporting the platform helps keep it free for every parent in the community.</li>
            </ul>
            <p className="font-semibold">Getting started is easy:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Visit LocalKidsCalendar.com</li>
              <li>Create a free account and upgrade to add Supporter features</li>
              <li>Upload your ad image and link for approval</li>
              <li>Check out the <Link to="/tips-supporters" className="text-mint-500 hover:underline">Tips for Supporters</Link> guide to learn more and make the most of the experience.</li>
            </ol>
            <p>We'd love to have your business join our community!</p>
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