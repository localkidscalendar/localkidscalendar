import React, { useState, useEffect } from "react";
import { useOutletContext, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Heart, Shield, Star, CheckCircle, ExternalLink, UserPlus } from "lucide-react";
import SupporterAdCard, { SupporterAdPlaceholder } from "@/components/ads/SupporterAdCard";
import BecomeASupporterModal from "@/components/ads/BecomeASupporterModal";
import ZipRequiredModal from "@/components/shared/ZipRequiredModal";
import useSessionZip from "@/lib/useSessionZip";
import { SUPPORTER_RULES } from "@/lib/supporterContent";

const DEFAULT_PRICING = { monthly_rate: 150, annual_discount_percent: 30 };

export default function Supporters() {
  const { user, userLoading } = useOutletContext();
  const navigate = useNavigate();
  const { zip: userZip, resolved, setCurrentZip } = useSessionZip(user, userLoading);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [showSupporterModal, setShowSupporterModal] = useState(false);
  const [maxSlots, setMaxSlots] = useState(3);

  useEffect(() => {
    loadPricing();
  }, []);

  useEffect(() => {
    loadAds();
  }, [userZip]);

  const loadPricing = async () => {
    try {
      const { data } = await supabase
        .from("ad_pricing_config")
        .select("*")
        .eq("config_key", "global")
        .maybeSingle();
      if (data) setPricing(data);
    } catch {}
  };

  const loadAds = async () => {
    setLoading(true);
    try {
      if (!userZip) {
        setAds([]);
        setMaxSlots(3);
        setLoading(false);
        return;
      }
      const [{ data: activeAds }, { data: zipConfig }] = await Promise.all([
        supabase
          .from("banner_ads")
          .select("*")
          .eq("status", "active")
          .eq("zip_code", userZip)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("ad_zip_config")
          .select("max_slots")
          .eq("zip_code", userZip)
          .maybeSingle(),
      ]);
      setAds(activeAds || []);
      setMaxSlots(Number(zipConfig?.max_slots) || 3);
    } catch {
      setAds([]);
    }
    setLoading(false);
  };

  const placeholderCount = Math.max(0, maxSlots - ads.length);

  if (resolved && !userZip) {
    return <ZipRequiredModal onSubmit={(zip) => setCurrentZip(zip)} />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-10">
        <h1 className="font-heading font-bold text-3xl sm:text-4xl mb-4">Our Supporters</h1>
        <p className="text-muted-foreground leading-relaxed">
          LocalKidsCalendar.com is a FREE, community-driven resource for families — and it stays that way thanks to the generous businesses and organizations who choose to support it. Our Supporters are businesses who believe in investing in the local community by reaching families right where they are: planning their kids' next adventure. By advertising here, Supporters help keep this platform free and thriving for every parent who uses it.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <Button className="rounded-xl bg-mint-200 hover:bg-mint-300 text-mint-600" onClick={() => navigate("/invite-community-member")}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite a Community Member
          </Button>
          <Button className="rounded-xl bg-mint-200 hover:bg-mint-300 text-mint-600" onClick={() => navigate("/invite-organizer")}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite an Organizer
          </Button>
          <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={() => navigate("/invite-supporter")}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite a Supporter
          </Button>
        </div>
      </div>

      <div className="mb-10">
        <div className="flex items-center gap-2 mb-1">
          <Star className="w-5 h-5 text-peach-500" />
          <h2 className="font-heading font-bold text-xl">
            {userZip ? `Current Supporters Near ${userZip}` : "Current Supporters In Your Area"}
          </h2>
        </div>
        {userZip && (
          <p className="text-xs text-muted-foreground mb-4">
            Showing Supporters for zip code <strong>{userZip}</strong>. This matches your <a href="/" className="text-mint-500 hover:underline">activity search area</a>.
          </p>
        )}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-muted rounded-2xl animate-pulse w-full h-56" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
            {ads.map((ad) => (
              <SupporterAdCard key={ad.id} ad={ad} user={user} />
            ))}
            {Array.from({ length: placeholderCount }).map((_, i) => (
              <SupporterAdPlaceholder key={`ph-${i}`} />
            ))}
          </div>
        )}
      </div>

      <div className="mb-10 bg-white rounded-2xl border border-border p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-5">
          <Shield className="w-6 h-6 text-peach-500" />
          <h2 className="font-heading font-bold text-xl">Our Supporter Rules</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          To protect our community of families and children, all Supporters must agree to and abide by the following rules. Violations may result in immediate removal without refund.
        </p>
        <div className="space-y-4">
          {SUPPORTER_RULES.map((rule, idx) => (
            <div key={idx} className="flex gap-3">
              <span className="text-peach-400 font-bold text-lg leading-tight shrink-0 mt-0.5">✦</span>
              <div>
                <p className="font-semibold text-sm mb-0.5">{rule.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{rule.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div id="become-a-supporter" className="bg-gradient-to-br from-peach-50 to-mint-50 rounded-2xl border border-peach-200 p-6 sm:p-8 text-center scroll-mt-24">
        <div className="flex items-center justify-center gap-2 mb-3">
          <CheckCircle className="w-6 h-6 text-peach-500" />
          <h2 className="font-heading font-bold text-xl">Become a Supporter</h2>
        </div>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto mb-6 leading-relaxed">
          Ready to reach local families in your area? During beta, you can submit creatives and request zip placements for admin activation. Paid Stripe checkout returns after beta. Plans will start at <strong>${pricing.monthly_rate}/month per zip code</strong>, with a discounted annual option.
        </p>
        <div className="flex flex-col items-center gap-3 mb-4">
          <Button
            className="rounded-xl bg-peach-500 hover:bg-peach-400 text-white px-6"
            onClick={() => {
              if (user?.is_advertiser) navigate("/ad-manager");
              else setShowSupporterModal(true);
            }}
          >
            <Heart className="w-4 h-4 mr-2" />
            {user?.is_advertiser ? "Open Ad Manager" : "Become a Supporter"}
          </Button>
          <Link
            to="/advertiser-terms"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Supporter Terms of Service
          </Link>
        </div>
      </div>

      <BecomeASupporterModal
        open={showSupporterModal}
        onClose={() => setShowSupporterModal(false)}
        user={user}
      />
    </div>
  );
}
