import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Menu, User, LogOut, Settings, Plus, Share2, BarChart3 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { isAccountSuspended } from "@/lib/authRoles";
import ShareModal from "@/components/shared/ShareModal";
import {
  countUnreadMessages,
  publishUnreadMessagesCount,
  UNREAD_MESSAGES_EVENT,
} from "@/lib/userMessages";

function UnreadBadge({ count, className = "" }) {
  if (!count) return null;
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-peach-100 text-peach-600 text-[10px] font-bold leading-none ${className}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function Navbar({ user, sessionUser = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = async () => {
    await logout(true);
  };

  const isContributor = user && ["community_member", "organizer", "admin"].includes(user.role);
  const isAdmin = user?.role === "admin" || user?.is_owner;
  const disabledSession = sessionUser?.role === "disabled" && !user;
  const suspendedSession = Boolean(!user && isAccountSuspended(sessionUser));
  const messageUserId = user?.id || (suspendedSession ? sessionUser?.id : null);

  useEffect(() => {
    if (!messageUserId) {
      setUnreadCount(0);
      return undefined;
    }

    let cancelled = false;

    const refresh = async () => {
      const { count } = await countUnreadMessages(messageUserId);
      if (!cancelled) {
        setUnreadCount(count);
        publishUnreadMessagesCount(count);
      }
    };

    refresh();

    const onUnreadEvent = (e) => {
      if (typeof e?.detail?.count === "number") {
        setUnreadCount(e.detail.count);
      } else {
        refresh();
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener(UNREAD_MESSAGES_EVENT, onUnreadEvent);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener(UNREAD_MESSAGES_EVENT, onUnreadEvent);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [messageUserId, location.pathname]);

  const handleSignInClick = () => {
    if (disabledSession) {
      navigate("/account-disabled");
      return;
    }
    if (suspendedSession) {
      navigate("/account?tab=messages");
      return;
    }
    navigate("/login");
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-0.5 shrink-0">
              <div className="bg-white h-16 flex items-center">
                <img
                  src="/logo.png"
                  alt="LocalKidsCalendar logo"
                  className="w-auto h-16 object-contain"
                />
              </div>
              <div className="hidden sm:block">
                <span className="font-heading font-bold text-lg text-foreground leading-tight">LocalKids</span>
                <span className="font-heading font-bold text-lg text-mint-500 leading-tight">Calendar</span>
              </div>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              <Link to="/" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors">
                Activities
              </Link>
              <Link to="/organizers" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors">
                Organizers
              </Link>
              <Link to="/supporters" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors">
                Supporters
              </Link>
              <Link to="/about" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors">
                About
              </Link>
              {isAdmin && (
                <Link to="/admin" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-full bg-mint-100 transition-colors">
                  Admin
                </Link>
              )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setShareOpen(true)}>
                <Share2 className="w-4 h-4" />
              </Button>

              {user ? (
                <>
                  {isContributor && (
                    <Button
                      size="sm"
                      className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white flex gap-1.5"
                      onClick={() => navigate("/post-event")}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Post Activity</span>
                      <span className="sm:hidden">Post</span>
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-xl relative">
                        <div className="w-8 h-8 rounded-full bg-mint-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-mint-500" />
                        </div>
                        <UnreadBadge count={unreadCount} className="absolute top-0 right-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 rounded-xl">
                      <div className="px-3 py-2 font-medium truncate">
                        {(() => {
                          const displayName = (user.first_name && user.last_name)
                            ? `${user.first_name} ${user.last_name}`
                            : user.org_name || (user.full_name && !user.full_name.includes('@') ? user.full_name : null);
                          return displayName ? <div className="text-sm font-semibold">{displayName}</div> : null;
                        })()}
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate("/account")} className="flex items-center">
                        <Settings className="w-4 h-4 mr-2 shrink-0" />
                        <span className="flex-1">My Account</span>
                        <UnreadBadge count={unreadCount} className="ml-2" />
                      </DropdownMenuItem>
                      {user?.is_advertiser && (
                        <DropdownMenuItem onClick={() => navigate("/ad-manager")}>
                          <BarChart3 className="w-4 h-4 mr-2" /> Ad Manager
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                        <LogOut className="w-4 h-4 mr-2" /> Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : suspendedSession ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs border-peach-200 text-peach-700 relative"
                    onClick={() => navigate("/account?tab=messages")}
                  >
                    My Messages
                    <UnreadBadge count={unreadCount} className="ml-1.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-xl text-destructive" onClick={handleLogout}>
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {disabledSession && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs border-red-200 text-red-600 hidden sm:flex"
                      onClick={() => navigate("/account-disabled")}
                    >
                      Account Status
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="rounded-xl" onClick={handleSignInClick}>
                    Sign In
                  </Button>
                  {!disabledSession && (
                    <Button size="sm" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={() => navigate("/register")}>
                      Join Free
                    </Button>
                  )}
                </div>
              )}

              {/* Mobile menu */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild className="md:hidden">
                  <Button variant="ghost" size="icon" className="rounded-xl">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72">
                  <div className="flex flex-col gap-2 mt-8">
                    <Link to="/" onClick={() => setMobileOpen(false)} className="px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted transition-colors">
                      Activities
                    </Link>
                    <Link to="/organizers" onClick={() => setMobileOpen(false)} className="px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted transition-colors">
                      Organizers
                    </Link>
                    <Link to="/supporters" onClick={() => setMobileOpen(false)} className="px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted transition-colors">
                      Supporters
                    </Link>
                    <Link to="/about" onClick={() => setMobileOpen(false)} className="px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted transition-colors">
                      About
                    </Link>
                    {isAdmin && (
                      <Link to="/admin" onClick={() => setMobileOpen(false)} className="px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted transition-colors">
                        Admin
                      </Link>
                    )}
                    {!user && suspendedSession && (
                      <Link to="/account?tab=messages" onClick={() => setMobileOpen(false)} className="px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted transition-colors text-peach-700">
                        My Messages
                      </Link>
                    )}
                    {!user && disabledSession && (
                      <Link to="/account-disabled" onClick={() => setMobileOpen(false)} className="px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted transition-colors text-red-600">
                        Account Status
                      </Link>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>

      <ShareModal open={shareOpen} onOpenChange={setShareOpen} url={window.location.origin} title="LocalKidsCalendar.com — Discover Kids Activities Near You" />
    </>
  );
}
