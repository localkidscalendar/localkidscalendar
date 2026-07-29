import React from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import AccountDisabledView from "@/components/account/AccountDisabledView";
import { isAccountDisabled } from "@/lib/authRoles";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";

export default function AccountDisabled() {
  const { sessionUser } = useOutletContext();
  const { user: authUser, logout, authChecked, isLoadingAuth } = useAuth();
  const user = sessionUser || authUser;

  if (!authChecked || isLoadingAuth) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAccountDisabled(user)) {
    return <Navigate to="/account" replace />;
  }

  return <AccountDisabledView user={user} onLogout={logout} />;
}
