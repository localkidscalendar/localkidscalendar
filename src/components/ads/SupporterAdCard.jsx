import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ExternalLink, Heart, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import AuthPromptModal from "@/components/shared/AuthPromptModal";

const FLAG_REASONS = ["inaccurate", "inappropriate", "spam", "other"];

// Placeholder shown when no ad fills a slot
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
        await base44.entities.BannerAd.update(ad.id, { clicks: (ad.clicks || 0) + 1 });
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
      const flagData = {
        target_type: "ad",
        target_id: ad.id,
        reason: selectedReason,
        reporter_id: user.id,
        reporter_name: user.full_name,
        target_contributor_name: ad.business_name,
      };
      if (selectedReason === "other") flagData.details = otherText.trim();
      await base44.entities.FlagReport.create(flagData);
      const newFlaggedBy = [...(ad.flagged_by || []), user.id];
      const newFlagCount = (ad.flag_count || 0) + 1;
      const updates = { flag_count: newFlagCount, flagged_by: newFlaggedBy };
      if (newFlagCount >= 3) updates.status = "flagged";
      await base44.entities.BannerAd.update(ad.id, updates);
      toast({ title: newFlagCount >= 3 ? "Ad flagged for review" : "Ad flagged. Thank you for helping keep our community safe." });
    } catch {}
    setFlagOpen(false);
    setSelectedReason(null);
    setOtherText("");
  };

  return (
    <div className="group rounded-2xl border-2 border-black transition-all duration-300 hover:shadow-lg hover:shadow-black/15 hover:-translate-y-0.5 animate-settle bg-white overflow-hidden">
      {/* Ad image — clickable, full width, unobstructed */}
      <div
        className="h-48 overflow-hidden cursor-pointer"
        onClick={handleImageClick}
        title="Visit advertiser"
      >
        {ad.image_url ? (
          <img
            src={ad.image_url}
            alt="Supporter ad"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-peach-50 to-peach-100 flex items-center justify-center">
            <Heart className="w-10 h-10 text-peach-300" />
          </div>
        )}
      </div>

      {/* Footer bar — compact with zip code and actions */}
      <div className="bg-black/90 backdrop-blur-sm px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">{ad.zip_code}</span>
          <span className="text-xs text-gray-300">Supporter</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleFlagButtonClick}
            title={user ? "Report this ad if it's inaccurate, inappropriate, or spam." : "Report this ad if it's inaccurate, inappropriate, or spam. Requires a registered, signed-in account."}
            className={`text-gray-400 hover:text-red-400 transition-colors ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Flag className="w-3.5 h-3.5" />
          </button>
          <a
            href={ad.link_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackClick}
            title="Visit advertiser"
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Flag dropdown */}
      {flagOpen && (
        <div className="bg-peach-50 p-3 animate-settle" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs font-medium mb-2">Why are you flagging this ad?</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {FLAG_REASONS.map((r) => (
              <Button
                key={r}
                type="button"
                variant={selectedReason === r ? "default" : "outline"}
                size="sm"
                className="rounded-lg text-xs capitalize h-6 px-2"
                onClick={() => setSelectedReason(r)}
              >
                {r}
              </Button>
            ))}
          </div>
          {selectedReason === "other" && (
            <textarea
              placeholder="Please describe the issue..."
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              className="w-full rounded-lg border border-peach-200 p-2 text-xs focus:outline-none focus:ring-2 focus:ring-peach-500 mb-2"
              rows={2}
            />
          )}
          {selectedReason && (
            <div className="flex gap-2">
              <Button size="sm" className="rounded-lg text-xs h-6" onClick={handleSubmitFlag} disabled={selectedReason === "other" && !otherText.trim()}>
                Submit
              </Button>
              <Button size="sm" variant="outline" className="rounded-lg text-xs h-6" onClick={() => { setFlagOpen(false); setSelectedReason(null); setOtherText(""); }}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      <AuthPromptModal open={authPrompt} onOpenChange={setAuthPrompt} message="Sign in to report this ad if it's inaccurate, inappropriate, or spam." />
    </div>
  );
}