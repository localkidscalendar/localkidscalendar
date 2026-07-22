import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import HelpTip from "@/components/shared/HelpTip";
import { Upload, Save, AlertTriangle, Loader2, KeyRound } from "lucide-react";

export default function ProfileTab({ user, setUser }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [organizerRecord, setOrganizerRecord] = useState(null);

  const isAdmin = user?.role === "admin" || user?.is_owner;
  const isRoleLocked = !isAdmin && (user?.role === "organizer" || user?.role === "community_member");

  const [form, setForm] = useState({
    first_name: "", last_name: "", zip_code: "", role: "community_member",
    org_name: "", org_description: "", org_logo: "", org_website: "", org_email: "",
  });

  useEffect(() => {
    const displayRole = isAdmin ? "community_member" : (user.role === "user" || user.role === "community_member") ? "community_member" : (user.role || "community_member");
    setForm({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      zip_code: user.zip_code || "",
      role: displayRole,
      org_name: "", org_description: "", org_logo: "", org_website: "", org_email: "",
    });
    loadOrganizerProfile(user.id);
  }, [user]);

  const loadOrganizerProfile = async (userId) => {
    try {
      const records = await base44.entities.Organizer.filter({ user_id: userId });
      if (records.length > 0) {
        const rec = records[0];
        setOrganizerRecord(rec);
        setForm((prev) => ({
          ...prev,
          org_name: rec.org_name || "",
          org_description: rec.org_description || "",
          org_logo: rec.org_logo || "",
          org_website: rec.org_website || "",
          org_email: rec.org_email || "",
        }));
      }
    } catch {}
  };

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      updateField("org_logo", file_url);
    } catch {}
    setUploadingLogo(false);
  };

  const handleResetPassword = async () => {
    setSendingReset(true);
    try {
      await base44.auth.resetPasswordRequest(user.email);
    } catch {}
    toast({ title: "Password reset email sent", description: `Check ${user?.email} for a link to reset your password.` });
    setSendingReset(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const isOrganizer = !isAdmin && form.role === "organizer";
      if (isOrganizer) {
        if (!form.org_name || !form.org_website || !form.org_email || !form.org_description) {
          toast({ title: "Please fill in all required organization fields", variant: "destructive" });
          setSaving(false);
          return;
        }
      } else if (!isAdmin) {
        if (!form.first_name || !form.last_name) {
          toast({ title: "Please enter your first and last name", variant: "destructive" });
          setSaving(false);
          return;
        }
      }
      if (form.zip_code && !/^\d{5}$/.test(form.zip_code.trim())) {
        toast({ title: "Zip Code must be exactly 5 digits", variant: "destructive" });
        setSaving(false);
        return;
      }

      const fullName = isOrganizer ? form.org_name : `${form.first_name} ${form.last_name}`.trim();
      const profileUpdate = {
        first_name: form.first_name,
        last_name: form.last_name,
        full_name: fullName,
        zip_code: form.zip_code,
      };
      await base44.auth.updateMe(profileUpdate);

      const needsRoleUpdate = user.role === "user" || form.role !== user.role;
      if (needsRoleUpdate && form.role !== "user") {
        await base44.functions.invoke('updateUserRole', { role: form.role });
      }

      const userUpdate = { ...profileUpdate, role: form.role };
      setUser({ ...user, ...userUpdate });

      if (isOrganizer) {
        const orgData = {
          user_id: user.id,
          org_name: form.org_name,
          org_description: form.org_description,
          org_logo: form.org_logo || null,
          org_website: form.org_website,
          org_email: form.org_email,
        };
        if (organizerRecord) {
          await base44.entities.Organizer.update(organizerRecord.id, orgData);
        } else {
          const created = await base44.entities.Organizer.create(orgData);
          setOrganizerRecord(created);
        }
      }

      toast({ title: "Account updated!" });
    } catch (err) {
      toast({ title: "Failed to save", description: err?.message || String(err), variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Basic info */}
      <div className="space-y-4">
        <h3 className="font-heading font-semibold text-sm text-muted-foreground border-b border-border pb-2">Profile</h3>
        <div>
          <Label className="text-sm flex items-center">
            Account Type
            <HelpTip text="Community Members can post events on behalf of others. Organizers can post with logos and photos for their own organization." />
          </Label>
          {isAdmin ? (
            <p className="mt-1 text-sm font-medium text-mint-600">Admin</p>
          ) : isRoleLocked ? (
            <div className="mt-1">
              <p className="text-sm font-medium text-foreground capitalize">
                {form.role === "community_member" ? "Community Member" : "Organizer"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Account type cannot be changed after saving.</p>
            </div>
          ) : (
            <div className="mt-1 space-y-2">
              <Select value={form.role} onValueChange={(v) => updateField("role", v)}>
                <SelectTrigger className="rounded-xl max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="community_member">Community Member</SelectItem>
                  <SelectItem value="organizer">Organizer</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-sm">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Your account type cannot be changed after you save. An email address can only be associated with one type.</span>
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {form.role === "organizer" ? (
            <>
              <div className="sm:col-span-2">
                <Label className="text-sm">Organization Name *</Label>
                <Input value={form.org_name} onChange={(e) => updateField("org_name", e.target.value)} className="rounded-xl mt-1" />
              </div>
            </>
          ) : (
            <>
              <div>
                <Label className="text-sm">First Name *</Label>
                <Input value={form.first_name} onChange={(e) => updateField("first_name", e.target.value)} className="rounded-xl mt-1" />
              </div>
              <div>
                <Label className="text-sm">Last Name *</Label>
                <Input value={form.last_name} onChange={(e) => updateField("last_name", e.target.value)} className="rounded-xl mt-1" />
              </div>
            </>
          )}
          <div>
            <Label className="text-sm">Zip Code *</Label>
            <Input value={form.zip_code} onChange={(e) => updateField("zip_code", e.target.value.replace(/\D/g, "").slice(0, 5))} className="rounded-xl mt-1" maxLength={5} inputMode="numeric" placeholder="5 digits" />
          </div>
        </div>
      </div>

      {/* Organizer-only fields */}
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
            <Label className="text-sm">Organization Logo</Label>
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

      {/* Security */}
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