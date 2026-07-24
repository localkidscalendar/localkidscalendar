import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Bell } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function NotificationsTab({ user }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    frequency: "none",
    include_fav_organizers: true,
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
          setForm({
            frequency: data.frequency || "none",
            include_fav_organizers: data.include_fav_organizers !== false,
            include_other_activities: Boolean(data.include_other_activities),
            zip_code: data.zip_code || user.zip_code || "",
            radius_miles: Number(data.radius_miles) || 15,
            keywords: data.keywords || "",
            age_min: data.age_min != null ? String(data.age_min) : "",
            age_max: data.age_max != null ? String(data.age_max) : "",
          });
        } else {
          setForm((prev) => ({ ...prev, zip_code: user.zip_code || "" }));
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
        frequency: form.frequency,
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
      toast({ title: "Notification preferences saved" });
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
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
    <div className="space-y-5 max-w-lg">
      <div className="flex items-start gap-2">
        <Bell className="w-4 h-4 text-mint-600 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Choose how often you want activity digests. Admin can also trigger a manual send for testing.
        </p>
      </div>

      <div>
        <label className="text-sm font-medium block mb-1">Email frequency</label>
        <Select value={form.frequency} onValueChange={(v) => setForm((p) => ({ ...p, frequency: v }))}>
          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Off</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
        <div>
          <p className="text-sm font-medium">Favorite organizers</p>
          <p className="text-xs text-muted-foreground">Include activities from organizers you follow</p>
        </div>
        <Switch
          checked={form.include_fav_organizers}
          onCheckedChange={(v) => setForm((p) => ({ ...p, include_fav_organizers: v }))}
        />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
        <div>
          <p className="text-sm font-medium">Other matching activities</p>
          <p className="text-xs text-muted-foreground">Match by zip, keywords, and age below</p>
        </div>
        <Switch
          checked={form.include_other_activities}
          onCheckedChange={(v) => setForm((p) => ({ ...p, include_other_activities: v }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1">Zip code</label>
          <Input
            maxLength={5}
            value={form.zip_code}
            onChange={(e) => setForm((p) => ({ ...p, zip_code: e.target.value.replace(/\D/g, "") }))}
            className="rounded-xl"
            placeholder="89448"
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Radius (miles)</label>
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
          <label className="text-sm font-medium block mb-1">Age min</label>
          <Input
            type="number"
            value={form.age_min}
            onChange={(e) => setForm((p) => ({ ...p, age_min: e.target.value }))}
            className="rounded-xl"
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Age max</label>
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
        Save preferences
      </Button>
    </div>
  );
}
