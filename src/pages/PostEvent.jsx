import React, { useState, useEffect } from "react";
import { useOutletContext, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import HelpTip from "@/components/shared/HelpTip";
import useBetaConfig, { isZipAllowed } from "@/lib/useBetaConfig"; // BETA MODE — remove with useBetaConfig.js
import TimeInput from "@/components/shared/TimeInput";
import { ArrowLeft, Upload, Loader2, Save, ShieldCheck, Users, Plus, X, AlertTriangle, HelpCircle } from "lucide-react";

const CATEGORIES = [
  { value: "camp", label: "Camp" },
  { value: "class", label: "Class" },
  { value: "event", label: "Event" },
  { value: "sport", label: "Sport" },
  { value: "general_interest", label: "General Interest" },
];

const SUBCATEGORIES = {
  camp: ["Academic", "Art", "Coding/Tech", "Dance", "Music", "Nature/Outdoors", "Science", "Sports", "Theater", "Other"],
  class: ["Art", "Coding/Tech", "Cooking", "Dance", "Language", "Math/Tutoring", "Music", "Science", "Yoga/Fitness", "Other"],
  event: ["Community", "Competition", "Festival", "Fundraiser", "Performance", "Showcase", "Workshop", "Other"],
  sport: ["Baseball", "Basketball", "Cheerleading", "Dance", "Figure Skating", "Football", "Golf", "Gymnastics", "Hockey", "Lacrosse", "Martial Arts", "Soccer", "Softball", "Swimming", "Tennis", "Track & Field", "Volleyball", "Wrestling", "Other"],
  general_interest: ["Book Club", "Community Service", "Crafts", "Gaming", "Gardening", "Hiking", "Photography", "STEM", "Other"],
};

export default function PostEvent() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const duplicateId = searchParams.get("duplicate");
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [moderatingImage, setModeratingImage] = useState(false);
  const isOrganizer = user?.role === "organizer" || user?.role === "admin";
  const betaConfig = useBetaConfig(); // BETA MODE — remove with useBetaConfig.js

  const toTitleCase = (str) => str.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());

  const [form, setForm] = useState({
    title: "", description: "", classifications: [{ category: "", subcategory: "" }],
    age_min: "", age_max: "",
    start_date: "", end_date: "", time_start: "", time_end: "",
    registration_start: "", registration_end: "", registration_full: false,
    location_name: "", address: "", city: "", state: "", zip_code: "",
    cost: "", contact_name: "", contact_email: "", contact_phone: "", website: "",
    event_image: "", org_logo: "", org_name: "", org_description: "",
    keywords: "",
    posted_by_role: isOrganizer ? "organizer" : "community_member",
    rules_agreed: false,
    image_moderation_status: "approved",
    image_moderation_notes: "",
  });

  // Wait briefly for AppLayout to finish auth check before redirecting
  useEffect(() => {
    const timer = setTimeout(() => setAuthChecked(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!authChecked && !user) return; // wait for auth
    if (!user) { navigate("/login"); return; }
    if (!["community_member", "organizer", "admin"].includes(user.role)) {
      toast({ title: "You need a contributor account to post activities", variant: "destructive" });
      navigate("/account");
      return;
    }
    if (editId || duplicateId) loadExisting(editId || duplicateId);
    // Pre-fill org info for organizers from Organizer entity
    if (isOrganizer && !editId && !duplicateId) {
      loadOrganizerInfo(user.id);
    }
  }, [user, authChecked, editId, duplicateId]);

  const loadOrganizerInfo = async (userId) => {
    try {
      const { data: records, error } = await supabase
        .from("organizers")
        .select("*")
        .eq("user_id", userId)
        .limit(1);
      if (error) throw error;
      if (records?.length > 0) {
        const org = records[0];
        setForm((prev) => ({
          ...prev,
          org_name: org.org_name || "",
          org_description: org.org_description || "",
          org_logo: org.org_logo || "",
          contact_email: org.org_email || user?.email || "",
          contact_phone: "",
          website: org.org_website || "",
          posted_by_role: "organizer",
        }));
      }
    } catch {}
  };

  const loadExisting = async (eid) => {
    setLoading(true);
    try {
      const { data: e, error } = await supabase.from("events").select("*").eq("id", eid).single();
      if (error) throw error;
      const { id, created_at, updated_at, created_by_id, flag_count, flagged_by, status, save_count, category, subcategory, classifications, ...rest } = e;
      let rows = classifications && classifications.length > 0 ? classifications : [];
      if (rows.length === 0 && category?.length) {
        rows = category.map((cat, i) => ({ category: cat, subcategory: subcategory?.[i] || "" }));
      }
      if (rows.length === 0) rows = [{ category: "", subcategory: "" }];
      setForm({
        ...rest,
        classifications: rows,
        age_min: rest.age_min?.toString() || "",
        age_max: rest.age_max?.toString() || "",
        rules_agreed: false,
      });
    } catch {}
    setLoading(false);
  };

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleImageUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user?.id) {
      toast({ title: "Please sign in to upload images", variant: "destructive" });
      return;
    }
    const setUploading = field === "event_image" ? setUploadingImage : setUploadingLogo;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${field}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("event-media")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from("event-media").getPublicUrl(path);
      const fileUrl = publicData.publicUrl;
      updateField(field, fileUrl);

      if (field === "event_image") {
        // Image moderation will return later; approve by default for now.
        setForm((prev) => ({
          ...prev,
          image_moderation_status: "approved",
          image_moderation_notes: "",
          image_moderation_date: new Date().toISOString(),
        }));
      }
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    }
    setUploading(false);
  };

  const handleRequestManualImageReview = () => {
    setForm((prev) => ({ ...prev, image_moderation_status: "manual_review" }));
    toast({ title: "Manual review requested", description: "Our team will review your photo shortly. You can still submit your activity now." });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const missingFields = [];
    if (!form.title?.trim()) missingFields.push("Title");
    if (!form.description?.trim()) missingFields.push("Description");
    if (!form.classifications?.some((c) => c.category)) missingFields.push("Category");
    if (!form.start_date?.trim()) missingFields.push("Start Date");
    if (!form.city?.trim()) missingFields.push("City");
    if (!form.state?.trim()) missingFields.push("State");
    if (!form.zip_code?.trim()) missingFields.push("Zip Code");
    
    if (missingFields.length > 0) {
      toast({ title: `Missing: ${missingFields.join(", ")}`, variant: "destructive" });
      return;
    }
    if (!/^\d{5}$/.test(form.zip_code.trim())) {
      toast({ title: "Zip Code must be exactly 5 digits", variant: "destructive" });
      return;
    }
    if (!/^[A-Z]{2}$/.test(form.state.trim())) {
      toast({ title: "State must be exactly 2 letters", variant: "destructive" });
      return;
    }
    if (!form.rules_agreed) {
      toast({ title: "Please agree to Our Community Rules before continuing.", variant: "destructive" });
      return;
    }
    if (form.image_moderation_status === "declined" || form.image_moderation_status === "manual_review_declined") {
      toast({ title: "Your activity photo wasn't approved", description: "Please upload a different photo or request a manual review before submitting.", variant: "destructive" });
      return;
    }
    if (moderatingImage) {
      toast({ title: "Please wait for your photo review to finish before submitting.", variant: "destructive" });
      return;
    }
    if (form.end_date && form.end_date < form.start_date) {
      toast({ title: "End date can't be before the start date", variant: "destructive" });
      return;
    }
    if (form.registration_end && form.end_date && form.registration_end > form.end_date) {
      toast({ title: "Registration Closes date can't be after the activity end date", variant: "destructive" });
      return;
    }
    // BETA MODE — remove this block along with useBetaConfig.js
    if (!isZipAllowed(form.zip_code.trim(), betaConfig)) {
      toast({ title: `Zip code ${form.zip_code} isn't in our beta area yet`, description: "See the banner at the top of the site for available locations.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const validRows = form.classifications.filter((c) => c.category);
      const { classifications, rules_agreed, ...formRest } = form;
      const data = {
        ...formRest,
        classifications: validRows,
        category: [...new Set(validRows.map((c) => c.category))],
        subcategory: [...new Set(validRows.filter((c) => c.subcategory).map((c) => c.subcategory))],
        age_min: form.age_min ? Number(form.age_min) : null,
        age_max: form.age_max ? Number(form.age_max) : null,
        event_image: form.event_image || null,
        org_logo: form.org_logo || null,
        status: "active",
        created_by_id: user.id,
        posted_by_role: isOrganizer ? "organizer" : "community_member",
        poster_display_name: !isOrganizer
          ? (user?.first_name ? `${user.first_name}${user.last_name ? ` ${user.last_name[0]}.` : ""}` : "Community Member")
          : (form.org_name || null),
        updated_at: new Date().toISOString(),
      };

      // Remove UI-only / empty-string date fields that should be null
      ["end_date", "registration_start", "registration_end", "time_start", "time_end"].forEach((key) => {
        if (!data[key]) data[key] = null;
      });

      if (editId) {
        const { error } = await supabase.from("events").update(data).eq("id", editId);
        if (error) throw error;
        toast({ title: "Activity updated!", description: "Your changes are now live." });
        navigate(`/event/${editId}`);
      } else {
        const { data: created, error } = await supabase.from("events").insert(data).select("id").single();
        if (error) throw error;
        toast({ title: "Activity posted!", description: "Your activity is now live and visible to the community." });
        navigate(`/event/${created.id}`);
      }
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-mint-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <Button variant="ghost" className="mb-4 rounded-xl text-sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>

      <div className="bg-white rounded-2xl border border-border p-6">
        <h1 className="font-heading font-bold text-2xl mb-3">
          {editId ? "Edit Activity" : duplicateId ? "Duplicate Activity" : "Post an Activity"}
        </h1>

        {/* Role badge */}
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 mb-6 ${isOrganizer ? "bg-mint-50 border border-mint-200" : "bg-accent/50 border border-border"}`}>
          {isOrganizer ? (
            <ShieldCheck className="w-5 h-5 text-mint-500 shrink-0" />
          ) : (
            <Users className="w-5 h-5 text-muted-foreground shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold">{isOrganizer ? "Posting as an Organizer" : "Posting as a Community Member"}</p>
            <p className="text-xs text-muted-foreground">
              {isOrganizer
                ? "Your organization info, activity photo, and logo will appear on the listing."
                : "Photos and logos can only be added when an activity is submitted by an Organizer account."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic */}
          <div className="space-y-4">
            <h3 className="font-heading font-semibold text-sm text-muted-foreground border-b border-border pb-2">Activity Details</h3>
            <div>
              <Label className="text-sm">Title *</Label>
              <Input value={form.title} onChange={(e) => updateField("title", toTitleCase(e.target.value))} className="rounded-xl mt-1" placeholder="e.g. Summer Soccer Camp" />
            </div>
            <div>
              <Label className="text-sm">Description *</Label>
              <Textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} className="rounded-xl mt-1 min-h-[100px]" placeholder="Describe the event, what to expect, what to bring..." />
            </div>
            <div>
              <Label className="text-sm">Category & Subcategory * <span className="text-xs text-muted-foreground font-normal">(pick a category, then optionally a matching subcategory; you may add a second category if this activity fits more than one, e.g. a Hockey Camp is Sport/Hockey + Camp — up to 2 categories max)</span></Label>
              <div className="space-y-2 mt-1">
                {form.classifications.map((row, idx) => {
                  const subOptions = row.category ? SUBCATEGORIES[row.category] || [] : [];
                  return (
                    <div key={idx} className="flex flex-wrap items-center gap-2">
                      <Select
                        value={row.category}
                        onValueChange={(v) => {
                          const next = [...form.classifications];
                          next[idx] = { category: v, subcategory: "" };
                          updateField("classifications", next);
                        }}
                      >
                        <SelectTrigger className="w-auto min-w-[150px] rounded-xl text-sm">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={row.subcategory}
                        onValueChange={(v) => {
                          const next = [...form.classifications];
                          next[idx] = { ...next[idx], subcategory: v };
                          updateField("classifications", next);
                        }}
                        disabled={!row.category}
                      >
                        <SelectTrigger className="w-auto min-w-[160px] rounded-xl text-sm">
                          <SelectValue placeholder="Subcategory (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {subOptions.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.classifications.length > 1 && (
                        <button
                          type="button"
                          onClick={() => updateField("classifications", form.classifications.filter((_, i) => i !== idx))}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {form.classifications.length < 2 && (
                  <button
                    type="button"
                    onClick={() => updateField("classifications", [...form.classifications, { category: "", subcategory: "" }])}
                    className="inline-flex items-center gap-1 text-sm text-mint-600 hover:text-mint-700 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add another category
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Age Min</Label>
                <Input type="number" value={form.age_min} onChange={(e) => updateField("age_min", e.target.value)} className="rounded-xl mt-1" min={0} max={18} />
              </div>
              <div>
                <Label className="text-sm">Age Max</Label>
                <Input type="number" value={form.age_max} onChange={(e) => updateField("age_max", e.target.value)} className="rounded-xl mt-1" min={0} max={18} />
              </div>
            </div>
            <div>
              <Label className="text-sm">Cost / Pricing</Label>
              <Input value={form.cost} onChange={(e) => updateField("cost", e.target.value)} className="rounded-xl mt-1" placeholder="e.g. Free, $25/session, $150/week" />
            </div>
            <div>
              <Label className="text-sm">Keywords</Label>
              <Input value={form.keywords} onChange={(e) => updateField("keywords", e.target.value)} className="rounded-xl mt-1" placeholder="basketball, summer, outdoor..." />
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-4">
            <h3 className="font-heading font-semibold text-sm text-muted-foreground border-b border-border pb-2">Dates & Times</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label className="text-sm">Start Date *</Label><Input type="date" value={form.start_date} onChange={(e) => { const v = e.target.value; setForm((prev) => ({ ...prev, start_date: v, end_date: prev.end_date && prev.end_date < v ? v : prev.end_date })); }} className="rounded-xl mt-1" /></div>
              <div><Label className="text-sm">End Date</Label><Input type="date" value={form.end_date} onChange={(e) => updateField("end_date", e.target.value)} min={form.start_date || undefined} className="rounded-xl mt-1" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Start Time</Label>
                <TimeInput value={form.time_start} onChange={(v) => updateField("time_start", v)} />
              </div>
              <div>
                <Label className="text-sm">End Time</Label>
                <TimeInput value={form.time_end} onChange={(v) => updateField("time_end", v)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label className="text-sm">Registration Opens</Label><Input type="date" value={form.registration_start} onChange={(e) => updateField("registration_start", e.target.value)} className="rounded-xl mt-1" /></div>
              <div><Label className="text-sm">Registration Closes</Label><Input type="date" value={form.registration_end} onChange={(e) => updateField("registration_end", e.target.value)} max={form.end_date || undefined} className="rounded-xl mt-1" /></div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.registration_full} onCheckedChange={(v) => updateField("registration_full", v)} />
              <Label className="text-sm">Registration is Full <HelpTip text="Mark this when registration has reached capacity. The event will still be visible but marked as full." /></Label>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <h3 className="font-heading font-semibold text-sm text-muted-foreground border-b border-border pb-2">Location</h3>
            <div><Label className="text-sm">Venue / Location Name</Label><Input value={form.location_name} onChange={(e) => updateField("location_name", e.target.value)} className="rounded-xl mt-1" placeholder="e.g. City Park Recreation Center" /></div>
            <div><Label className="text-sm">Street Address</Label><Input value={form.address} onChange={(e) => updateField("address", e.target.value)} className="rounded-xl mt-1" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><Label className="text-sm">City *</Label><Input value={form.city} onChange={(e) => updateField("city", toTitleCase(e.target.value))} className="rounded-xl mt-1" /></div>
              <div><Label className="text-sm">State *</Label><Input value={form.state} onChange={(e) => updateField("state", e.target.value.toUpperCase().slice(0, 2))} className="rounded-xl mt-1" maxLength={2} /></div>
              <div><Label className="text-sm">Zip Code *</Label><Input value={form.zip_code} onChange={(e) => updateField("zip_code", e.target.value.replace(/\D/g, "").slice(0, 5))} className="rounded-xl mt-1" maxLength={5} inputMode="numeric" placeholder="5 digits" /></div>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="font-heading font-semibold text-sm text-muted-foreground border-b border-border pb-2">Contact & Cost</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label className="text-sm">Contact Name</Label><Input value={form.contact_name} onChange={(e) => updateField("contact_name", e.target.value)} className="rounded-xl mt-1" /></div>
              <div><Label className="text-sm">Contact Email</Label><Input type="email" value={form.contact_email} onChange={(e) => updateField("contact_email", e.target.value)} className="rounded-xl mt-1" /></div>
              {isOrganizer && (
                <div><Label className="text-sm">Contact Phone</Label><Input value={form.contact_phone} onChange={(e) => updateField("contact_phone", e.target.value)} className="rounded-xl mt-1" /></div>
              )}
              <div><Label className="text-sm">Website</Label><Input value={form.website} onChange={(e) => updateField("website", e.target.value)} className="rounded-xl mt-1" placeholder="https://" /></div>
            </div>
          </div>

          {/* Organizer extras */}
          {isOrganizer ? (
            <div className="space-y-4">
              <h3 className="font-heading font-semibold text-sm text-muted-foreground border-b border-border pb-2">Media</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                   <Label className="text-sm flex items-center gap-1">Activity Photo <HelpTip text="Recommended: JPG or WebP, 16:9 ratio (e.g. 1280×720px), under 2MB. Keep the main subject centered and avoid text overlays." /></Label>
                   <div className="mt-1">
                     {form.event_image && form.image_moderation_status !== "declined" && form.image_moderation_status !== "manual_review_declined" && (
                       <div className="w-full aspect-video rounded-xl mb-2 border border-border bg-muted/40 overflow-hidden flex items-center justify-center">
                         <img src={form.event_image} alt="Event" className="max-w-full max-h-full object-contain" onError={(e) => e.target.style.display = 'none'} />
                       </div>
                     )}
                    <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                      {(uploadingImage || moderatingImage) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      <span className="text-sm">{moderatingImage ? "Reviewing photo…" : form.event_image ? "Change Photo" : "Upload Photo"}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, "event_image")} />
                    </label>
                    {form.image_moderation_status === "declined" && (
                      <div className="mt-2 bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700 leading-relaxed">
                        <p className="font-semibold mb-1 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Photo not approved</p>
                        <p>{form.image_moderation_notes || "This photo doesn't meet our community guidelines."}</p>
                        <Button type="button" size="sm" variant="outline" className="rounded-xl h-7 text-xs mt-2 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={handleRequestManualImageReview}>
                          <HelpCircle className="w-3 h-3 mr-1" /> Request Manual Review
                        </Button>
                      </div>
                    )}
                    {form.image_moderation_status === "manual_review" && (
                      <p className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl p-3">
                        Your photo is queued for manual review by our team. Your activity will still be posted; the photo will appear once approved.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                   <Label className="text-sm flex items-center gap-1">Activity/Event Logo <HelpTip text="Recommended: PNG with transparent background, square (e.g. 500×500px), under 1MB. Will be displayed as a small circular thumbnail." /></Label>
                   <div className="mt-1">
                     {form.org_logo && <img src={form.org_logo} alt="Logo" className="w-16 h-16 object-cover rounded-full mb-2" onError={(e) => e.target.style.display = 'none'} />}
                    <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                      {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      <span className="text-sm">{form.org_logo ? "Change Logo" : "Upload Logo"}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, "org_logo")} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 bg-accent/50 border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">
              <Upload className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">Photos and logos</strong> can only be added when an activity is submitted by an Organizer account.
              </span>
            </div>
          )}

          <label className="flex items-start gap-3 cursor-pointer pt-4 border-t border-border">
            <input type="checkbox" className="mt-0.5 accent-mint-500" checked={form.rules_agreed} onChange={(e) => updateField("rules_agreed", e.target.checked)} />
            <span className="text-xs text-muted-foreground">
              I agree to <a href="/about#community-rules" target="_blank" className="text-mint-500 underline">Our Community Rules</a> and understand my activity may be removed if it doesn't comply.
            </span>
          </label>

          <div className="flex gap-3">
            <Button type="submit" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white flex-1 sm:flex-none" disabled={submitting || !form.rules_agreed || moderatingImage}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {editId ? "Update Activity" : "Submit"}
            </Button>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => navigate(-1)}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}