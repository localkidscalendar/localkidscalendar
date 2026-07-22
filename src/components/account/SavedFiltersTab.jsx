import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Save } from "lucide-react";
import LoadingState from "@/components/shared/LoadingState";
import HelpTip from "@/components/shared/HelpTip";

const CATEGORIES = [
  { value: "all", label: "All Types" },
  { value: "camp", label: "Camps" },
  { value: "class", label: "Classes" },
  { value: "event", label: "Events" },
  { value: "sport", label: "Sports" },
  { value: "general_interest", label: "General Interest" },
];

const SUBCATEGORIES = {
  camp: ["Academic", "Art", "Coding/Tech", "Dance", "Music", "Nature/Outdoors", "Science", "Sports", "Theater", "Other"],
  class: ["Art", "Coding/Tech", "Cooking", "Dance", "Language", "Math/Tutoring", "Music", "Science", "Yoga/Fitness", "Other"],
  event: ["Community", "Competition", "Festival", "Fundraiser", "Performance", "Showcase", "Workshop", "Other"],
  sport: ["Baseball", "Basketball", "Cheerleading", "Dance", "Figure Skating", "Football", "Golf", "Gymnastics", "Hockey", "Lacrosse", "Martial Arts", "Soccer", "Softball", "Swimming", "Tennis", "Track & Field", "Volleyball", "Wrestling", "Other"],
  general_interest: ["Book Club", "Community Service", "Crafts", "Gaming", "Gardening", "Hiking", "Photography", "STEM", "Other"],
};

const SORT_OPTIONS = [
  { value: "posted", label: "Sort by Date Posted" },
  { value: "start", label: "Sort by Activity Date" },
  { value: "registration", label: "Sort by Registration Date" },
];

const DEFAULTS = {
  search: "", category: "all", subcategory: "", sortBy: "posted",
  zipCode: "", radiusMiles: 15, ageMin: "", ageMax: "", priceMin: "", priceMax: "",
};

export default function SavedFiltersTab({ user }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState(null);
  const [form, setForm] = useState(DEFAULTS);

  useEffect(() => {
    (async () => {
      try {
        const existing = await base44.entities.SavedFilter.filter({ created_by_id: user.id });
        if (existing.length > 0) {
          const sf = existing[0];
          setRecordId(sf.id);
          setForm({ ...DEFAULTS, ...sf });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user.id]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const subcategoryOptions = form.category && form.category !== "all" ? SUBCATEGORIES[form.category] || [] : [];

  const handleSave = async () => {
    setSaving(true);
    try {
      const toNum = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
      const payload = {
        search: form.search,
        category: form.category,
        subcategory: form.subcategory,
        sortBy: form.sortBy,
        zipCode: form.zipCode,
        radiusMiles: toNum(form.radiusMiles) ?? 15,
        ageMin: toNum(form.ageMin),
        ageMax: toNum(form.ageMax),
        priceMin: toNum(form.priceMin),
        priceMax: toNum(form.priceMax),
      };
      if (recordId) {
        await base44.entities.SavedFilter.update(recordId, payload);
      } else {
        const created = await base44.entities.SavedFilter.create(payload);
        setRecordId(created.id);
      }
      toast({ title: "Filters saved", description: "Your preferred filters have been saved. Use the saved-filters button on the homepage to apply them anytime." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState text="Loading your saved filters..." />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Set your go-to filters here, then use the saved-filters button next to the search bar on the homepage to apply them in one click.
      </p>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center">
          Keywords
          <HelpTip text="Matches any word you enter (not the full phrase) anywhere in an activity's title, description, keywords, organizer name, or city. Punctuation is ignored, so &quot;hockey,&quot; and &quot;hockey&quot; match the same." />
        </label>
        <Input placeholder="Search events, activities, keywords..." value={form.search} onChange={(e) => update("search", e.target.value)} className="rounded-xl text-sm" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Activity Type</label>
          <Select value={form.category || "all"} onValueChange={(v) => setForm((prev) => ({ ...prev, category: v, subcategory: "" }))}>
            <SelectTrigger className="rounded-xl text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Subtype</label>
          <Select value={form.subcategory || "all"} onValueChange={(v) => update("subcategory", v === "all" ? "" : v)} disabled={subcategoryOptions.length === 0}>
            <SelectTrigger className="rounded-xl text-sm"><SelectValue placeholder="All Subtypes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subtypes</SelectItem>
              {subcategoryOptions.map((sub) => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Sort By</label>
        <Select value={form.sortBy || "posted"} onValueChange={(v) => update("sortBy", v)}>
          <SelectTrigger className="rounded-xl text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Zip Code</label>
          <Input placeholder="e.g. 90210" value={form.zipCode} onChange={(e) => update("zipCode", e.target.value.replace(/\D/g, "").slice(0, 5))} className="rounded-xl text-sm w-24" maxLength={5} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Distance</label>
          <select
            value={form.radiusMiles || 15}
            onChange={(e) => update("radiusMiles", Number(e.target.value))}
            className="rounded-xl text-sm border border-input bg-transparent px-3 py-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-9"
          >
            {[5, 10, 15, 25, 50, 100].map((d) => <option key={d} value={d}>{d} mi</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Age Range</label>
          <div className="flex gap-2">
            <Input type="number" placeholder="Min" value={form.ageMin} onChange={(e) => update("ageMin", e.target.value)} className="rounded-xl text-sm" min={0} max={18} />
            <span className="text-sm text-muted-foreground self-center -mx-2">to</span>
            <Input type="number" placeholder="Max" value={form.ageMax} onChange={(e) => update("ageMax", e.target.value)} className="rounded-xl text-sm" min={0} max={18} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Price Range</label>
          <div className="flex gap-2">
            <Input type="number" placeholder="Min" value={form.priceMin} onChange={(e) => update("priceMin", e.target.value)} className="rounded-xl text-sm" min={0} />
            <span className="text-sm text-muted-foreground self-center -mx-2">to</span>
            <Input type="number" placeholder="Max" value={form.priceMax} onChange={(e) => update("priceMax", e.target.value)} className="rounded-xl text-sm" min={0} />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-1.5">
        <Save className="w-4 h-4" />
        {saving ? "Saving..." : "Save My Filters"}
      </Button>
    </div>
  );
}