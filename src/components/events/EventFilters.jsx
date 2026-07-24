import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { Search, SlidersHorizontal, X, MapPin, CalendarDays, Heart, Bookmark, UserCog, ChevronDown, ChevronUp } from "lucide-react";
import moment from "moment";
import { cn } from "@/lib/utils";
import AuthPromptModal from "@/components/shared/AuthPromptModal";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";

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

const ACTIVE_STATUS_OPTIONS = [
  { value: "active", label: "Show Active" },
  { value: "inactive", label: "Show Inactive" },
];

const SORT_OPTIONS = [
  { value: "posted", label: "Sort by Date Posted" },
  { value: "start", label: "Sort by Activity Date" },
  { value: "registration", label: "Sort by Registration Date" },
];

export default function EventFilters({ filters, onFiltersChange, detectedZip, user, defaultZip, expanded, onExpandedChange }) {
  const [localSearch, setLocalSearch] = useState(filters.search || "");
  const [authPrompt, setAuthPrompt] = useState(false);
  const [loadingSavedFilters, setLoadingSavedFilters] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange({ ...filters, search: localSearch });
    }, 400);
    return () => clearTimeout(timer);
  }, [localSearch]);

  const updateFilter = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    setLocalSearch("");
    onFiltersChange({ ...filters, search: "", category: "all", subcategory: "", activeStatus: "active", sortBy: "posted", zipCode: defaultZip || "", radiusMiles: 15, ageMin: "", ageMax: "", priceMin: "", priceMax: "", dateFrom: moment().toDate(), dateTo: moment().add(120, "days").toDate(), savedOnly: false, favOrgsOnly: false });
  };

  const loadSavedFilters = async () => {
    if (!user) { setAuthPrompt(true); return; }
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
          title: "No saved filters yet",
          description: "Save your defaults under Account → My Filters.",
        });
      } else {
        setLocalSearch(data.search || "");
        onFiltersChange({
          ...filters,
          search: data.search || "",
          category: data.category || "all",
          subcategory: data.subcategory || "",
          sortBy: data.sort_by || "posted",
          zipCode: data.zip_code || filters.zipCode || "",
          radiusMiles: Number(data.radius_miles) || 15,
          ageMin: data.age_min != null ? String(data.age_min) : "",
          ageMax: data.age_max != null ? String(data.age_max) : "",
          priceMin: data.price_min != null ? String(data.price_min) : "",
          priceMax: data.price_max != null ? String(data.price_max) : "",
        });
        toast({ title: "Saved filters applied" });
      }
    } catch (err) {
      toast({
        title: "Could not load saved filters",
        description: err.message,
        variant: "destructive",
      });
    }
    setLoadingSavedFilters(false);
  };

  const subcategoryOptions = filters.category && filters.category !== "all" ? SUBCATEGORIES[filters.category] || [] : [];

  const hasActiveFilters = filters.category !== "all" || filters.subcategory || filters.zipCode || filters.ageMin || filters.ageMax || filters.dateFrom;

  return (
    <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
      {/* Search row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[260px] text-xs">
                Matches any word you enter (not the full phrase) anywhere in an activity's title, description, keywords, organizer name, or city. Punctuation is ignored, so "hockey," and "hockey" match the same.
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

      {/* Category + Date + Sort row */}
      <div className="flex flex-wrap gap-2">
        <Select value={filters.category || "all"} onValueChange={(v) => onFiltersChange({ ...filters, category: v, subcategory: "" })}>
          <SelectTrigger className="w-auto min-w-[130px] rounded-xl text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {subcategoryOptions.length > 0 && (
          <Select value={filters.subcategory || "all"} onValueChange={(v) => updateFilter("subcategory", v === "all" ? "" : v)}>
            <SelectTrigger className="w-auto min-w-[140px] rounded-xl text-sm">
              <SelectValue placeholder="All Subtypes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subtypes</SelectItem>
              {subcategoryOptions.map((sub) => (
                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {/* From Date */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="rounded-xl text-sm font-normal min-w-[130px]">
              <CalendarDays className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              {filters.dateFrom ? moment(filters.dateFrom).format("MMM D, YYYY") : "From Date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 rounded-xl">
            <Calendar mode="single" selected={filters.dateFrom} onSelect={(d) => onFiltersChange({ ...filters, dateFrom: d, dateTo: filters.dateTo && d && moment(filters.dateTo).isBefore(moment(d)) ? d : filters.dateTo })} />
          </PopoverContent>
        </Popover>
        <span className="text-sm text-muted-foreground self-center -mx-2">to</span>
        {/* To Date */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="rounded-xl text-sm font-normal min-w-[130px]">
              <CalendarDays className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              {filters.dateTo ? moment(filters.dateTo).format("MMM D, YYYY") : "To Date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 rounded-xl">
            <Calendar mode="single" selected={filters.dateTo} onSelect={(d) => updateFilter("dateTo", d)} disabled={filters.dateFrom ? { before: filters.dateFrom } : undefined} />
          </PopoverContent>
        </Popover>
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
          onClick={() => user ? updateFilter("savedOnly", !filters.savedOnly) : setAuthPrompt(true)}
          title={user ? "Filter to only show your saved activities. Manage them in My Account → My Saved Activities." : "Filter to only show your saved activities. Requires a registered, signed-in account."}
        >
          <Bookmark className={`w-4 h-4 ${filters.savedOnly ? "fill-mint-500 text-mint-500" : ""}`} />
        </Button>
        <Button
          variant={filters.favOrgsOnly ? "secondary" : "outline"}
          size="icon"
          className={`rounded-xl shrink-0 ${filters.favOrgsOnly ? "text-red-500 border-red-200 bg-red-50 hover:bg-red-100" : ""} ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={() => user ? updateFilter("favOrgsOnly", !filters.favOrgsOnly) : setAuthPrompt(true)}
          title={user ? "Filter to only show activities from your favorite organizers. Manage them in My Account → My Fav Organizers." : "Filter to only show activities from your favorite organizers. Requires a registered, signed-in account."}
        >
          <Heart className={`w-4 h-4 ${filters.favOrgsOnly ? "fill-red-500 text-red-500" : ""}`} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className={`rounded-xl shrink-0 ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={loadSavedFilters}
          disabled={loadingSavedFilters}
          title={user ? "Apply the filter preferences you saved. Manage them in My Account → My Filters." : "Apply the filter preferences you saved. Requires a registered, signed-in account."}
        >
          <UserCog className="w-4 h-4" />
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
        </div>
      </div>

      {/* Expanded filters */}
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
                {[5, 10, 15, 25, 50, 100].map((d) => (
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
              <Input type="number" placeholder="Min" value={filters.priceMin || ""} onChange={(e) => updateFilter("priceMin", e.target.value)}
                className="rounded-xl text-sm" min={0} />
              <span className="text-sm text-muted-foreground self-center -mx-2">to</span>
              <Input type="number" placeholder="Max" value={filters.priceMax || ""} onChange={(e) => updateFilter("priceMax", e.target.value)}
                className="rounded-xl text-sm" min={0} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}