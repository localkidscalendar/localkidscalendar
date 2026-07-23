import React, { useState } from "react";
import { useOutletContext, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Heart, Shield, Star, CheckCircle, ExternalLink, UserPlus } from "lucide-react";
import { SupporterAdPlaceholder } from "@/components/ads/SupporterAdCard";
import BecomeASupporterModal from "@/components/ads/BecomeASupporterModal";
import ZipRequiredModal from "@/components/shared/ZipRequiredModal";
import useSessionZip from "@/lib/useSessionZip";
import { SUPPORTER_RULES } from "@/lib/supporterContent";

const DEFAULT_PRICING = { monthly_rate: 150, annual_discount_percent: 30 };

export default function Supporters() {
  const { user, userLoading } = useOutletContext();
  const navigate = useNavigate();
  const { zip: userZip, resolved, setCurrentZip } = useSessionZip(user, userLoading);
  const [showSupporterModal, setShowSupporterModal] = useState(false);
  const pricing = DEFAULT_PRICING;

  // Ads are not on Supabase yet — show open slots for beta
  const maxSlots = 3;
  const placeholderCount = maxSlots;

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
        {!userZip && (
          <p className="text-xs text-muted-foreground mb-4">
            Your zip code is established on the <a href="/" className="text-mint-500 hover:underline">Activities page</a>.
          </p>
        )}
        <p className="text-sm text-muted-foreground mb-4 rounded-xl bg-mint-50 border border-mint-100 px-4 py-3">
          Supporter ads are paused during our beta while we finish the advertising system. Open slots below show where ads will appear.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: placeholderCount }).map((_, i) => <SupporterAdPlaceholder key={`ph-${i}`} />)}
        </div>
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

      <div className="bg-gradient-to-br from-peach-50 to-mint-50 rounded-2xl border border-peach-200 p-6 sm:p-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <CheckCircle className="w-6 h-6 text-peach-500" />
          <h2 className="font-heading font-bold text-xl">Become a Supporter</h2>
        </div>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto mb-6 leading-relaxed">
          Ready to reach local families in your area? Supporter plans are available by zip code — choose the zip codes where you want to appear and start connecting with parents looking for exactly what you offer. Plans start at <strong>${pricing.monthly_rate}/month per zip code</strong>, with a discounted annual option available.
        </p>
        <div className="flex flex-col items-center gap-3 mb-4">
          <Button
            className="rounded-xl bg-peach-500 hover:bg-peach-400 text-white px-6"
            onClick={() => setShowSupporterModal(true)}
          >
            <Heart className="w-4 h-4 mr-2" />
            Become a Supporter
          </Button>
          <Link
            to="/advertiser-terms"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Supporter Terms of Service
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 text-left">
          {[
            { icon: "📍", title: "Zip Code Targeting", text: "Reach families exactly where they live. Choose the zip codes that matter most to your business." },
            { icon: "🔄", title: "Flexible Plans", text: `Monthly ($${pricing.monthly_rate}/zip) or Annual plans with ${pricing.annual_discount_percent}% discount. Cancel anytime before renewal deadline.` },
            { icon: "👨‍👩‍👧", title: "Trusted Audience", text: "Parents actively searching for kids' activities — one of the most engaged audiences for family-friendly businesses." },
          ].map((benefit, idx) => (
            <div key={idx} className="bg-white/70 rounded-xl p-4">
              <div className="text-2xl mb-2">{benefit.icon}</div>
              <p className="font-semibold text-sm mb-1">{benefit.title}</p>
              <p className="text-xs text-muted-foreground">{benefit.text}</p>
            </div>
          ))}
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
