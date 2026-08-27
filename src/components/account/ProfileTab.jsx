import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import HelpTip from "@/components/shared/HelpTip";
import { Upload, Save, Loader2, KeyRound } from "lucide-react";
import { DEFAULT_RADIUS_MILES, RADIUS_OPTIONS, normalizeRadiusMiles } from "@/lib/locationDefaults";
import { processImageForUpload } from "@/lib/imageProcess";
import { toStrictTitleCase, formatActivityTitle } from "@/lib/titleCase";
import useBetaConfig, { isZipAllowed, betaZipsForDisplay } from "@/lib/useBetaConfig"; // BETA MODE

function namesFromMetadata(meta = {}) {
  const full = (meta.full_name || meta.name || "").trim();
  const first = (meta.first_name || meta.given_name || (full ? full.split(/\s+/)[0] : "") || "").trim();
  const last = (
    meta.last_name
    || meta.family_name
    || (full.includes(" ") ? full.split(/\s+/).slice(1).join(" ") : "")
    || ""
  ).trim();
  return { first, last };
}

function BetaZipOutsideNote({ betaConfig, zipCode }) {
  const zips = Array.isArray(betaConfig?.zip_codes) ? betaConfig.zip_codes : [];
  const zip = String(zipCode || "").trim();
  if (!betaConfig?.enabled || zips.length === 0 || zip.length !== 5) return null;
  if (isZipAllowed(zip, betaConfig)) return null;
  const list = betaZipsForDisplay(zips).join(", ");
  if (!list) return null;
  return (
    <p className="sm:col-span-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
      We are currently in limited areas (beta). Your zip isn’t in our beta test markets
      {" "}(<span className="font-semibold">{list}</span>).
      On Home you’ll need to adjust the zip filter to a beta area to see activities.
    </p>
  );
}

