import React, { useState, useEffect } from "react";
import { useOutletContext, useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Bookmark, Heart, CalendarDays, Bell, UserCog, Mail } from "lucide-react";
import LoadingState from "@/components/shared/LoadingState";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import AdminPanelShell from "@/components/admin/AdminPanelShell";
import ProfileTab from "@/components/account/ProfileTab";
import SavedActivitiesTab from "@/components/account/SavedActivitiesTab";
import SavedOrganizersTab from "@/components/account/SavedOrganizersTab";
import SavedFiltersTab from "@/components/account/SavedFiltersTab";
import MyPostsTab from "@/components/account/MyPostsTab";
import NotificationsTab from "@/components/account/NotificationsTab";
import MyMessagesTab from "@/components/account/MyMessagesTab";
import { countUnreadMessages, publishUnreadMessagesCount } from "@/lib/userMessages";
import { isAccountSuspended } from "@/lib/authRoles";

const VALID_TABS = new Set([
  "messages", "posts", "saved", "saved-organizers", "notifications", "saved-filters", "profile",
]);

export default function Account() {
  const { user, sessionUser, setUser, userLoading } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("messages");
  const [unreadCount, setUnreadCount] = useState(0);

  const suspendedOnly = Boolean(!user && isAccountSuspended(sessionUser));
  const accountUser = user || (suspendedOnly ? sessionUser : null);

  useEffect(() => {
    if (userLoading) return;
    if (!accountUser) navigate("/login");
  }, [accountUser, userLoading, navigate]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "flagged") {
      setActiveTab("messages");
      const next = new URLSearchParams(searchParams);
      next.delete("tab");
      setSearchParams(next, { replace: true });
      return;
    }
    if (suspendedOnly) {
      setActiveTab("messages");
      return;
    }
    if (tab && VALID_TABS.has(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams, suspendedOnly, setSearchParams]);

  useEffect(() => {
    if (!accountUser?.id) return;
    let cancelled = false;
    (async () => {
      const { count } = await countUnreadMessages(accountUser.id);
      if (!cancelled) {
        setUnreadCount(count);
        publishUnreadMessagesCount(count);
      }
    })();
    return () => { cancelled = true; };
  }, [accountUser?.id]);

  if (userLoading) {
    return <LoadingState text="Loading your account..." />;
  }

  if (!accountUser) return null;

  const isContributor = !suspendedOnly && ["community_member", "organizer", "admin"].includes(accountUser?.role);

  const handleTabChange = (tab) => {
    if (suspendedOnly && tab !== "messages") return;
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    if (tab === "messages") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="font-heading font-bold text-2xl">My Account</h1>
        <p className="text-sm text-muted-foreground">{accountUser.email}</p>
        {suspendedOnly && (
          <p className="mt-2 text-sm text-peach-700 bg-peach-50 border border-peach-200 rounded-xl px-3 py-2">
            Your account is suspended pending Admin review. You can still read My Messages. Other account actions are paused.
          </p>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="rounded-xl mb-4 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="messages" className="rounded-lg flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            Messages
            {unreadCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-peach-100 text-peach-600 text-[10px] font-bold leading-none">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
          {!suspendedOnly && isContributor && (
            <TabsTrigger value="posts" className="rounded-lg flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              My Activity Posts
            </TabsTrigger>
          )}
          {!suspendedOnly && (
            <>
              <TabsTrigger value="saved" className="rounded-lg flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5" />
                Saved Activities
              </TabsTrigger>
              <TabsTrigger value="saved-organizers" className="rounded-lg flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5" />
                Fav Organizers
              </TabsTrigger>
              <TabsTrigger value="notifications" className="rounded-lg flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                Email Notifications
              </TabsTrigger>
              <TabsTrigger value="saved-filters" className="rounded-lg flex items-center gap-1.5">
                <UserCog className="w-3.5 h-3.5" />
                Home Search Filters
              </TabsTrigger>
              <TabsTrigger value="profile" className="rounded-lg flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Profile
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="messages">
          <AdminSectionHeader title="Messages" icon={Mail} />
          <AdminPanelShell>
            <MyMessagesTab
              user={accountUser}
              onUnreadChange={(count) => {
                setUnreadCount(count);
                publishUnreadMessagesCount(count);
              }}
            />
          </AdminPanelShell>
        </TabsContent>

        {!suspendedOnly && isContributor && (
          <TabsContent value="posts">
            <AdminSectionHeader title="My Activity Posts" icon={CalendarDays} />
            <div className="bg-white rounded-2xl border border-border p-5">
              <MyPostsTab user={accountUser} />
            </div>
          </TabsContent>
        )}

        {!suspendedOnly && (
          <>
            <TabsContent value="saved">
              <AdminSectionHeader title="Saved Activities" icon={Bookmark} />
              <div className="bg-white rounded-2xl border border-border p-5">
                <SavedActivitiesTab user={accountUser} />
              </div>
            </TabsContent>

            <TabsContent value="saved-organizers">
              <AdminSectionHeader title="Fav Organizers" icon={Heart} />
              <div className="bg-white rounded-2xl border border-border p-5">
                <SavedOrganizersTab user={accountUser} />
              </div>
            </TabsContent>

            <TabsContent value="notifications">
              <AdminSectionHeader title="Email Notifications" icon={Bell} />
              <div className="bg-white rounded-2xl border border-border p-5">
                <NotificationsTab user={accountUser} />
              </div>
            </TabsContent>

            <TabsContent value="saved-filters">
              <AdminSectionHeader title="Home Search Filters" icon={UserCog} />
              <div className="bg-white rounded-2xl border border-border p-5">
                <SavedFiltersTab user={accountUser} />
              </div>
            </TabsContent>

            <TabsContent value="profile">
              <AdminSectionHeader title="Profile" icon={User} />
              <div className="bg-white rounded-2xl border border-border p-5">
                <ProfileTab user={accountUser} setUser={setUser} />
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
