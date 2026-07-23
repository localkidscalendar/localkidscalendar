import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ExternalLink, Heart, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import AuthPromptModal from "@/components/shared/AuthPromptModal";

const FLAG_REASONS = ["inaccurate", "inappropriate", "spam", "other"];

const DEFAULT_CREATIVE_ASPECT = 4 / 3; // width / height fallback when no live ad is present

export function SupporterAdPlaceholder({ aspectRatio = DEFAULT_CREATIVE_ASPECT }) {
  // Image area matches live creatives (measured aspect when available); footer matches ad card.
  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-peach-200 overflow-hidden animate-settle flex flex-col">
      <div
        className="bg-gradient-to-br from-peach-50 to-mint-50 flex flex-col items-center justify-center gap-2 px-4 text-center w-full"
        style={{ aspectRatio: String(aspectRatio) }}
      >
        <Heart className="w-10 h-10 text-peach-300" />
        <p className="font-heading font-semibold text-sm text-peach-600">Your business could shine here!</p>
        <p className="text-xs text-muted-foreground max-w-[200px]">Support local kids. Reach local families.</p>
      </div>
      <div className="bg-black/90 backdrop-blur-sm px-3 py-1.5 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-300">Open spot</span>
        <a
          href="/supporters"
          className="text-xs font-medium text-peach-300 hover:text-peach-200 transition-colors shrink-0"
        >
          Learn more →
        </a>
      </div>
    </div>
  );
}

export default function SupporterAdCard({ ad, user, onCreativeAspect }) {
  const clickedRef = useRef(false);
  const { toast } = useToast();
  const [flagOpen, setFlagOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState(null);
  const [otherText, setOtherText] = useState("");
  const [authPrompt, setAuthPrompt] = useState(false);

  const isOwner = !!(user?.id && ad?.user_id && user.id === ad.user_id);
  const reportedAspect = useRef(false);

  const reportCreativeAspect = (img) => {
    if (reportedAspect.current || !onCreativeAspect || !img) return;
    const { naturalWidth: w, naturalHeight: h } = img;
    if (w > 0 && h > 0) {
      reportedAspect.current = true;
      onCreativeAspect(w / h);
    }
  };

  const handleCreativeLoad = (e) => reportCreativeAspect(e.currentTarget);

  // Cached images may not fire onLoad after mount
  const imageRef = useRef(null);
  useEffect(() => {
    reportedAspect.current = false;
    reportCreativeAspect(imageRef.current);
  }, [ad.image_url]);

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
    <div className="group rounded-2xl border-2 border-black transition-all duration-300 hover:shadow-lg hover:shadow-black/15 hover:-translate-y-0.5 animate-settle bg-white overflow-hidden flex flex-col">
      {/* Ad image — full creative at its natural height (no fixed crop) */}
      <div
        className="overflow-hidden cursor-pointer"
        onClick={handleImageClick}
        title="Visit advertiser"
      >
        {ad.image_url ? (
          <img
            ref={imageRef}
            src={ad.image_url}
            alt="Supporter ad"
            onLoad={handleCreativeLoad}
            className="w-full h-auto block group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full aspect-[4/3] bg-gradient-to-br from-peach-50 to-peach-100 flex items-center justify-center">
            <Heart className="w-10 h-10 text-peach-300" />
          </div>
        )}
      </div>

      {/* Owner-only creative name (not shown to the public) */}
      {isOwner && ad.business_name && (
        <div className="px-3 py-1 bg-muted/40 border-b border-border">
          <p className="text-[11px] text-muted-foreground truncate">
            Your ad: <span className="font-medium text-foreground">{ad.business_name}</span>
          </p>
        </div>
      )}

      {/* Footer bar — compact with zip code and actions */}
      <div className="bg-black/90 backdrop-blur-sm px-3 py-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-white">{ad.zip_code}</span>
          <span className="text-xs text-gray-300">Supporter</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
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
              <Button
                size="sm"
                className="rounded-lg text-xs h-6"
                onClick={handleSubmitFlag}
                disabled={selectedReason === "other" && !otherText.trim()}
              >
                Submit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg text-xs h-6"
                onClick={() => { setFlagOpen(false); setSelectedReason(null); setOtherText(""); }}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      <AuthPromptModal
        open={authPrompt}
        onOpenChange={setAuthPrompt}
        message="Sign in to report this ad if it's inaccurate, inappropriate, or spam."
      />
    </div>
  );
}
