import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { Search, X, CalendarDays, Heart, Bookmark, UserCog, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import moment from "moment";
import AuthPromptModal from "@/components/shared/AuthPromptModal";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { ACTIVITY_CATEGORIES } from "@/lib/activityCategories";
import { Checkbox } from "@/components/ui/checkbox";
import { DEFAULT_RADIUS_MILES, RADIUS_OPTIONS, normalizeRadiusMiles } from "@/lib/locationDefaults";

const SORT_OPTIONS = [
  { value: "posted", label: "Sort By Date Posted" },
  { value: "start", label: "Sort By Activity Date" },
  { value: "registration", label: "Sort By Registration Date" },
];

const snapshotMyFilters = (values) => ({
  search: values.search || "",
  category: values.category || "all",
  sortBy: values.sortBy || "posted",
  zipCode: values.zipCode || "",
  radiusMiles: Number(values.radiusMiles) || 15,
  ageMin: values.ageMin || "",
  ageMax: values.ageMax || "",
  priceMin: values.priceMin || "",
  priceMax: values.priceMax || "",
  freeOnly: Boolean(values.freeOnly),
});

const myFiltersMatch = (a, b) => (
  a
  && b
  && a.search === b.search
  && a.category === b.category
  && a.sortBy === b.sortBy
  && a.zipCode === b.zipCode
  && Number(a.radiusMiles) === Number(b.radiusMiles)
  && a.ageMin === b.ageMin
  && a.ageMax === b.ageMax
  && a.priceMin === b.priceMin
  && a.priceMax === b.priceMax
  && Boolean(a.freeOnly) === Boolean(b.freeOnly)
);

export default function EventFilters({ filters, onFiltersChange, detectedZip, user, defaultZip, defaultRadius, expanded, onExpandedChange }) {
  const [localSearch, setLocalSearch] = useState(filters.search || "");
  const [authPrompt, setAuthPrompt] = useState(false);
  const [loadingSavedFilters, setLoadingSavedFilters] = useState(false);
  const [savedFiltersApplied, setSavedFiltersApplied] = useState(false);
  const [appliedSnapshot, setAppliedSnapshot] = useState(null);
  const [preApplySnapshot, setPreApplySnapshot] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange({ ...filters, search: localSearch });
    }, 400);
    return () => clearTimeout(timer);
  }, [localSearch]);

  // If My Filters is applied but the user changes any of those fields, turn the button off
  useEffect(() => {
    if (!appliedSnapshot || !savedFiltersApplied) return;
    const current = snapshotMyFilters({ ...filters, search: localSearch });
    if (!myFiltersMatch(appliedSnapshot, current)) {
      setSavedFiltersApplied(false);
      setAppliedSnapshot(null);
      setPreApplySnapshot(null);
    }
  }, [filters, localSearch, appliedSnapshot, savedFiltersApplied]);

  const updateFilter = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearMyFiltersApplied = () => {
    setSavedFiltersApplied(false);
    setAppliedSnapshot(null);
    setPreApplySnapshot(null);
  };

  const clearFilters = () => {
    setLocalSearch("");
    onFiltersChange({
      ...filters,
      search: "",
      category: "all",
      sortBy: "posted",
      zipCode: defaultZip || "",
      radiusMiles: normalizeRadiusMiles(defaultRadius, DEFAULT_RADIUS_MILES),
      ageMin: "",
      ageMax: "",
      priceMin: "",
      priceMax: "",
      freeOnly: false,
      dateFrom: moment().startOf("day").toDate(),
      dateTo: moment().add(120, "days").startOf("day").toDate(),
      savedOnly: false,
      favOrgsOnly: false,
    });
    clearMyFiltersApplied();
  };

  const toggleSavedOnly = () => {
    if (!user) { setAuthPrompt(true); return; }
    const next = !filters.savedOnly;
    clearMyFiltersApplied();
    onFiltersChange({
      ...filters,
      savedOnly: next,
      favOrgsOnly: next ? false : filters.favOrgsOnly,
    });
  };

  const toggleFavOrgsOnly = () => {
    if (!user) { setAuthPrompt(true); return; }
    const next = !filters.favOrgsOnly;
    clearMyFiltersApplied();
    onFiltersChange({
      ...filters,
      favOrgsOnly: next,
      savedOnly: next ? false : filters.savedOnly,
    });
  };

  const toggleMyFilters = async () => {
    if (!user) { setAuthPrompt(true); return; }

    // Second click: turn off and restore filters from before My Filters was applied
    if (savedFiltersApplied) {
      if (preApplySnapshot) {
        setLocalSearch(preApplySnapshot.search || "");
        onFiltersChange({
          ...filters,
          ...preApplySnapshot,
          savedOnly: false,
          favOrgsOnly: false,
        });
      }
      clearMyFiltersApplied();
      return;
    }

    setLoadingSavedFilters(true);
    try {
      const { data, error } = await supabase
        .from("saved_filters")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast({
          title: "No Saved Filters Yet",
          description: "Save your defaults under Account → My Filters.",
        });
      } else {
        setPreApplySnapshot(snapshotMyFilters({ ...filters, search: localSearch }));
        const freeOnly = Boolean(data.free_only);
        const next = {
          search: data.search || "",
          category: data.category || "all",
          sortBy: data.sort_by || "posted",
          zipCode: data.zip_code || filters.zipCode || "",
          radiusMiles: Number(data.radius_miles) || 15,
          ageMin: data.age_min != null ? String(data.age_min) : "",
          ageMax: data.age_max != null ? String(data.age_max) : "",
          priceMin: freeOnly ? "" : (data.price_min != null ? String(data.price_min) : ""),
          priceMax: freeOnly ? "" : (data.price_max != null ? String(data.price_max) : ""),
          freeOnly,
          savedOnly: false,
          favOrgsOnly: false,
        };
        setLocalSearch(next.search);
        onFiltersChange({ ...filters, ...next });
        const snap = snapshotMyFilters(next);
        setAppliedSnapshot(snap);
        setSavedFiltersApplied(true);
        toast({ title: "Saved Filters Applied" });
      }
    } catch (err) {
      toast({
        title: "Could Not Load Saved Filters",
        description: err.message,
        variant: "destructive",
      });
    }
    setLoadingSavedFilters(false);
  };

  const hasActiveFilters = filters.category !== "all" || filters.zipCode || filters.ageMin || filters.ageMax || filters.dateFrom || filters.freeOnly;

  return (
    <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[260px] text-xs">
                Matches any word you enter (not the full phrase) anywhere in an activity&apos;s title, description, keywords, organizer name, or city. Punctuation is ignored, so &quot;hockey,&quot; and &quot;hockey&quot; match the same.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Input
            placeholder="Search events, activities, keywords..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.category || "all"} onValueChange={(v) => onFiltersChange({ ...filters, category: v })}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-[160px] rounded-xl text-sm">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {ACTIVITY_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Mobile: keep From / to / To on one row. Desktop: dissolve into parent flex-wrap. */}
        <div className="flex items-center gap-2 w-full sm:contents">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="rounded-xl text-sm font-normal flex-1 sm:flex-none sm:min-w-[130px]">
                <CalendarDays className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
                <span className="truncate">{filters.dateFrom ? moment(filters.dateFrom).format("MMM D, YYYY") : "From Date"}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-xl">
              <Calendar mode="single" selected={filters.dateFrom} onSelect={(d) => onFiltersChange({ ...filters, dateFrom: d, dateTo: filters.dateTo && d && moment(filters.dateTo).isBefore(moment(d)) ? d : filters.dateTo })} />
            </PopoverContent>
          </Popover>
          <span className="text-sm text-muted-foreground self-center shrink-0 sm:-mx-2">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="rounded-xl text-sm font-normal flex-1 sm:flex-none sm:min-w-[130px]">
                <CalendarDays className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
                <span className="truncate">{filters.dateTo ? moment(filters.dateTo).format("MMM D, YYYY") : "To Date"}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-xl">
              <Calendar mode="single" selected={filters.dateTo} onSelect={(d) => updateFilter("dateTo", d)} disabled={filters.dateFrom ? { before: filters.dateFrom } : undefined} />
            </PopoverContent>
          </Popover>
        </div>

        <Select value={filters.sortBy || "posted"} onValueChange={(v) => updateFilter("sortBy", v)}>
          <SelectTrigger className="w-auto min-w-[190px] rounded-xl text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={filters.savedOnly ? "secondary" : "outline"}
          size="icon"
          className={`rounded-xl shrink-0 ${filters.savedOnly ? "text-mint-500 border-mint-200 bg-mint-50 hover:bg-mint-100" : ""} ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={toggleSavedOnly}
          title="Filter to only show your Saved Activities. Manage them in My Account → Saved Activities."
        >
          <Bookmark className={`w-4 h-4 ${filters.savedOnly ? "fill-mint-500 text-mint-500" : ""}`} />
        </Button>
        <Button
          variant={filters.favOrgsOnly ? "secondary" : "outline"}
          size="icon"
          className={`rounded-xl shrink-0 ${filters.favOrgsOnly ? "text-red-500 border-red-200 bg-red-50 hover:bg-red-100" : ""} ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={toggleFavOrgsOnly}
          title="Filter to only show your favorite Organizers. Manage them in My Account → Fav Organizers."
        >
          <Heart className={`w-4 h-4 ${filters.favOrgsOnly ? "fill-red-500 text-red-500" : ""}`} />
        </Button>
        <Button
          variant={savedFiltersApplied ? "secondary" : "outline"}
          size="icon"
          className={`rounded-xl shrink-0 ${savedFiltersApplied ? "text-mint-500 border-mint-200 bg-mint-50 hover:bg-mint-100" : ""} ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={toggleMyFilters}
          disabled={loadingSavedFilters}
          title={
            savedFiltersApplied
              ? "Clear your saved filter preferences and restore the previous filters."
              : "Apply the filter preferences you saved. Manage them in My Account → My Filters. Click again to clear."
          }
        >
          <UserCog className={`w-4 h-4 ${savedFiltersApplied ? "text-mint-500" : ""}`} />
        </Button>
        <AuthPromptModal open={authPrompt} onOpenChange={setAuthPrompt} message="Sign in to filter activities by your saved events, favorite organizers, and saved filter preferences." />
        <div className="flex items-center gap-0.5 ml-auto">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground rounded-xl gap-1" onClick={() => onExpandedChange(!expanded)}>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Hide Extra Filters..." : "Show More Filters..."}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground rounded-xl gap-1" onClick={clearFilters}>
              <X className="w-3 h-3" /> Clear
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={`text-xs text-muted-foreground rounded-xl gap-1 ${helpOpen ? "bg-muted/60" : ""}`}
            onClick={() => setHelpOpen((v) => !v)}
            aria-expanded={helpOpen}
          >
            <HelpCircle className="w-3 h-3" /> Help
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border animate-settle">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center">
              Zip Code
            </label>
            <div className="flex gap-2">
              <Input placeholder={detectedZip || "e.g. 90210"} value={filters.zipCode || ""} onChange={(e) => updateFilter("zipCode", e.target.value)}
                className="rounded-xl text-sm" maxLength={5} />
              <select
                value={filters.radiusMiles || 15}
                onChange={(e) => updateFilter("radiusMiles", Number(e.target.value))}
                className="rounded-xl text-sm border border-input bg-transparent px-3 py-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {RADIUS_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d} mi</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center">
              Age Range
            </label>
            <div className="flex gap-2">
              <Input type="number" placeholder="Min" value={filters.ageMin || ""} onChange={(e) => updateFilter("ageMin", e.target.value)}
                className="rounded-xl text-sm" min={0} max={18} />
              <span className="text-sm text-muted-foreground self-center -mx-2">to</span>
              <Input type="number" placeholder="Max" value={filters.ageMax || ""} onChange={(e) => updateFilter("ageMax", e.target.value)}
                className="rounded-xl text-sm" min={0} max={18} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center">
              Price Range
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={filters.priceMin || ""}
                onChange={(e) => updateFilter("priceMin", e.target.value)}
                className="rounded-xl text-sm"
                min={0}
                disabled={filters.freeOnly}
              />
              <span className="text-sm text-muted-foreground self-center -mx-2">to</span>
              <Input
                type="number"
                placeholder="Max"
                value={filters.priceMax || ""}
                onChange={(e) => updateFilter("priceMax", e.target.value)}
                className="rounded-xl text-sm"
                min={0}
                disabled={filters.freeOnly}
              />
            </div>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 h-9 text-sm cursor-pointer">
              <Checkbox
                checked={Boolean(filters.freeOnly)}
                onCheckedChange={(v) => onFiltersChange({
                  ...filters,
                  freeOnly: Boolean(v),
                  priceMin: v ? "" : filters.priceMin,
                  priceMax: v ? "" : filters.priceMax,
                })}
              />
              <span className="font-medium">Free</span>
            </label>
          </div>
        </div>
      )}

      {helpOpen && (
        <div className="pt-3 border-t border-border animate-settle space-y-3 text-xs text-muted-foreground">
          <div>
            <p className="font-medium text-foreground text-xs mb-1">How Filters Combine</p>
            <p>
              Most filters work together … an Activity must match EVERY option you set (category and age and zip, and so on).
              Search is the exception — if you type more than one word, an Activity matches when any of those words are included
              in the Activity (title, description, keywords, organizer name, and city).
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground text-xs mb-1">Fewer Results With More Filters</p>
            <p>
              Each extra filter you turn on can shrink the result. If results look empty, clear a filter or two and try again.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground text-xs mb-1">Special Filters</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-input bg-background">
                  <Bookmark className="h-3 w-3" />
                </span>
                <p><span className="font-medium text-foreground">Saved Activities:</span> Filter to only show your Saved Activities. Manage them in My Account → Saved Activities.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-input bg-background">
                  <Heart className="h-3 w-3" />
                </span>
                <p><span className="font-medium text-foreground">Fav Organizers:</span> Filter to only show your favorite Organizers. Manage them in My Account → Fav Organizers.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-input bg-background">
                  <UserCog className="h-3 w-3" />
                </span>
                <p><span className="font-medium text-foreground">My Filters:</span> Apply the filter preferences you saved. Click again to clear and restore your previous filters. Manage them in My Account → My Filters.</p>
              </div>
            </div>
          </div>
          <div>
            <p className="font-medium text-foreground text-xs mb-1">Saved For This Visit</p>
            <p>
              Your filter choices stay for the rest of this browser session. They reset when the session ends, or when you clear them.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
