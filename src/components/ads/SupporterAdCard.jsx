import React, { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ExternalLink, Heart, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import AuthPromptModal from "@/components/shared/AuthPromptModal";

const FLAG_REASONS = ["inaccurate", "inappropriate", "spam", "other"];

export function SupporterAdPlaceholder() {
  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-peach-200 overflow-hidden animate-settle">
      <div className="h-48 bg-gradient-to-br from-peach-50 to-mint-50 flex flex-col items-center justify-center gap-2 px-4 text-center">
        <Heart className="w-10 h-10 text-peach-300" />
        <p className="font-heading font-semibold text-sm text-peach-600">Your business could shine here!</p>
        <p className="text-xs text-muted-foreground max-w-[200px]">Support local kids. Reach local families.</p>
      </div>
      <div className="px-3 py-2 bg-gradient-to-r from-peach-50 to-white">
        <p className="text-xs text-muted-foreground mb-2">
          Advertise to local families looking for kids' activities.
        </p>
        <a
          href="/supporters"
          className="inline-flex items-center gap-1 text-xs font-medium text-peach-500 hover:text-peach-700 transition-colors"
        >
          Learn about becoming a Supporter →
        </a>
      </div>
    </div>
  );
}

export default function SupporterAdCard({ ad, user }) {
  const clickedRef = useRef(false);
  const { toast } = useToast();
  const [flagOpen, setFlagOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState(null);
  const [otherText, setOtherText] = useState("");
  const [authPrompt, setAuthPrompt] = useState(false);

  const trackClick = async () => {
    if (!clickedRef.current) {
      clickedRef.current = true;
      try {
        await supabase
          .from("banner_ads")
          .update({ clicks: (ad.clicks || 0) + 1 })
          .eq("id", ad.id);
      } catch {}
    }
  };

  const handleImageClick = (e) => {
    e.preventDefault();
    trackClick();
    window.open(ad.link_url, "_blank", "noopener,noreferrer");
  };

  const handleFlagButtonClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { setAuthPrompt(true); return; }
    setFlagOpen((prev) => !prev);
  };

  const handleSubmitFlag = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedReason) return;
    if (selectedReason === "other" && !otherText.trim()) {
      toast({ title: "Please provide a reason" });
      return;
    }
    if ((ad.flagged_by || []).includes(user.id)) {
      toast({ title: "You already flagged this ad" });
      setFlagOpen(false);
      setSelectedReason(null);
      setOtherText("");
      return;
    }
    try {
      const { data, error } = await supabase.rpc("submit_flag", {
        p_target_type: "ad",
        p_target_id: ad.id,
        p_reason: selectedReason,
        p_details: selectedReason === "other" ? otherText.trim() : null,
      });
      if (error) throw error;
      toast({
        title: data?.archived
          ? "Ad flagged for review"
          : "Ad flagged. Thank you for helping keep our community safe.",
      });
    } catch (err) {
      toast({ title: "Could not submit report", description: err.message, variant: "destructive" });
    }
    setFlagOpen(false);
    setSelectedReason(null);
    setOtherText("");
  };

  return (
    <div className="group rounded-2xl border-2 border-black transition-all duration-300 hover:shadow-lg hover:shadow-black/15 hover:-translate-y-0.5 animate-settle bg-white overflow-hidden">
      <div
        className="h-48 overflow-hidden cursor-pointer"
        onClick={handleImageClick}
        title="Visit advertiser"
      >
        <img src={ad.image_url} alt={ad.business_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{ad.business_name}</p>
          <a
            href={ad.link_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackClick}
            className="inline-flex items-center gap-1 text-xs text-mint-600 hover:underline"
          >
            Visit site <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
          onClick={handleFlagButtonClick}
          title="Report this ad"
        >
          <Flag className="w-3.5 h-3.5" />
        </Button>
      </div>
      {flagOpen && (
        <form onSubmit={handleSubmitFlag} className="px-3 pb-3 space-y-2 border-t border-border pt-2">
          <p className="text-xs font-medium">Why are you flagging this ad?</p>
          <div className="flex flex-wrap gap-1.5">
            {FLAG_REASONS.map((r) => (
              <Button
                key={r}
                type="button"
                size="sm"
                variant={selectedReason === r ? "default" : "outline"}
                className="rounded-lg text-xs h-7 capitalize"
                onClick={() => setSelectedReason(r)}
              >
                {r}
              </Button>
            ))}
          </div>
          {selectedReason === "other" && (
            <textarea
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="Please describe the issue..."
              className="w-full rounded-lg border border-border p-2 text-xs"
              rows={2}
            />
          )}
          {selectedReason && (
            <Button type="submit" size="sm" className="rounded-lg text-xs h-7">Submit Report</Button>
          )}
        </form>
      )}
      <AuthPromptModal open={authPrompt} onClose={() => setAuthPrompt(false)} message="Sign in to report this ad." />
    </div>
  );
}
