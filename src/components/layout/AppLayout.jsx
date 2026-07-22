import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import BannerAdDisplay from "@/components/ads/BannerAdDisplay";
import BetaBanner from "@/components/beta/BetaBanner";
import { useAuth } from "@/lib/AuthContext";

export default function AppLayout() {
  const location = useLocation();
  const { user, isLoadingAuth: userLoading } = useAuth();
  // Home handles ads inline in the event feed; Supporters manages its own display
  const showAd = location.pathname !== "/" && location.pathname !== "/supporters";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <BetaBanner />
      <Navbar user={user} />
      <main className="flex-1">
        <Outlet context={{ user, setUser: () => {}, userLoading }} />
      </main>
      <Footer user={user} />
      {showAd && <BannerAdDisplay user={user} userLoading={userLoading} />}
    </div>
  );
}
