import React, { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Bookmark, Heart, CalendarDays, ShieldAlert, Bell, UserCog } from "lucide-react";
import LoadingState from "@/components/shared/LoadingState";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import ProfileTab from "@/components/account/ProfileTab";
import SavedActivitiesTab from "@/components/account/SavedActivitiesTab";
import SavedOrganizersTab from "@/components/account/SavedOrganizersTab";
import SavedFiltersTab from "@/components/account/SavedFiltersTab";
import MyPostsTab from "@/components/account/MyPostsTab";
import FlaggedContentTab from "@/components/account/FlaggedContentTab";
import NotificationsTab from "@/components/account/NotificationsTab";

export default function Account() {
  const { user, setUser, userLoading } = useOutletContext();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("saved");

  useEffect(() => {
    if (userLoading) return;
    if (!user) navigate("/login");
  }, [user, userLoading]);

  if (userLoading) {
    return <LoadingState text="Loading your account..." />;
  }

  if (!user) return null;

  const isContributor = ["community_member", "organizer", "admin"].includes(user?.role);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="font-heading font-bold text-2xl">My Account</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="rounded-xl mb-4">
          <TabsTrigger value="saved" className="rounded-lg flex items-center gap-1.5"><Bookmark className="w-3.5 h-3.5" />My Saved Activities</TabsTrigger>
          <TabsTrigger value="saved-organizers" className="rounded-lg flex items-center gap-1.5"><Heart className="w-3.5 h-3.5" />My Fav Organizers</TabsTrigger>
          <TabsTrigger value="saved-filters" className="rounded-lg flex items-center gap-1.5"><UserCog className="w-3.5 h-3.5" />My Filters</TabsTrigger>
          {isContributor && <TabsTrigger value="posts" className="rounded-lg flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />My Posts</TabsTrigger>}
          <TabsTrigger value="flagged" className="rounded-lg flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" />My Flagged Content</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-lg flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" />Notifications</TabsTrigger>
          <TabsTrigger value="profile" className="rounded-lg flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="saved">
          <AdminSectionHeader title="My Saved Activities" icon={Bookmark} />
          <div className="bg-white rounded-2xl border border-border p-5">
            <SavedActivitiesTab user={user} />
          </div>
        </TabsContent>

        <TabsContent value="saved-organizers">
          <AdminSectionHeader title="My Fav Organizers" icon={Heart} />
          <div className="bg-white rounded-2xl border border-border p-5">
            <SavedOrganizersTab user={user} />
          </div>
        </TabsContent>

        <TabsContent value="saved-filters">
          <AdminSectionHeader title="My Filters" icon={UserCog} />
          <div className="bg-white rounded-2xl border border-border p-5">
            <SavedFiltersTab user={user} />
          </div>
        </TabsContent>

        {isContributor && (
          <TabsContent value="posts">
            <AdminSectionHeader title="My Posts" icon={CalendarDays} />
            <div className="bg-white rounded-2xl border border-border p-5">
              <MyPostsTab user={user} />
            </div>
          </TabsContent>
        )}

        <TabsContent value="flagged">
          <AdminSectionHeader title="My Flagged Content" icon={ShieldAlert} />
          <div className="bg-white rounded-2xl border border-border p-5">
            <FlaggedContentTab user={user} />
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <AdminSectionHeader title="Notifications" icon={Bell} />
          <div className="bg-white rounded-2xl border border-border p-5">
            <NotificationsTab user={user} />
          </div>
        </TabsContent>

        <TabsContent value="profile">
          <AdminSectionHeader title="Profile" icon={User} />
          <div className="bg-white rounded-2xl border border-border p-5">
            <ProfileTab user={user} setUser={setUser} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}