export default function ProfileTab({ user, setUser }) {
  const { toast } = useToast();
  const betaConfig = useBetaConfig(); // BETA MODE
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [organizerRecord, setOrganizerRecord] = useState(null);

  const isAdmin = user?.role === "admin" || user?.is_owner;
  const displayRole = isAdmin
    ? "admin"
    : (user.role === "user" || user.role === "community_member")
      ? "community_member"
      : (user.role || "community_member");

  const [form, setForm] = useState({
    first_name: "", last_name: "", zip_code: "", radius_miles: DEFAULT_RADIUS_MILES, role: "community_member",
    org_name: "", org_description: "", org_logo: "", org_website: "", org_email: "",
  });

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      let orgFields = {
        org_name: user.org_name || "",
        org_description: "",
        org_logo: "",
        org_website: "",
        org_email: "",
      };
      let metaNames = { first: "", last: "" };
      try {
        const { data: authData } = await supabase.auth.getUser();
        metaNames = namesFromMetadata(authData?.user?.user_metadata || {});
      } catch {}

      try {
        const { data: records, error } = await supabase
          .from("organizers")
          .select("*")
          .eq("user_id", user.id)
          .limit(1);
        if (error) throw error;
        if (records?.length > 0) {
          const rec = records[0];
          if (!cancelled) setOrganizerRecord(rec);
          orgFields = {
            org_name: rec.org_name || "",
            org_description: rec.org_description || "",
            org_logo: rec.org_logo || "",
            org_website: rec.org_website || "",
            org_email: rec.org_email || "",
          };
        }
      } catch {}

      if (!cancelled) {
        setForm({
          first_name: user.first_name || metaNames.first || "",
          last_name: user.last_name || metaNames.last || "",
          zip_code: user.zip_code || "",
          radius_miles: normalizeRadiusMiles(user.radius_miles),
          role: displayRole === "admin" ? "community_member" : displayRole,
          ...orgFields,
        });
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role, user?.first_name, user?.last_name, user?.zip_code, user?.radius_miles, user?.org_name, isAdmin, displayRole]);

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    setUploadingLogo(true);
    try {
      const processed = await processImageForUpload(file, "logo");
      const path = `${user.id}/org-logo-${Date.now()}.${processed.file.name.split(".").pop() || "png"}`;
      const { error: uploadError } = await supabase.storage
        .from("event-media")
        .upload(path, processed.file, { upsert: false, contentType: processed.file.type });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("event-media").getPublicUrl(path);
      updateField("org_logo", publicData.publicUrl);
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
    setUploadingLogo(false);
  };

  const handleResetPassword = async () => {
    setSendingReset(true);
    try {
      await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {}
    toast({
      title: "Password reset email sent",
      description: `Check ${user?.email} for a link to reset your password.`,
    });
    setSendingReset(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const isOrganizer = !isAdmin && form.role === "organizer";
      const nextFirst = isOrganizer ? "" : toStrictTitleCase(form.first_name.trim());
      const nextLast = isOrganizer ? "" : toStrictTitleCase(form.last_name.trim());
      const nextOrgName = isOrganizer ? formatActivityTitle(form.org_name.trim()) : "";

      if (isOrganizer) {
        if (!nextOrgName || !form.org_website || !form.org_email || !form.org_description) {
          toast({ title: "Please fill in all required organization fields", variant: "destructive" });
          setSaving(false);
          return;
        }
      } else if (!isAdmin) {
        if (!nextFirst || !nextLast) {
          toast({ title: "Please enter your first and last name", variant: "destructive" });
          setSaving(false);
          return;
        }
      }
      if (!form.zip_code || !/^\d{5}$/.test(form.zip_code.trim())) {
        toast({ title: "Zip Code must be exactly 5 digits", variant: "destructive" });
        setSaving(false);
        return;
      }

      // Role is locked after signup — never send role on Profile saves for non-admins.
      const profilePayload = {
        id: user.id,
        email: user.email,
        first_name: nextFirst,
        last_name: nextLast,
        zip_code: form.zip_code.trim(),
        radius_miles: normalizeRadiusMiles(form.radius_miles),
        updated_at: new Date().toISOString(),
      };
      const { error: profileError } = await supabase.from("profiles").upsert(profilePayload);
      if (profileError) throw profileError;

      if (isOrganizer) {
        const orgData = {
          user_id: user.id,
          org_name: nextOrgName,
          org_description: form.org_description.trim(),
          org_logo: form.org_logo || null,
          org_website: form.org_website.trim(),
          org_email: form.org_email.trim(),
          updated_at: new Date().toISOString(),
        };
        const { data: savedOrg, error: orgError } = await supabase
          .from("organizers")
          .upsert(orgData, { onConflict: "user_id" })
          .select("*")
          .single();
        if (orgError) throw orgError;
        setOrganizerRecord(savedOrg);
        setForm((prev) => ({
          ...prev,
          org_name: savedOrg.org_name || "",
          org_description: savedOrg.org_description || "",
          org_logo: savedOrg.org_logo || "",
          org_website: savedOrg.org_website || "",
          org_email: savedOrg.org_email || "",
        }));
      }

      const fullName = isOrganizer
        ? nextOrgName
        : `${nextFirst} ${nextLast}`.trim();
      setUser({
        ...user,
        first_name: nextFirst,
        last_name: nextLast,
        zip_code: form.zip_code.trim(),
        radius_miles: normalizeRadiusMiles(form.radius_miles),
        full_name: fullName || user.email,
        org_name: isOrganizer ? nextOrgName : user.org_name,
      });

      toast({ title: "Account updated!" });
    } catch (err) {
      toast({ title: "Failed to save", description: err?.message || String(err), variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-heading font-semibold text-sm text-muted-foreground border-b border-border pb-2">Profile</h3>
        <div>
          <Label className="text-sm flex items-center">
            Account Type
            <HelpTip text="Community Members can post events on behalf of others. Organizers can post with logos and photos for their own organization." />
          </Label>
          {isAdmin ? (
            <p className="mt-1 text-sm font-medium text-mint-600">Admin</p>
          ) : (
            <div className="mt-1">
              <p className="text-sm font-medium text-foreground capitalize">
                {form.role === "community_member" ? "Community Member" : "Organizer"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Account type cannot be changed after registration.</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {form.role === "organizer" ? (
            <div className="sm:col-span-2">
              <Label className="text-sm">Organization Name *</Label>
              <Input
                value={form.org_name}
                onChange={(e) => updateField("org_name", formatActivityTitle(e.target.value))}
                className="rounded-xl mt-1"
              />
            </div>
          ) : (
            <>
              <div>
                <Label className="text-sm">First Name *</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => updateField("first_name", toStrictTitleCase(e.target.value))}
                  className="rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Last Name *</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => updateField("last_name", toStrictTitleCase(e.target.value))}
                  className="rounded-xl mt-1"
                />
              </div>
            </>
          )}
          <div>
            <Label className="text-sm">Zip Code *</Label>
            <Input
              value={form.zip_code}
              onChange={(e) => updateField("zip_code", e.target.value.replace(/\D/g, "").slice(0, 5))}
              className="rounded-xl mt-1"
              maxLength={5}
              inputMode="numeric"
              placeholder="5 digits"
            />
          </div>
          <div>
            <Label className="text-sm">Distance *</Label>
            <select
              value={normalizeRadiusMiles(form.radius_miles)}
              onChange={(e) => updateField("radius_miles", Number(e.target.value))}
              className="w-full mt-1 h-10 rounded-xl text-sm border border-input bg-transparent px-3 py-2 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {RADIUS_OPTIONS.map((d) => (
                <option key={d} value={d}>{d} miles</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Used as your Home page default when you sign in.</p>
          </div>
          <BetaZipOutsideNote betaConfig={betaConfig} zipCode={form.zip_code} />
        </div>
      </div>

      {!isAdmin && form.role === "organizer" && (
        <div className="space-y-4 pt-2">
          <h3 className="font-heading font-semibold text-sm text-muted-foreground border-b border-border pb-2">
            Organization Details
            <HelpTip text="Provide your organization's details for verification and branding." />
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label className="text-sm">Website *</Label>
              <Input value={form.org_website} onChange={(e) => updateField("org_website", e.target.value)} className="rounded-xl mt-1" placeholder="https://yourorg.com" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-sm">Organization Email *</Label>
              <Input type="email" value={form.org_email} onChange={(e) => updateField("org_email", e.target.value)} className="rounded-xl mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-sm">Description *</Label>
            <Input value={form.org_description} onChange={(e) => updateField("org_description", e.target.value)} className="rounded-xl mt-1" placeholder="Brief description of your organization and programs" />
          </div>
          <div>
            <Label className="text-sm flex items-center gap-1">
              Organization Logo
              <HelpTip text="Best fit: square image (e.g. 500×500). Large files are resized automatically before upload." />
            </Label>
            <div className="flex items-center gap-3 mt-1">
              {form.org_logo && <img src={form.org_logo} alt="Logo" className="w-12 h-12 rounded-full object-cover border border-border" />}
              <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span className="text-sm">{form.org_logo ? "Change Logo" : "Upload Logo"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </label>
            </div>
          </div>
        </div>
      )}

      <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Save Changes
      </Button>

      <div className="space-y-3 pt-2">
        <h3 className="font-heading font-semibold text-sm text-muted-foreground border-b border-border pb-2">Security</h3>
        <div>
          <p className="text-sm font-medium mb-2">Password</p>
          <Button type="button" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={handleResetPassword} disabled={sendingReset}>
            {sendingReset ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
            Email Password Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
