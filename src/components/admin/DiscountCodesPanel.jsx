import React, { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, HelpCircle, Loader2 } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import moment from "moment";
import Paginator, { PAGE_SIZE } from "@/components/admin/Paginator";

const emptyForm = {
  code: "",
  discount_percent: "",
  plan_type: "both",
  renewals_applicable: 1,
  renewals_ongoing: false,
  max_uses_per_user: 1,
  restricted_email: "",
  expires_date: "",
};

const PLAN_LABELS = { monthly: "Monthly only", annual: "Annual only", both: "Monthly & Annual" };
const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

function getEffectiveStatus(dc) {
  const isExpiredByDate = dc.expires_date && moment(dc.expires_date).isBefore(moment(), "day");
  if (isExpiredByDate && dc.status === "active") return "expired";
  return dc.status;
}

function isActiveCode(dc) {
  return getEffectiveStatus(dc) === "active";
}

function sortedUsageRecords(records) {
  return [...records].sort((a, b) => {
    const aTime = a?.used_date ? new Date(a.used_date).getTime() : 0;
    const bTime = b?.used_date ? new Date(b.used_date).getTime() : 0;
    return aTime - bTime;
  });
}

export default function DiscountCodesPanel({ toast }) {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [expandedUsers, setExpandedUsers] = useState(null);
  const [codesPage, setCodesPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: items, error } = await supabase
        .from("discount_codes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setCodes(items || []);
    } catch {
      setCodes([]);
    }
    setLoading(false);
  };

  const filteredCodes = useMemo(() => {
    if (statusFilter === "active") return codes.filter(isActiveCode);
    if (statusFilter === "inactive") return codes.filter((dc) => !isActiveCode(dc));
    return codes;
  }, [codes, statusFilter]);

  useEffect(() => {
    setCodesPage(1);
  }, [statusFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (dc) => {
    const renewals = Number(dc.renewals_applicable ?? 1);
    setEditingId(dc.id);
    setForm({
      code: dc.code,
      discount_percent: dc.discount_percent,
      plan_type: dc.plan_type || "both",
      renewals_applicable: renewals > 0 ? renewals : 1,
      renewals_ongoing: renewals <= 0,
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
    if (!form.code.trim() || !form.discount_percent) return;
    if (!form.renewals_ongoing && !(Number(form.renewals_applicable) >= 1)) {
      toast?.({ title: "Enter how many billing cycles the discount applies to", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        discount_percent: Number(form.discount_percent),
        plan_type: form.plan_type,
        // 0 = ongoing on the subscription (Stripe forever) while the code was used at checkout
        renewals_applicable: form.renewals_ongoing ? 0 : (Number(form.renewals_applicable) || 1),
        max_uses_per_user: Number(form.max_uses_per_user) || 1,
        restricted_email: form.restricted_email.trim().toLowerCase() || null,
        expires_date: form.expires_date || null,
        updated_at: new Date().toISOString(),
      };
      if (editingId) {
        const { error } = await supabase.from("discount_codes").update(payload).eq("id", editingId);
        if (error) throw error;
        toast?.({ title: `Code "${payload.code}" updated` });
      } else {
        const { error } = await supabase.from("discount_codes").insert({
          ...payload,
          status: "active",
          times_used: 0,
          used_by_user_ids: [],
          used_by_records: [],
        });
        if (error) throw error;
        toast?.({ title: `Discount code "${payload.code}" created` });
      }
      cancelForm();
      load();
    } catch {
      toast?.({ title: "Failed to save code", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (dc) => {
    if (!window.confirm(`Permanently delete code "${dc.code}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("discount_codes").delete().eq("id", dc.id);
    if (error) {
      toast?.({ title: "Failed to delete code", variant: "destructive" });
      return;
    }
    setCodes((prev) => prev.filter((c) => c.id !== dc.id));
    toast?.({ title: `Code "${dc.code}" deleted` });
  };

  const handleToggleStatus = async (dc) => {
    const next = dc.status === "active" ? "disabled" : "active";
    const { error } = await supabase.from("discount_codes").update({
      status: next,
      updated_at: new Date().toISOString(),
    }).eq("id", dc.id);
    if (error) {
      toast?.({ title: "Failed to update status", variant: "destructive" });
      return;
    }
    setCodes((prev) => prev.map((c) => (c.id === dc.id ? { ...c, status: next } : c)));
    toast?.({ title: `Code "${dc.code}" ${next === "active" ? "reactivated" : "deactivated"}` });
  };

  const statusColor = (s) => {
    if (s === "active") return "bg-mint-100 text-mint-600";
    if (s === "expired") return "bg-gray-100 text-gray-500";
    return "bg-red-50 text-red-500";
  };

  const renewalsLabel = (n) => {
    const count = Number(n ?? 1);
    if (count <= 0) return "Ongoing";
    return String(count);
  };

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
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
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
              onChange={(e) => setForm((f) => ({ ...f, discount_percent: e.target.value }))}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
          </div>
        </div>
        <div className="sm:col-span-2">
          <Label>Applies To Plan</Label>
          <Select value={form.plan_type} onValueChange={(v) => setForm((f) => ({ ...f, plan_type: v }))}>
            <SelectTrigger className="mt-1 rounded-xl max-w-md"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Monthly &amp; Annual</SelectItem>
              <SelectItem value="monthly">Monthly only</SelectItem>
              <SelectItem value="annual">Annual only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Expiration Date</Label>
          <Input
            type="date"
            className="mt-1 max-w-md"
            value={form.expires_date}
            data-empty={!form.expires_date ? "true" : "false"}
            onChange={(e) => setForm((f) => ({ ...f, expires_date: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Leave blank for no end date — new checkouts can use the code until you Deactivate it
          </p>
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Label>Renewals Discount Applies To</Label>
          <div className="flex items-start gap-2">
            <Checkbox
              id="renewals-ongoing"
              checked={form.renewals_ongoing}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, renewals_ongoing: Boolean(checked) }))}
              className="mt-0.5"
            />
            <Label htmlFor="renewals-ongoing" className="text-sm font-normal cursor-pointer leading-snug">
              Ongoing on the subscription (all renewals after checkout)
            </Label>
          </div>
          {!form.renewals_ongoing && (
            <Input
              type="number"
              min={1}
              className="mt-1 max-w-xs"
              placeholder="e.g. 3"
              value={form.renewals_applicable}
              onChange={(e) => setForm((f) => ({ ...f, renewals_applicable: e.target.value }))}
            />
          )}
          <p className="text-xs text-muted-foreground">
            {form.renewals_ongoing
              ? "Subscribers who check out with this code keep the discount on renewals. Deactivating the code only blocks new checkouts — it does not remove an ongoing discount already on a live subscription."
              : "Number of billing cycles including the first payment (1 = first payment only)."}
          </p>
        </div>
        <div>
          <Label>Max Uses Per User</Label>
          <Input
            type="number"
            min={1}
            className="mt-1"
            placeholder="e.g. 2"
            value={form.max_uses_per_user}
            onChange={(e) => setForm((f) => ({ ...f, max_uses_per_user: e.target.value }))}
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
            onChange={(e) => setForm((f) => ({ ...f, restricted_email: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground mt-1">If set, only the account with this email can use this code (personal code). Leave blank for a code anyone can use.</p>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" className="rounded-xl" onClick={cancelForm} disabled={saving}>Cancel</Button>
        <Button
          size="sm"
          className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
          disabled={!form.code.trim() || !form.discount_percent || saving}
          onClick={handleSave}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
          {editingId ? "Save Changes" : "Create Code"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <h3 className="font-heading font-semibold text-sm">
            Discount Codes ({filteredCodes.length}{statusFilter !== "all" ? ` of ${codes.length}` : ""})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                  statusFilter === opt.id
                    ? "border-mint-300 bg-mint-50 text-mint-700"
                    : "border-border bg-white text-muted-foreground hover:bg-mint-50 hover:border-mint-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {!showForm && (
          <Button size="sm" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white shrink-0" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Create New Discount Code
          </Button>
        )}
      </div>

      {showForm && renderForm()}

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
      ) : filteredCodes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No {statusFilter} discount codes.
        </p>
      ) : (
        <div className="space-y-3">
          {filteredCodes.slice((codesPage - 1) * PAGE_SIZE, codesPage * PAGE_SIZE).map((dc) => {
            const isExpanded = expandedUsers === dc.id;
            const usedRecords = sortedUsageRecords(
              Array.isArray(dc.used_by_records) ? dc.used_by_records : []
            );
            const usageCount = Number(dc.times_used || usedRecords.length || 0);
            const effectiveStatus = getEffectiveStatus(dc);
            const renewalsCount = Number(dc.renewals_applicable ?? 1);
            const isExpiredByDate = effectiveStatus === "expired";

            return (
              <div key={dc.id} className="bg-muted/20 rounded-2xl border border-border overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
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
                          <span className="font-medium text-foreground">{renewalsLabel(renewalsCount)}</span>
                          <p>
                            {renewalsCount <= 0
                              ? "On renewals"
                              : `Renewal${renewalsCount !== 1 ? "s" : ""} applicable`}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-foreground">{dc.max_uses_per_user ?? 1}</span>
                          <p>Max uses / user</p>
                        </div>
                        <div>
                          <span className={`font-medium ${isExpiredByDate ? "text-destructive" : "text-foreground"}`}>
                            {dc.expires_date ? moment(dc.expires_date).format("MMM D, YYYY") : "No expiration"}
                          </span>
                          <p>Expires</p>
                        </div>
                        <div>
                          <span className="font-medium text-foreground">{moment.utc(dc.created_at).local().format("MMM D, YYYY")}</span>
                          <p>Date created</p>
                        </div>
                        <div>
                          <span className="font-medium text-foreground">
                            {usageCount} time{usageCount !== 1 ? "s" : ""}
                          </span>
                          <p>Applied</p>
                        </div>
                      </div>

                      {usedRecords.length > 0 && (
                        <div className="pt-1">
                          <button
                            type="button"
                            className="text-xs font-medium text-mint-600 hover:underline"
                            onClick={() => setExpandedUsers((prev) => (prev === dc.id ? null : dc.id))}
                          >
                            {isExpanded
                              ? "Hide Usage History"
                              : `Usage History (${usedRecords.length})`}
                          </button>
                          {isExpanded && (
                            <div className="mt-1 space-y-0.5 pl-0.5 text-xs text-muted-foreground">
                              {usedRecords.map((r, i) => (
                                <p key={`${dc.id}-use-${i}`}>
                                  • {r.user_name || "Unknown user"}
                                  {r.used_date
                                    ? ` — ${moment.utc(r.used_date).local().format("MMM D, YYYY h:mm A")}`
                                    : ""}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
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
              </div>
            );
          })}
          <Paginator total={filteredCodes.length} page={codesPage} onPage={setCodesPage} />
        </div>
      )}
    </div>
  );
}
