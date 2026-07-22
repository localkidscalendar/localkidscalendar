import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import BannerAdDisplay from "@/components/ads/BannerAdDisplay";
import BetaBanner from "@/components/beta/BetaBanner";
import { base44 } from "@/api/base44Client";

export default function AppLayout() {
  const location = useLocation();
  // Home handles ads inline in the event feed; Supporters manages its own display
  const showAd = location.pathname !== "/" && location.pathname !== "/supporters";
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const me = await base44.auth.me();
          // Fetch entity record to get the live role (auth.me() may return a stale role)
          try {
            const entityUsers = await base44.entities.User.filter({ email: me.email });
            const entityUser = entityUsers?.[0];
            const merged = { ...me, role: entityUser?.role || me.role, first_name: entityUser?.first_name, last_name: entityUser?.last_name, zip_code: entityUser?.zip_code || me.zip_code, phone: entityUser?.phone || me.phone };
            // For organizers, pull org_name from the Organizer entity for display
            if (merged.role === 'organizer') {
              try {
                const orgRecords = await base44.entities.Organizer.filter({ user_id: me.id });
                if (orgRecords?.[0]?.org_name) {
                  merged.org_name = orgRecords[0].org_name;
                }
              } catch {}
            }
            setUser(merged);
          } catch {
            // If entity fetch fails, still set user from auth so navbar shows logged-in state
            setUser(me);
          }
        }
      } catch {}
      setUserLoading(false);
    };
    load();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <BetaBanner />
      <Navbar user={user} />
      <main className="flex-1">
        <Outlet context={{ user, setUser, userLoading }} />
      </main>
      <Footer user={user} />
      {showAd && <BannerAdDisplay user={user} userLoading={userLoading} />}
    </div>
  );
}