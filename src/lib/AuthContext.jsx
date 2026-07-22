import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

const AuthContext = createContext();

async function buildAppUser(authUser) {
  if (!authUser) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  // If signup metadata says organizer but no org row exists yet, create a shell record.
  const meta = authUser.user_metadata || {};
  if ((profile?.role === "organizer" || meta.role === "organizer") && meta.org_name) {
    const { data: existingOrg } = await supabase
      .from("organizers")
      .select("id")
      .eq("user_id", authUser.id)
      .maybeSingle();
    if (!existingOrg) {
      await supabase.from("organizers").insert({
        user_id: authUser.id,
        org_name: meta.org_name,
        org_description: meta.org_description || "",
        org_website: meta.org_website || "",
        org_email: meta.org_email || authUser.email,
      });
    }
  }

  const { data: organizer } = await supabase
    .from("organizers")
    .select("*")
    .eq("user_id", authUser.id)
    .maybeSingle();

  const firstName = profile?.first_name || "";
  const lastName = profile?.last_name || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    id: authUser.id,
    email: authUser.email,
    role: profile?.role || meta.role || "community_member",
    is_advertiser: Boolean(profile?.is_advertiser),
    first_name: firstName,
    last_name: lastName,
    zip_code: profile?.zip_code || "",
    full_name: organizer?.org_name || fullName || authUser.email || "Member",
    org_name: organizer?.org_name || "",
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState({ id: "local", public_settings: {} });

  const applySession = useCallback(async (session) => {
    if (!session?.user) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return null;
    }

    const appUser = await buildAppUser(session.user);
    setUser(appUser);
    setIsAuthenticated(true);
    setIsLoadingAuth(false);
    setAuthChecked(true);
    return appUser;
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setIsLoadingAuth(true);
      setAuthError(null);
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;
      if (error) {
        setAuthError({ type: "unknown", message: error.message });
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return;
      }
      await applySession(data.session);
    };

    init();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await applySession(session);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [applySession]);

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    const { data } = await supabase.auth.getSession();
    return applySession(data.session);
  };

  const checkAppState = async () => {
    setIsLoadingPublicSettings(false);
    await checkUserAuth();
  };

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      window.location.href = "/login";
    }
  };

  const navigateToLogin = () => {
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
