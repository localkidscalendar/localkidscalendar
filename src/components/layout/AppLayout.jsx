import React, { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import BannerAdDisplay from "@/components/ads/BannerAdDisplay";
import BetaBanner from "@/components/beta/BetaBanner";
import { useAuth } from "@/lib/AuthContext";
import { isAccountDisabled, isProfileComplete } from "@/lib/authRoles";

/** Paths disabled users may open without being forced to the status page. */
const DISABLED_ALLOWED_PREFIXES = [
  "/account-disabled",
  "/account-disabled-preview",
  "/",
  "/event/",
  "/organizers",
  "/supporters",
  "/about",
  "/contact",
  "/tips-community-members",
  "/tips-organizers",
  "/tips-supporters",
  "/invite-organizer",
  "/invite-community-member",
  "/invite-supporter",
  "/advertiser-terms",
];

/** Incomplete OAuth/email profiles may only read Community Rules while finishing signup. */
const INCOMPLETE_ALLOWED_PREFIXES = ["/about"];

function isPathAllowedWhileDisabled(pathname) {
  if (pathname === "/") return true;
  if (pathname.startsWith("/event/")) return true;
  return DISABLED_ALLOWED_PREFIXES.some((prefix) => {
    if (prefix === "/" || prefix === "/event/") return false;
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

function isPathAllowedWhileIncomplete(pathname) {
  return INCOMPLETE_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    setUser,
    registeredUser,
    isLoadingAuth: userLoading,
    checkUserAuth,
    authChecked,
  } = useAuth();
  const showAd = location.pathname !== "/" && location.pathname !== "/supporters";

  useEffect(() => {
    if (!authChecked || userLoading) return;
    if (!isAccountDisabled(user)) return;
    if (isPathAllowedWhileDisabled(location.pathname)) return;
    navigate("/account-disabled", { replace: true });
  }, [authChecked, userLoading, user, location.pathname, navigate]);

  // Signed-in but unfinished signup → same Register profile form (not Account).
  useEffect(() => {
    if (!authChecked || userLoading) return;
    if (!user || isAccountDisabled(user) || isProfileComplete(user)) return;
    if (isPathAllowedWhileIncomplete(location.pathname)) return;
    navigate("/register?complete=1", { replace: true });
  }, [authChecked, userLoading, user, location.pathname, navigate]);

  // Feature surfaces treat disabled accounts as signed out.
  const featureUser = registeredUser;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <BetaBanner />
      <Navbar user={featureUser} sessionUser={user} />
      <main className="flex-1">
        <Outlet context={{ user: featureUser, sessionUser: user, setUser, userLoading, checkUserAuth }} />
      </main>
      <Footer user={featureUser} />
      {showAd && <BannerAdDisplay user={featureUser} userLoading={userLoading} />}
    </div>
  );
}
