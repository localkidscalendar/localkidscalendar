import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";
import ZipCodeRankingCard from "./ZipCodeRankingCard";
import ZipCodeSearchCard from "./ZipCodeSearchCard";

export default function AdminUserZipReportsSection() {
  const [loading, setLoading] = useState(true);
  const [userRows, setUserRows] = useState([]);
  const [organizerRows, setOrganizerRows] = useState([]);
  const [supporterRows, setSupporterRows] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, eventsRes, adsRes, waitlistRes] = await Promise.all([
        supabase.from("profiles").select("id, role, zip_code").limit(500),
        supabase.from("events").select("created_by_id, posted_by_role").limit(1000),
        supabase.from("banner_ads").select("zip_code").eq("status", "active").limit(500),
        supabase.from("ad_waitlist").select("zip_code").eq("status", "waiting").limit(500),
      ]);

      const users = usersRes.data || [];
      const events = eventsRes.data || [];
      const ads = adsRes.data || [];
      const waitlist = waitlistRes.data || [];

      // Active community members by zip, plus post counts for those members
      const userZipMap = {};
      const memberZipById = {};
      users.forEach((u) => {
        if (u.role !== "community_member" || !u.zip_code) return;
        if (!userZipMap[u.zip_code]) userZipMap[u.zip_code] = new Set();
        userZipMap[u.zip_code].add(u.id);
        memberZipById[u.id] = u.zip_code;
      });
      const memberPostsByZip = {};
      events.forEach((e) => {
        const zip = e.created_by_id && memberZipById[e.created_by_id];
        if (!zip) return;
        memberPostsByZip[zip] = (memberPostsByZip[zip] || 0) + 1;
      });
      setUserRows(
        Object.entries(userZipMap).map(([zip, set]) => ({
          zip,
          count: set.size,
          posts: memberPostsByZip[zip] || 0,
        }))
      );

      // Registered organizers by profile zip, plus post counts for those organizers
      const orgZipMap = {};
      const organizerZipById = {};
      users.forEach((u) => {
        if (u.role !== "organizer" || !u.zip_code) return;
        if (!orgZipMap[u.zip_code]) orgZipMap[u.zip_code] = new Set();
        orgZipMap[u.zip_code].add(u.id);
        organizerZipById[u.id] = u.zip_code;
      });
      const orgPostsByZip = {};
      events.forEach((e) => {
        const zip = e.created_by_id && organizerZipById[e.created_by_id];
        if (!zip) return;
        orgPostsByZip[zip] = (orgPostsByZip[zip] || 0) + 1;
      });
      setOrganizerRows(
        Object.entries(orgZipMap).map(([zip, set]) => ({
          zip,
          count: set.size,
          posts: orgPostsByZip[zip] || 0,
        }))
      );

      // Supporters (advertisers + waitlisted) by zip
      const supporterZipMap = {};
      ads.forEach((a) => {
        if (!a.zip_code) return;
        if (!supporterZipMap[a.zip_code]) supporterZipMap[a.zip_code] = { advertisers: 0, waitlisted: 0 };
        supporterZipMap[a.zip_code].advertisers += 1;
      });
      waitlist.forEach((w) => {
        if (!w.zip_code) return;
        if (!supporterZipMap[w.zip_code]) supporterZipMap[w.zip_code] = { advertisers: 0, waitlisted: 0 };
        supporterZipMap[w.zip_code].waitlisted += 1;
      });
      setSupporterRows(Object.entries(supporterZipMap).map(([zip, v]) => ({ zip, ...v })));
    } catch {
      setUserRows([]);
      setOrganizerRows([]);
      setSupporterRows([]);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-mint-500" />
      </div>
    );
  }

  // Combined view: CM + organizers for ranking; search also breaks out roles + supporters
  const allZipSet = new Set([
    ...userRows.map((r) => r.zip),
    ...organizerRows.map((r) => r.zip),
    ...supporterRows.map((r) => r.zip),
  ]);
  const userByZip = Object.fromEntries(userRows.map((r) => [r.zip, r.count || 0]));
  const userPostsByZip = Object.fromEntries(userRows.map((r) => [r.zip, r.posts || 0]));
  const orgByZip = Object.fromEntries(organizerRows.map((r) => [r.zip, r.count || 0]));
  const orgPostsByZip = Object.fromEntries(organizerRows.map((r) => [r.zip, r.posts || 0]));
  const supporterByZip = Object.fromEntries(
    supporterRows.map((r) => [r.zip, (r.advertisers || 0) + (r.waitlisted || 0)])
  );
  const allUserRows = [...allZipSet].map((zip) => {
    const communityMembers = userByZip[zip] || 0;
    const organizers = orgByZip[zip] || 0;
    return {
      zip,
      total: communityMembers + organizers,
      communityMembers,
      organizers,
      supporters: supporterByZip[zip] || 0,
      posts: (userPostsByZip[zip] || 0) + (orgPostsByZip[zip] || 0),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-heading font-semibold text-sm text-muted-foreground mb-2">All User Zip Codes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ZipCodeRankingCard
            title="Top 10 All User Zip Codes"
            rows={allUserRows}
            columns={[
              { key: "total", label: "Members + Organizers" },
              { key: "posts", label: "Posts" },
            ]}
          />
          <ZipCodeSearchCard
            title="Search All Users by Zip Code"
            rows={allUserRows}
            columns={[
              { key: "total", label: "Members + Organizers" },
              { key: "communityMembers", label: "Community Members" },
              { key: "organizers", label: "Organizers" },
              { key: "supporters", label: "Supporters" },
              { key: "posts", label: "Posts" },
            ]}
          />
        </div>
      </div>

      <div>
        <h3 className="font-heading font-semibold text-sm text-muted-foreground mb-2">Community Member Zip Codes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ZipCodeRankingCard
            title="Top 10 Community Member Zip Codes"
            rows={userRows}
            columns={[
              { key: "count", label: "Community Members" },
              { key: "posts", label: "Posts" },
            ]}
          />
          <ZipCodeSearchCard
            title="Search Community Members by Zip Code"
            rows={userRows}
            columns={[
              { key: "count", label: "Community Members" },
              { key: "posts", label: "Posts" },
            ]}
          />
        </div>
      </div>

      <div>
        <h3 className="font-heading font-semibold text-sm text-muted-foreground mb-2">Organizer Zip Codes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ZipCodeRankingCard
            title="Top 10 Organizer Zip Codes"
            rows={organizerRows}
            columns={[
              { key: "count", label: "Organizers" },
              { key: "posts", label: "Posts" },
            ]}
          />
          <ZipCodeSearchCard
            title="Search Organizers by Zip Code"
            rows={organizerRows}
            columns={[
              { key: "count", label: "Organizers" },
              { key: "posts", label: "Posts" },
            ]}
          />
        </div>
      </div>

      <div>
        <h3 className="font-heading font-semibold text-sm text-muted-foreground mb-2">Supporter Zip Codes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ZipCodeRankingCard
            title="Top 10 Supporter Zip Codes"
            rows={supporterRows}
            columns={[
              { key: "advertisers", label: "Advertisers" },
              { key: "waitlisted", label: "Waitlisted" },
            ]}
          />
          <ZipCodeSearchCard
            title="Search Supporters by Zip Code"
            rows={supporterRows}
            columns={[
              { key: "advertisers", label: "Advertisers" },
              { key: "waitlisted", label: "Waitlisted" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
