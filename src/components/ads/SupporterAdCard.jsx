import React, { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ExternalLink, Heart, Flag } from "lucide-react";
import AuthPromptModal from "@/components/shared/AuthPromptModal";
import FlagReportForm, { AD_FLAG_REASONS, FlagWithdrawDialog } from "@/components/shared/FlagReportForm";
import { useToast } from "@/components/ui/use-toast";
import { notifyAdAssetDisabled } from "@/lib/quarantineAdLibrary";
import { alreadyFlaggedMessage, getUserFlagReport, withdrawFlag } from "@/lib/flagReports";
import { SUPPORTER_AD_IMAGE_FRAME_CLASS } from "@/lib/supporterAdDisplay.js";

export function SupporterAdPlaceholder() {
  // Image area uses 3:2 aspect; black footer is a separate row below (not over the photo).
  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-peach-200 overflow-hidden animate-settle flex flex-col">
      <div className={`${SUPPORTER_AD_IMAGE_FRAME_CLASS} bg-gradient-to-br from-peach-50 to-mint-50 flex flex-col items-center justify-center gap-2 px-4 text-center`}>
        <Heart className="w-10 h-10 text-peach-300" />
        <p className="font-heading font-semibold text-sm text-peach-600">Your business could shine here!</p>
        <p className="text-xs text-muted-foreground max-w-[200px]">Support local kids. Reach local families.</p>
      </div>
      <div className="bg-black/90 backdrop-blur-sm px-3 py-1.5 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-300">Open spot</span>
        <a
          href="/supporters#become-a-supporter"
          className="text-xs font-medium text-peach-300 hover:text-peach-200 transition-colors shrink-0"
        >
          Learn more →
        </a>
      </div>
    </div>
  );
}

function resolveAssetId(ad) {
  return ad?.ad_library_id || null;
}

export default function SupporterAdCard({ ad, user, onAssetFlagged }) {
  const clickedRef = useRef(false);
  const { toast } = useToast();
  const [flagOpen, setFlagOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [flagAdminCleared, setFlagAdminCleared] = useState(false);
  const [authPrompt, setAuthPrompt] = useState(false);
  const isOwner = Boolean(user?.id && ad?.user_id && user.id === ad.user_id);
  const assetId = resolveAssetId(ad);
  const flagTargetId = assetId || ad.id;

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

  const handleFlagButtonClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { setAuthPrompt(true); return; }
    if (isOwner) return;
    try {
      const status = await getUserFlagReport("ad", flagTargetId, user.id);
      if (status.exists) {
        setFlagAdminCleared(status.adminCleared);
        setWithdrawOpen(true);
        return;
      }
    } catch (err) {
      toast({ title: "Could not check flag status", description: err.message, variant: "destructive" });
      return;
    }
    setFlagOpen(true);
  };

  const handleSubmitFlag = async ({ reason, details }) => {
    try {
      const { data, error } = await supabase.rpc("submit_flag", {
        p_target_type: "ad",
        // Prefer asset id; RPC still accepts placement id and remaps.
        p_target_id: flagTargetId,
        p_reason: reason,
        p_details: details,
      });
      if (error) throw error;
      toast({
        title: data?.archived
          ? "Ad creative flagged for review"
          : "Ad creative flagged. Thank you for helping keep our community safe.",
      });
      if (data?.archived && data?.needs_notify !== false) {
        void notifyAdAssetDisabled(ad.id);
      }
      onAssetFlagged?.({
        assetId: data?.asset_id || assetId,
        bannerId: ad.id,
        archived: Boolean(data?.archived),
        flagCount: data?.flag_count,
      });
    } catch (err) {
      const already = /already flagged/i.test(err.message || "");
      toast({
        title: already ? alreadyFlaggedMessage("ad creative") : "Could not submit report",
        description: already ? undefined : err.message,
        variant: already ? "default" : "destructive",
      });
      throw err;
    }
  };

  const handleWithdrawFlag = async () => {
    const { data, error } = await withdrawFlag("ad", flagTargetId);
    if (error) {
      toast({ title: "Could not remove flag", description: error.message, variant: "destructive" });
      throw error;
    }
    toast({ title: "Your flag was removed" });
    onAssetFlagged?.({
      assetId: data?.asset_id || assetId,
      bannerId: ad.id,
      archived: false,
      flagCount: data?.flag_count,
      withdrawn: true,
    });
  };

  return (
    <div className="group rounded-2xl border-2 border-black transition-all duration-300 hover:shadow-lg hover:shadow-black/15 hover:-translate-y-0.5 animate-settle bg-white overflow-hidden flex flex-col">
      {/* Creative frame — 3:2 photo area; footer sits below, not over the image */}
      <div
        className={`${SUPPORTER_AD_IMAGE_FRAME_CLASS} cursor-pointer shrink-0`}
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

      {/* Footer bar — below the image (does not cover the creative) */}
      <div className="shrink-0 bg-black/90 backdrop-blur-sm px-3 py-1.5 flex items-center justify-between gap-2 border-t border-black">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-white">{ad.zip_code}</span>
          <span className="text-xs text-gray-300">Supporter</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isOwner && (
            <button
              type="button"
              onClick={handleFlagButtonClick}
              title={user ? "Report this ad creative if it's inappropriate or spam." : "Report this ad creative if it's inappropriate or spam. Requires a registered, signed-in account."}
              className={`text-gray-400 hover:text-red-400 transition-colors ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}
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

      <FlagReportForm
        open={flagOpen}
        onOpenChange={setFlagOpen}
        targetLabel="ad creative"
        reasons={AD_FLAG_REASONS}
        onSubmit={handleSubmitFlag}
      />
      <FlagWithdrawDialog
        open={withdrawOpen}
        onOpenChange={(open) => {
          setWithdrawOpen(open);
          if (!open) setFlagAdminCleared(false);
        }}
        targetLabel="ad creative"
        adminCleared={flagAdminCleared}
        onConfirm={handleWithdrawFlag}
      />

      <AuthPromptModal
        open={authPrompt}
        onOpenChange={setAuthPrompt}
        message="Sign in to report this ad creative if it's inappropriate or spam."
      />
    </div>
  );
}
