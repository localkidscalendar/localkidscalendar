import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import HelpTip from "@/components/shared/HelpTip";
import { Bell, Save, Loader2, Plus, X } from "lucide-react";

export default function NotificationsTab({ user }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefId, setPrefId] = useState(null);
  const [form, setForm] = useState({
    frequency: "none",
    include_fav_organizers: true,
    include_other_activities: false,
    keywords: "",
    locations: [{ zip_code: "", radius_miles: 15 }],
    age_min: "",
    age_max: "",
  });

  useEffect(() => {
    if (user.role === "organizer") return;
    loadPrefs();
  }, [user]);

  const loadPrefs = async () => {
    setLoading(true);
    try {
      const prefs = await base44.entities.NotificationPreference.filter({}, "-created_date", 1);
      if (prefs.length > 0) {
        const p = prefs[0];
        setPrefId(p.id);
        setForm({
          frequency: p.frequency || "none",
          include_fav_organizers: p.include_fav_organizers !== false,
          include_other_activities: !!p.include_other_activities,
          keywords: p.keywords || "",
          locations: p.locations && p.locations.length > 0
            ? p.locations
            : [{ zip_code: p.zip_code || user?.zip_code || "", radius_miles: p.radius_miles || 15 }],
          age_min: p.age_min?.toString() || "",
          age_max: p.age_max?.toString() || "",
        });
      } else {
        setForm((prev) => ({ ...prev, locations: [{ zip_code: user?.zip_code || "", radius_miles: 15 }] }));
      }
    } catch {}
    setLoading(false);
  };

  const addLocation = () => {
    setForm((prev) => ({ ...prev, locations: [...prev.locations, { zip_code: "", radius_miles: 15 }] }));
  };

  const removeLocation = (index) => {
    setForm((prev) => ({ ...prev, locations: prev.locations.filter((_, i) => i !== index) }));
  };

  const updateLocation = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      locations: prev.locations.map((loc, i) => (i === index ? { ...loc, [field]: value } : loc)),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        ...form,
        locations: form.locations.filter((loc) => loc.zip_code && loc.zip_code.trim()),
        age_min: form.age_min ? Number(form.age_min) : null,
        age_max: form.age_max ? Number(form.age_max) : null,
      };
      if (prefId) {
        await base44.entities.NotificationPreference.update(prefId, data);
      } else {
        const created = await base44.entities.NotificationPreference.create(data);
        setPrefId(created.id);
      }
      toast({ title: "Notification preferences saved!" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
    setSaving(false);
  };

  if (user?.role === "organizer") {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
          <Bell className="w-6 h-6 text-muted-foreground" />
        </div>
        <h2 className="font-heading font-bold text-lg mb-2">Not Available for Organizers</h2>
        <p className="text-sm text-muted-foreground">Email notifications are only available for Community Member accounts. Organizer accounts do not receive activity alert emails. If you want to receive notifications for personal use, we recommend creating a separate Community Member account.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-mint-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Frequency */}
      <div className="rounded-xl border border-border p-4">
        <Label className="text-sm flex items-center">
          Frequency
          <HelpTip text="How often you'll receive email notifications with activities matching your preferences." />
        </Label>
        <Select value={form.frequency} onValueChange={(v) => setForm((prev) => ({ ...prev, frequency: v }))}>
          <SelectTrigger className="rounded-xl mt-1 max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="none">None (Turn off)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Fav Organizers */}
      <div className="rounded-xl border border-border p-4">
        <Label className="text-sm mb-2 block">Fav Organizers</Label>
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border cursor-pointer hover:bg-muted/50 transition-colors w-fit">
          <Checkbox
            checked={form.include_fav_organizers}
            onCheckedChange={(checked) => setForm((prev) => ({ ...prev, include_fav_organizers: !!checked }))}
          />
          <span className="text-sm">Include new activities from my Fav Organizers.</span>
        </label>
      </div>

      {/* Other Activities */}
      <div className="rounded-xl border border-border p-4 space-y-4">
        <div>
          <Label className="text-sm mb-2 block">Other Activities</Label>
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border cursor-pointer hover:bg-muted/50 transition-colors w-fit">
            <Checkbox
              checked={form.include_other_activities}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, include_other_activities: !!checked }))}
            />
            <span className="text-sm">Include new activities that match the criteria below.</span>
          </label>
        </div>

        <fieldset disabled={!form.include_other_activities} className="space-y-4 disabled:opacity-50">
          {/* Zip Codes & Radius */}
          <div>
            <Label className="text-sm">
              Zip Codes & Radius
              <span className="text-xs text-muted-foreground font-normal ml-1">(add multiple locations)</span>
            </Label>
            <div className="mt-1 space-y-2">
              {form.locations.map((loc, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input value={loc.zip_code} onChange={(e) => updateLocation(index, "zip_code", e.target.value)}
                    className="rounded-xl" maxLength={5} placeholder="Zip code" />
                  <Input type="number" value={loc.radius_miles} onChange={(e) => updateLocation(index, "radius_miles", Number(e.target.value))}
                    className="rounded-xl w-32" min={1} max={100} placeholder="Radius" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">miles</span>
                  {form.locations.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => removeLocation(index)}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="rounded-xl mt-2" onClick={addLocation}>
              <Plus className="w-4 h-4 mr-1" /> Add Another Zip Code
            </Button>
          </div>

          {/* Keywords */}
          <div>
            <Label className="text-sm">
              Keywords
              <span className="text-xs text-muted-foreground font-normal ml-1">(leave blank for any)</span>
            </Label>
            <Input value={form.keywords} onChange={(e) => setForm((prev) => ({ ...prev, keywords: e.target.value }))}
              className="rounded-xl mt-1" placeholder="e.g. soccer, art, music" />
          </div>

          {/* Age Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Age Min</Label>
              <Input type="number" value={form.age_min} onChange={(e) => setForm((prev) => ({ ...prev, age_min: e.target.value }))}
                className="rounded-xl mt-1" min={0} max={18} />
            </div>
            <div>
              <Label className="text-sm">Age Max</Label>
              <Input type="number" value={form.age_max} onChange={(e) => setForm((prev) => ({ ...prev, age_max: e.target.value }))}
                className="rounded-xl mt-1" min={0} max={18} />
            </div>
          </div>
        </fieldset>
      </div>

      <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Save Preferences
      </Button>
    </div>
  );
}