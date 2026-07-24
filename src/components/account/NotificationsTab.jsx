import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function NotificationsTab({ user }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    frequency: "none",
    include_fav_organizers: false,
    include_other_activities: false,
    zip_code: "",
    radius_miles: 15,
    keywords: "",
    age_min: "",
    age_max: "",
  });

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("notification_preferences")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          // Only weekly digests are supported; coerce legacy daily/monthly → weekly.
          const freq = data.frequency === "weekly" ? "weekly" : "none";
          setForm({
            frequency: freq,
            include_fav_organizers: Boolean(data.include_fav_organizers),
            include_other_activities: Boolean(data.include_other_activities),
            zip_code: data.zip_code || user.zip_code || "",
            radius_miles: Number(data.radius_miles) || 15,
            keywords: data.keywords || "",
            age_min: data.age_min != null ? String(data.age_min) : "",
            age_max: data.age_max != null ? String(data.age_max) : "",
          });
        } else {
          setForm((prev) => ({
            ...prev,
            frequency: "none",
            include_fav_organizers: false,
            include_other_activities: false,
            zip_code: user.zip_code || "",
          }));
        }
      } catch (err) {
        toast({ title: "Could not load preferences", description: err.message, variant: "destructive" });
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const locations = form.zip_code?.trim()
        ? [{ zip_code: form.zip_code.trim(), radius_miles: Number(form.radius_miles) || 15 }]
        : [];
      const payload = {
        user_id: user.id,
        frequency: form.frequency === "weekly" ? "weekly" : "none",
        include_fav_organizers: form.include_fav_organizers,
        include_other_activities: form.include_other_activities,
        zip_code: form.zip_code?.trim() || null,
        radius_miles: Number(form.radius_miles) || 15,
        keywords: form.keywords?.trim() || null,
        age_min: form.age_min !== "" ? Number(form.age_min) : null,
        age_max: form.age_max !== "" ? Number(form.age_max) : null,
        locations,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("notification_preferences")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      toast({ title: "Notification Preferences Saved" });
    } catch (err) {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-mint-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Choose receive weekly activity digests emailed to you every Monday morning, based on new activities from your favorite organizers and/or other new activities that match your preferences.
      </p>

      <div className="space-y-5 max-w-lg">
      <div>
        <label className="text-sm font-medium block mb-1">Email Frequency</label>
        <Select value={form.frequency} onValueChange={(v) => setForm((p) => ({ ...p, frequency: v }))}>
          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Off</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
        <div>
          <p className="text-sm font-medium">Favorite Organizers</p>
          <p className="text-xs text-muted-foreground">Include new activities from your favorite organizers.</p>
        </div>
        <Switch
          checked={form.include_fav_organizers}
          onCheckedChange={(v) => setForm((p) => ({ ...p, include_fav_organizers: v }))}
        />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
        <div>
          <p className="text-sm font-medium">Activity Matches</p>
          <p className="text-xs text-muted-foreground">Include new activities that match by location, keywords, and age below.</p>
        </div>
        <Switch
          checked={form.include_other_activities}
          onCheckedChange={(v) => setForm((p) => ({ ...p, include_other_activities: v }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1">Zip Code</label>
          <Input
            maxLength={5}
            value={form.zip_code}
            onChange={(e) => setForm((p) => ({ ...p, zip_code: e.target.value.replace(/\D/g, "") }))}
            className="rounded-xl"
            placeholder="89448"
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Radius (Miles)</label>
          <Input
            type="number"
            min={1}
            max={100}
            value={form.radius_miles}
            onChange={(e) => setForm((p) => ({ ...p, radius_miles: e.target.value }))}
            className="rounded-xl"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium block mb-1">Keywords</label>
        <Input
          value={form.keywords}
          onChange={(e) => setForm((p) => ({ ...p, keywords: e.target.value }))}
          className="rounded-xl"
          placeholder="soccer, camp, art…"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1">Age Min</label>
          <Input
            type="number"
            value={form.age_min}
            onChange={(e) => setForm((p) => ({ ...p, age_min: e.target.value }))}
            className="rounded-xl"
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Age Max</label>
          <Input
            type="number"
            value={form.age_max}
            onChange={(e) => setForm((p) => ({ ...p, age_max: e.target.value }))}
            className="rounded-xl"
          />
        </div>
      </div>

      <Button
        className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Save Preferences
      </Button>
      </div>
    </div>
  );
}
