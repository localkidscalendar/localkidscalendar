import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar, Menu, Search, User, LogOut, Settings, Plus, Share2, BarChart3 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import ShareModal from "@/components/shared/ShareModal";

export default function Navbar({ user }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const handleLogout = async () => {
    await logout(true);
  };

  const isContributor = user && ["community_member", "organizer", "admin"].includes(user.role);
  const isAdmin = user?.role === "admin" || user?.is_owner;

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-0.5 shrink-0">
              <div className="bg-white h-16 flex items-center">
                <img
                  src="/logo.svg"
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
                    <Button size="sm" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white hidden sm:flex gap-1.5" onClick={() => navigate("/post-event")}>
                      <Plus className="w-4 h-4" />
                      Post Activity
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-mint-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-mint-500" />
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl">
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
                      <DropdownMenuItem onClick={() => navigate("/account")}>
                        <Settings className="w-4 h-4 mr-2" /> My Account
                      </DropdownMenuItem>
                      {user?.is_advertiser && (
                        <DropdownMenuItem onClick={() => navigate("/ad-manager")}>
                          <BarChart3 className="w-4 h-4 mr-2" /> Ad Manager
                        </DropdownMenuItem>
                      )}
                      {isContributor && (
                        <DropdownMenuItem onClick={() => navigate("/post-event")} className="sm:hidden">
                          <Plus className="w-4 h-4 mr-2" /> Post Activity
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                        <LogOut className="w-4 h-4 mr-2" /> Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => navigate("/login")}>
                    Sign In
                  </Button>
                  <Button size="sm" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white hidden sm:flex" onClick={() => navigate("/register")}>
                    Join Free
                  </Button>
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
                    {user?.is_advertiser && (
                      <Link to="/ad-manager" onClick={() => setMobileOpen(false)} className="px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted transition-colors">
                        Ad Manager
                      </Link>
                    )}
                    {isAdmin && (
                      <Link to="/admin" onClick={() => setMobileOpen(false)} className="px-4 py-3 text-sm font-medium rounded-xl hover:bg-muted transition-colors">
                        Admin
                      </Link>
                    )}
                    {!user && (
                      <Button className="mt-4 rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={() => { setMobileOpen(false); navigate("/register"); }}>
                        Join Free
                      </Button>
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