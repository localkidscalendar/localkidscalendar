import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ChevronDown, ChevronUp, Pencil, Trash2, HelpCircle, Loader2 } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import moment from "moment";

const emptyForm = {
  code: "",
  discount_percent: "",
  plan_type: "both",
  renewals_applicable: 1,
  max_uses_per_user: 1,
  restricted_email: "",
  expires_date: "",
};

const PLAN_LABELS = { monthly: "Monthly only", annual: "Annual only", both: "Monthly & Annual" };

export default function DiscountCodesPanel({ toast }) {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // id of code being edited
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [expandedUsers, setExpandedUsers] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const items = await base44.entities.DiscountCode.list("-created_date", 100);
      setCodes(items);
    } catch { setCodes([]); }
    setLoading(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (dc) => {
    setEditingId(dc.id);
    setForm({
      code: dc.code,
      discount_percent: dc.discount_percent,
      plan_type: dc.plan_type || "both",
      renewals_applicable: dc.renewals_applicable ?? 1,
      max_uses_per_user: dc.max_uses_per_user ?? 1,
      restricted_email: dc.restricted_email || "",
      expires_date: dc.expires_date || "",
    });
    setShowForm(true);
    setExpandedUsers(null);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.discount_percent || !form.expires_date) return;
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        discount_percent: Number(form.discount_percent),
        plan_type: form.plan_type,
        renewals_applicable: Number(form.renewals_applicable) || 1,
        max_uses_per_user: Number(form.max_uses_per_user) || 1,
        restricted_email: form.restricted_email.trim().toLowerCase() || null,
        expires_date: form.expires_date,
      };
      if (editingId) {
        await base44.entities.DiscountCode.update(editingId, payload);
        toast({ title: `Code "${payload.code}" updated` });
      } else {
        await base44.entities.DiscountCode.create({ ...payload, status: "active", times_used: 0, used_by_user_ids: [], used_by_records: [] });
        toast({ title: `Discount code "${payload.code}" created` });
      }
      cancelForm();
      load();
    } catch {
      toast({ title: "Failed to save code", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (dc) => {
    if (!window.confirm(`Permanently delete code "${dc.code}"? This cannot be undone.`)) return;
    await base44.entities.DiscountCode.delete(dc.id);
    setCodes(prev => prev.filter(c => c.id !== dc.id));
    toast({ title: `Code "${dc.code}" deleted` });
  };

  const handleToggleStatus = async (dc) => {
    const next = dc.status === "active" ? "disabled" : "active";
    await base44.entities.DiscountCode.update(dc.id, { status: next });
    setCodes(prev => prev.map(c => c.id === dc.id ? { ...c, status: next } : c));
    toast({ title: `Code "${dc.code}" ${next === "active" ? "reactivated" : "deactivated"}` });
  };

  const statusColor = (s) => {
    if (s === "active") return "bg-mint-100 text-mint-600";
    if (s === "expired") return "bg-gray-100 text-gray-500";
    return "bg-red-50 text-red-500";
  };

  // Shared form JSX used for both create and edit
  const renderForm = () => (
    <div className="bg-muted/40 rounded-2xl border border-border p-4 space-y-4">
      <h4 className="font-heading font-semibold text-sm">{editingId ? "Edit Discount Code" : "Create New Discount Code"}</h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Code Name *</Label>
          <Input
            className="mt-1 uppercase"
            placeholder="e.g. SUMMER25"
            value={form.code}
            disabled={!!editingId}
            onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
          />
        </div>
        <div>
          <Label>Discount Percentage *</Label>
          <div className="relative mt-1">
            <Input
              type="number"
              min={1}
              max={100}
              placeholder="e.g. 25"
              value={form.discount_percent}
              onChange={e => setForm(f => ({ ...f, discount_percent: e.target.value }))}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
          </div>
        </div>
        <div>
          <Label>Applies To Plan</Label>
          <Select value={form.plan_type} onValueChange={v => setForm(f => ({ ...f, plan_type: v }))}>
            <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Monthly &amp; Annual</SelectItem>
              <SelectItem value="monthly">Monthly only</SelectItem>
              <SelectItem value="annual">Annual only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Expiration Date *</Label>
          <Input
            type="date"
            className="mt-1"
            value={form.expires_date}
            onChange={e => setForm(f => ({ ...f, expires_date: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground mt-1">Code will stop working after this date</p>
        </div>
        <div>
          <Label>Renewals Discount Applies To</Label>
          <Input
            type="number"
            min={1}
            className="mt-1"
            placeholder="e.g. 3"
            value={form.renewals_applicable}
            onChange={e => setForm(f => ({ ...f, renewals_applicable: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground mt-1">Billing cycles the discount applies (1 = first payment only)</p>
        </div>
        <div>
          <Label>Max Uses Per User</Label>
          <Input
            type="number"
            min={1}
            className="mt-1"
            placeholder="e.g. 2"
            value={form.max_uses_per_user}
            onChange={e => setForm(f => ({ ...f, max_uses_per_user: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground mt-1">Allow the same user to apply this code across multiple zip codes</p>
        </div>
        <div className="sm:col-span-2">
          <Label>Restrict to Email (optional)</Label>
          <Input
            type="email"
            className="mt-1"
            placeholder="e.g. jane@example.com"
            value={form.restricted_email}
            onChange={e => setForm(f => ({ ...f, restricted_email: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground mt-1">If set, only the account with this email can use this code (personal code). Leave blank for a code anyone can use.</p>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" className="rounded-xl" onClick={cancelForm} disabled={saving}>Cancel</Button>
        <Button
          size="sm"
          className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
          disabled={!form.code.trim() || !form.discount_percent || !form.expires_date || saving}
          onClick={handleSave}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
          {editingId ? "Save Changes" : "Create Code"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="bg-white border border-border rounded-2xl p-5 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-sm">All Discount Codes ({codes.length})</h3>
        {!showForm && (
          <Button size="sm" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Create New Discount Code
          </Button>
        )}
      </div>

      {/* Create / Edit form */}
      {showForm && renderForm()}

      {/* Codes list */}
      {loading ? (
        <LoadingState text="Loading discount codes..." />
      ) : codes.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="No Discount Codes"
          description="Create discount codes to offer promotions to Supporters."
          actionLabel="Create Discount Code"
          onAction={openCreate}
        />
      ) : (
        <div className="space-y-3">
          {codes.map(dc => {
            const isExpanded = expandedUsers === dc.id;
            const usedRecords = dc.used_by_records || [];
            const isExpiredByDate = dc.expires_date && moment(dc.expires_date).isBefore(moment(), "day");
            const effectiveStatus = isExpiredByDate && dc.status === "active" ? "expired" : dc.status;

            return (
              <div key={dc.id} className="bg-muted/20 rounded-2xl border border-border overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    {/* Left: code info */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-heading font-bold text-base tracking-wide">{dc.code}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(effectiveStatus)}`}>
                          {effectiveStatus === "disabled" ? "Deactivated" : effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)}
                        </span>
                        {dc.restricted_email && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-600">
                            Personal: {dc.restricted_email}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium text-foreground">{dc.discount_percent}% off</span>
                          <p>Discount</p>
                        </div>
                        <div>
                          <span className="font-medium text-foreground">{PLAN_LABELS[dc.plan_type] || "Monthly & Annual"}</span>
                          <p>Applies to</p>
                        </div>
                        <div>
                          <span className="font-medium text-foreground">{dc.renewals_applicable ?? 1}</span>
                          <p>Renewal{(dc.renewals_applicable ?? 1) !== 1 ? "s" : ""} applicable</p>
                        </div>
                        <div>
                          <span className="font-medium text-foreground">{dc.max_uses_per_user ?? 1}</span>
                          <p>Max uses / user</p>
                        </div>
                        <div>
                          <span className={`font-medium ${isExpiredByDate ? "text-destructive" : "text-foreground"}`}>
                            {dc.expires_date ? moment(dc.expires_date).format("MMM D, YYYY") : "—"}
                          </span>
                          <p>Expires</p>
                        </div>
                        <div>
                          <span className="font-medium text-foreground">{moment.utc(dc.created_date).local().format("MMM D, YYYY")}</span>
                          <p>Date created</p>
                        </div>
                        <div>
                          <button
                            className={`font-medium ${usedRecords.length > 0 ? "underline underline-offset-2 text-mint-600 hover:text-mint-700 cursor-pointer" : "text-foreground cursor-default"}`}
                            onClick={() => usedRecords.length > 0 && setExpandedUsers(prev => prev === dc.id ? null : dc.id)}
                            disabled={usedRecords.length === 0}
                          >
                            {dc.times_used || 0} time{(dc.times_used || 0) !== 1 ? "s" : ""}
                          </button>
                          <p>Applied</p>
                        </div>
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      {usedRecords.length > 0 && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                          onClick={() => setExpandedUsers(prev => prev === dc.id ? null : dc.id)}>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          Usage
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Edit" onClick={() => openEdit(dc)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className={`h-7 text-xs rounded-xl ${dc.status === "active" ? "text-muted-foreground border-border" : "text-mint-600 border-mint-200"}`}
                        onClick={() => handleToggleStatus(dc)}
                      >
                        {dc.status === "active" ? "Deactivate" : "Reactivate"}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        title="Delete" onClick={() => handleDelete(dc)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded usage list */}
                {isExpanded && usedRecords.length > 0 && (
                  <div className="border-t border-border bg-muted/30 px-4 py-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Usage Detail</p>
                    <div className="space-y-1.5">
                      {usedRecords.map((r, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs bg-background rounded-lg px-3 py-2 border border-border">
                          <span className="font-medium flex-1 min-w-0 truncate">{r.user_name || "Unknown user"}</span>
                          <span className="text-muted-foreground shrink-0">{r.ad_name || "—"}</span>
                          <span className="text-muted-foreground shrink-0">Zip: {r.zip_code || "—"}</span>
                          <span className="text-muted-foreground shrink-0">{r.used_date ? moment.utc(r.used_date).local().format("MMM D, YYYY") : "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}