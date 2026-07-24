import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ACTIVITY_CATEGORIES } from "@/lib/activityCategories";

export default function SavedFiltersTab({ user }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    search: "",
    category: "all",
    sort_by: "posted",
    zip_code: "",
    radius_miles: 15,
    age_min: "",
    age_max: "",
    price_min: "",
    price_max: "",
    free_only: false,
  });

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("saved_filters")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          const freeOnly = Boolean(data.free_only);
          setForm({
            search: data.search || "",
            category: data.category || "all",
            sort_by: data.sort_by || "posted",
            zip_code: data.zip_code || "",
            radius_miles: Number(data.radius_miles) || 15,
            age_min: data.age_min != null ? String(data.age_min) : "",
            age_max: data.age_max != null ? String(data.age_max) : "",
            price_min: freeOnly ? "" : (data.price_min != null ? String(data.price_min) : ""),
            price_max: freeOnly ? "" : (data.price_max != null ? String(data.price_max) : ""),
            free_only: freeOnly,
          });
        }
      } catch (err) {
        toast({ title: "Could Not Load Saved Filters", description: err.message, variant: "destructive" });
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        search: form.search?.trim() || null,
        category: form.category || "all",
        subcategory: null,
        sort_by: form.sort_by || "posted",
        zip_code: form.zip_code?.trim() || null,
        radius_miles: Number(form.radius_miles) || 15,
        age_min: form.age_min !== "" ? Number(form.age_min) : null,
        age_max: form.age_max !== "" ? Number(form.age_max) : null,
        price_min: form.free_only || form.price_min === "" ? null : Number(form.price_min),
        price_max: form.free_only || form.price_max === "" ? null : Number(form.price_max),
        free_only: Boolean(form.free_only),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("saved_filters").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      toast({ title: "Saved Filters Updated" });
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
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Save your usual Home page filters. On Home, use the filters shortcut to apply them.
      </p>

      <div className="space-y-4 max-w-lg">
        <div>
          <label className="text-sm font-medium block mb-1">Keywords</label>
          <Input
            value={form.search}
            onChange={(e) => setForm((p) => ({ ...p, search: e.target.value }))}
            className="rounded-xl"
            placeholder="soccer, camp…"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Category</label>
          <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {ACTIVITY_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Sort By</label>
          <Select value={form.sort_by} onValueChange={(v) => setForm((p) => ({ ...p, sort_by: v }))}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="posted">Date Posted</SelectItem>
              <SelectItem value="start">Activity Date</SelectItem>
              <SelectItem value="registration">Registration Date</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
          <div>
            <p className="text-sm font-medium">Free</p>
            <p className="text-xs text-muted-foreground">Only show free activities. Disables Price Min / Max.</p>
          </div>
          <Switch
            checked={form.free_only}
            onCheckedChange={(v) => setForm((p) => ({
              ...p,
              free_only: v,
              price_min: v ? "" : p.price_min,
              price_max: v ? "" : p.price_max,
            }))}
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
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Radius (Miles)</label>
            <Input
              type="number"
              value={form.radius_miles}
              onChange={(e) => setForm((p) => ({ ...p, radius_miles: e.target.value }))}
              className="rounded-xl"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1">Age Min</label>
            <Input type="number" value={form.age_min} onChange={(e) => setForm((p) => ({ ...p, age_min: e.target.value }))} className="rounded-xl" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Age Max</label>
            <Input type="number" value={form.age_max} onChange={(e) => setForm((p) => ({ ...p, age_max: e.target.value }))} className="rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1">Price Min</label>
            <Input type="number" value={form.price_min} onChange={(e) => setForm((p) => ({ ...p, price_min: e.target.value }))} className="rounded-xl" disabled={form.free_only} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Price Max</label>
            <Input type="number" value={form.price_max} onChange={(e) => setForm((p) => ({ ...p, price_max: e.target.value }))} className="rounded-xl" disabled={form.free_only} />
          </div>
        </div>

        <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save Filters
        </Button>
      </div>
    </div>
  );
}
