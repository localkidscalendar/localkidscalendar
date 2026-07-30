import React, { useState, useEffect, useRef } from "react";
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
import useBetaConfig, { isZipAllowed, betaZipBlockedCopy } from "@/lib/useBetaConfig"; // BETA MODE — remove with useBetaConfig.js
import TimeInput from "@/components/shared/TimeInput";
import HistoryBackLink from "@/components/shared/HistoryBackLink";
import { Upload, Loader2, Save, ShieldCheck, Users, AlertTriangle, HelpCircle } from "lucide-react";
import { processImageForUpload } from "@/lib/imageProcess";
import { ACTIVITY_CATEGORIES, normalizeCategoryList } from "@/lib/activityCategories";
import { Checkbox } from "@/components/ui/checkbox";
import { moderateEventImage } from "@/lib/moderateEventImage";
import { formatActivityTitle } from "@/lib/titleCase";

/** Fields that must change when posting from Duplicate (prevents near-identical spam). */
const DUPLICATE_SIGNIFICANT_FIELDS = [
  "title",
  "start_date",
  "end_date",
  "time_start",
  "time_end",
  "location_name",
  "age_min",
  "age_max",
  "address",
  "city",
  "state",
  "zip_code",
];

function significantSnapshot(form) {
  const snap = {};
  for (const key of DUPLICATE_SIGNIFICANT_FIELDS) {
    snap[key] = String(form?.[key] ?? "").trim();
  }
  return snap;
}

function significantSnapshotsEqual(a, b) {
  if (!a || !b) return false;
  return DUPLICATE_SIGNIFICANT_FIELDS.every((key) => a[key] === b[key]);
}

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
  const duplicateBaselineRef = useRef(null);

  const toTitleCase = (str) => str.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());

  const [form, setForm] = useState({
    title: "", description: "", categories: [],
    age_min: "", age_max: "",
    start_date: "", end_date: "", time_start: "", time_end: "",
    registration_start: "", registration_end: "", registration_full: false,
    location_name: "", address: "", city: "", state: "", zip_code: "",
    cost: "", is_free: false, contact_name: "", contact_email: "", contact_phone: "", website: "",
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
    if (editId || duplicateId) {
      loadExisting(editId || duplicateId, { trackDuplicateBaseline: Boolean(duplicateId) });
    } else {
      duplicateBaselineRef.current = null;
    }
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

  const loadExisting = async (eid, { trackDuplicateBaseline = false } = {}) => {
    setLoading(true);
    try {
      const { data: e, error } = await supabase.from("events").select("*").eq("id", eid).single();
      if (error) throw error;
      const { id, created_at, updated_at, created_by_id, flag_count, flagged_by, status, save_count, category, subcategory, classifications, ...rest } = e;
      const categories = normalizeCategoryList(
        (classifications || []).map((c) => c.category).filter(Boolean).concat(category || [])
      );
      const isFree = rest.is_free === true
        || /free/i.test(String(rest.cost || ""));
      const nextForm = {
        ...rest,
        categories,
        is_free: isFree,
        cost: isFree ? "" : (rest.cost || ""),
        age_min: rest.age_min?.toString() || "",
        age_max: rest.age_max?.toString() || "",
        rules_agreed: false,
      };
      setForm(nextForm);
      duplicateBaselineRef.current = trackDuplicateBaseline
        ? significantSnapshot(nextForm)
        : null;
    } catch {
      duplicateBaselineRef.current = null;
    }
    setLoading(false);
  };

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleImageUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    if (!user?.id) {
      toast({ title: "Please sign in to upload images", variant: "destructive" });
      return;
    }
    const setUploading = field === "event_image" ? setUploadingImage : setUploadingLogo;
    setUploading(true);
    try {
      const preset = field === "event_image" ? "activityPhoto" : "logo";
      const processed = await processImageForUpload(file, preset);
      const path = `${user.id}/${field}-${Date.now()}.${processed.file.name.split(".").pop() || "jpg"}`;
      const { error: uploadError } = await supabase.storage
        .from("event-media")
        .upload(path, processed.file, { upsert: false, contentType: processed.file.type });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from("event-media").getPublicUrl(path);
      const fileUrl = publicData.publicUrl;
      updateField(field, fileUrl);

      if (field === "event_image") {
        setUploading(false);
        setModeratingImage(true);
        try {
          const result = await moderateEventImage(fileUrl);
          setForm((prev) => ({
            ...prev,
            image_moderation_status: result.status,
            image_moderation_notes: result.reason || "",
            image_moderation_date: new Date().toISOString(),
          }));
          if (result.status === "declined") {
            toast({
              title: "Photo not approved",
              description: result.reason || "Please upload a different photo or request a manual review.",
              variant: "destructive",
            });
          }
        } catch (modErr) {
          toast({
            title: "Photo review unavailable",
            description: modErr.message || "Please try uploading again.",
            variant: "destructive",
          });
          setForm((prev) => ({
            ...prev,
            image_moderation_status: "declined",
            image_moderation_notes: "Automated review could not finish. Please retry or request a manual review.",
            image_moderation_date: new Date().toISOString(),
          }));
        } finally {
          setModeratingImage(false);
        }
        return;
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
    toast({
      title: "Manual review requested",
      description: "We'll review your photo soon. Watch My Messages in My Account for the decision. You can still submit your activity now.",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const missingFields = [];
    if (!form.title?.trim()) missingFields.push("Title");
    if (!form.description?.trim()) missingFields.push("Description");
    if (!form.categories?.length) missingFields.push("Category");
    if (!form.start_date?.trim()) missingFields.push("Start Date");
    if (!form.end_date?.trim()) missingFields.push("End Date");
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
    if (
      duplicateId
      && duplicateBaselineRef.current
      && significantSnapshotsEqual(significantSnapshot(form), duplicateBaselineRef.current)
    ) {
      toast({
        title: "Update the activity before posting",
        description:
          "Duplicated posts need a change to title, dates, times, venue, ages, or location (street, city, state, or zip). This keeps the calendar from filling with near-identical listings.",
        variant: "destructive",
      });
      return;
    }
    // BETA MODE — remove this block along with useBetaConfig.js
    if (!isZipAllowed(form.zip_code.trim(), betaConfig)) {
      const copy = betaZipBlockedCopy(form.zip_code.trim());
      toast({ title: copy.title, description: copy.description, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const categories = normalizeCategoryList(form.categories).slice(0, 3);
      const { categories: _cats, rules_agreed, ...formRest } = form;
      const data = {
        ...formRest,
        category: categories,
        subcategory: [],
        classifications: categories.map((c) => ({ category: c })),
        is_free: Boolean(form.is_free),
        cost: form.is_free ? "Free" : (form.cost || null),
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
      ["registration_start", "registration_end", "time_start", "time_end"].forEach((key) => {
        if (!data[key]) data[key] = null;
      });

      if (editId) {
        const { error } = await supabase.from("events").update(data).eq("id", editId);
        if (error) throw error;
        toast({ title: "Activity updated!", description: "Your changes are now live." });
        navigate(`/event/${editId}`, { state: { fromApp: true, backLabel: "Back" } });
      } else {
        const { data: created, error } = await supabase.from("events").insert(data).select("id").single();
        if (error) throw error;
        toast({ title: "Activity posted!", description: "Your activity is now live and visible to the community." });
        // Replace the filled form (and any ?duplicate=) with a clean Post page in history,
        // then open the new activity so Back returns to a blank form for another post.
        duplicateBaselineRef.current = null;
        navigate("/post-event", { replace: true });
        queueMicrotask(() => {
          navigate(`/event/${created.id}`, {
            state: {
              fromApp: true,
              backLabel: "Back to New Post Activity",
              returnTo: "/post-event",
            },
          });
        });
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
      <HistoryBackLink variant="button" />

      <div className="bg-white rounded-2xl border border-border p-6">
        <h1 className="font-heading font-bold text-2xl mb-3">
          {editId ? "Edit Activity" : duplicateId ? "Duplicate Activity" : "Post an Activity"}
        </h1>
        {duplicateId && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <p>
              Change at least one of: <strong>title, dates, times, venue, ages, or location</strong> (street, city, state, or zip) before submitting. Duplicate is for similar activities — not identical re-posts.
            </p>
          </div>
        )}

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
            <div>
              <Label className="text-sm">Title *</Label>
              <Input value={form.title} onChange={(e) => updateField("title", toTitleCase(e.target.value))} className="rounded-xl mt-1" placeholder="e.g. Summer Soccer Camp" />
            </div>
            <div>
              <Label className="text-sm">Description *</Label>
              <Textarea value={form.description} onChange={(e) => updateField("description", e.target.value)} className="rounded-xl mt-1 min-h-[100px]" placeholder="Describe the event, what to expect, what to bring..." />
            </div>
            <div>
              <Label className="text-sm">Category * <span className="text-xs text-muted-foreground font-normal">(select up to 3 — e.g. a sports camp can be Camps and Sports & Teams)</span></Label>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ACTIVITY_CATEGORIES.map((c) => {
                  const checked = form.categories.includes(c.value);
                  const atLimit = form.categories.length >= 3 && !checked;
                  return (
                    <label
                      key={c.value}
                      className={`flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm ${atLimit ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/40"}`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={atLimit}
                        onCheckedChange={(v) => {
                          setForm((prev) => {
                            if (v) {
                              if (prev.categories.includes(c.value) || prev.categories.length >= 3) return prev;
                              return { ...prev, categories: [...prev.categories, c.value] };
                            }
                            return { ...prev, categories: prev.categories.filter((x) => x !== c.value) };
                          });
                        }}
                      />
                      <span>{c.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="text-sm">Keywords</Label>
              <Input value={form.keywords} onChange={(e) => updateField("keywords", e.target.value)} className="rounded-xl mt-1" placeholder="basketball, summer, outdoor..." />
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Start Date *</Label>
                <Input
                  type="date"
                  required
                  value={form.start_date}
                  data-empty={!form.start_date ? "true" : "false"}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      start_date: v,
                      end_date: prev.end_date && prev.end_date < v ? v : prev.end_date,
                    }));
                  }}
                  className="rounded-xl mt-1"
                />
                {!form.start_date && (
                  <p className="text-[11px] text-muted-foreground mt-1">Required — select a start date</p>
                )}
              </div>
              <div>
                <Label className="text-sm">End Date *</Label>
                <Input
                  type="date"
                  required
                  value={form.end_date}
                  data-empty={!form.end_date ? "true" : "false"}
                  onChange={(e) => updateField("end_date", e.target.value)}
                  min={form.start_date || undefined}
                  className="rounded-xl mt-1"
                />
                {!form.end_date && (
                  <p className="text-[11px] text-muted-foreground mt-1">Required — select an end date</p>
                )}
              </div>
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
              <div>
                <Label className="text-sm">Registration Opens</Label>
                <Input
                  type="date"
                  value={form.registration_start}
                  data-empty={!form.registration_start ? "true" : "false"}
                  onChange={(e) => updateField("registration_start", e.target.value)}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Registration Closes</Label>
                <Input
                  type="date"
                  value={form.registration_end}
                  data-empty={!form.registration_end ? "true" : "false"}
                  onChange={(e) => updateField("registration_end", e.target.value)}
                  max={form.end_date || undefined}
                  className="rounded-xl mt-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.registration_full} onCheckedChange={(v) => updateField("registration_full", v)} />
              <Label className="text-sm">Registration is Full <HelpTip text="Mark this when registration has reached capacity. The event will still be visible but marked as full." /></Label>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <div><Label className="text-sm">Venue / Location Name</Label><Input value={form.location_name} onChange={(e) => updateField("location_name", e.target.value)} className="rounded-xl mt-1" placeholder="e.g. City Park Recreation Center" /></div>
            <div><Label className="text-sm">Street Address</Label><Input value={form.address} onChange={(e) => updateField("address", toTitleCase(e.target.value))} className="rounded-xl mt-1" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><Label className="text-sm">City *</Label><Input value={form.city} onChange={(e) => updateField("city", toTitleCase(e.target.value))} className="rounded-xl mt-1" /></div>
              <div><Label className="text-sm">State *</Label><Input value={form.state} onChange={(e) => updateField("state", e.target.value.toUpperCase().slice(0, 2))} className="rounded-xl mt-1" maxLength={2} /></div>
              <div><Label className="text-sm">Zip Code *</Label><Input value={form.zip_code} onChange={(e) => updateField("zip_code", e.target.value.replace(/\D/g, "").slice(0, 5))} className="rounded-xl mt-1" maxLength={5} inputMode="numeric" placeholder="5 digits" /></div>
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
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <Input
                  value={form.cost}
                  onChange={(e) => updateField("cost", e.target.value)}
                  className="rounded-xl w-40 sm:w-48"
                  placeholder="e.g. $25/session"
                  disabled={form.is_free}
                />
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={Boolean(form.is_free)}
                    onCheckedChange={(v) => setForm((prev) => ({
                      ...prev,
                      is_free: Boolean(v),
                      cost: v ? "" : prev.cost,
                    }))}
                  />
                  <span className="font-medium">Free</span>
                </label>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                   <Label className="text-sm flex items-center gap-1">Activity Photo <HelpTip text="Best fit: JPG or WebP, about 16:9 (e.g. 1280×720). Phone photos are OK — we resize and compress automatically before upload and review. Keep the main subject centered and avoid heavy text overlays." /></Label>
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
                        Your photo is queued for manual review. Your activity can still be posted; the photo appears once approved. Check <strong>My Account → My Messages</strong> for the decision.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                   <Label className="text-sm flex items-center gap-1">Activity/Event Logo <HelpTip text="Best fit: square PNG (e.g. 500×500) with a simple/clear mark. Large files are resized automatically. Shown as a small circular thumbnail." /></Label>
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