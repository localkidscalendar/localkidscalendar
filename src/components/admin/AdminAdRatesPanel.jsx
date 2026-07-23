import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, DollarSign, History, Plus, Check } from "lucide-react";
import moment from "moment";

export default function AdminAdRatesPanel({ toast }) {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    monthly_rate: "",
    annual_discount_percent: "",
    effective_date: "",
    notes: "",
  });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: configs }, { data: hist }] = await Promise.all([
        supabase.from("ad_pricing_config").select("*").eq("config_key", "global").limit(1),
        supabase
          .from("ad_pricing_history")
          .select("*")
          .order("effective_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (configs?.length) setCurrent(configs[0]);
      else setCurrent(null);
      // Ensure same-day rows stay newest-first even if the DB only honors one order clause
      const sorted = [...(hist || [])].sort((a, b) => {
        const byDate = String(b.effective_date || "").localeCompare(String(a.effective_date || ""));
        if (byDate !== 0) return byDate;
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });
      setHistory(sorted);
    } catch {
      setCurrent(null);
      setHistory([]);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.monthly_rate || !form.annual_discount_percent || !form.effective_date) {
      toast?.({ title: "All rate fields are required", variant: "destructive" });
      return;
    }
    const monthly = parseFloat(form.monthly_rate);
    const discount = parseFloat(form.annual_discount_percent);
    if (Number.isNaN(monthly) || Number.isNaN(discount) || monthly <= 0 || discount < 0 || discount >= 100) {
      toast?.({ title: "Invalid rate values", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (current?.id) {
        // Close every open history row (normally one). Same-day changes use created_at
        // to decide which row was active; live display always reads ad_pricing_config.
        const openRecords = history.filter((h) => !h.end_date);
        for (const openRecord of openRecords) {
          const sameDay = moment(form.effective_date).isSame(moment(openRecord.effective_date), "day");
          const endDate = sameDay
            ? form.effective_date
            : moment(form.effective_date).subtract(1, "day").format("YYYY-MM-DD");
          const { error: closeErr } = await supabase
            .from("ad_pricing_history")
            .update({ end_date: endDate, updated_at: new Date().toISOString() })
            .eq("id", openRecord.id);
          if (closeErr) throw closeErr;
        }
        const { error: cfgErr } = await supabase
          .from("ad_pricing_config")
          .update({
            monthly_rate: monthly,
            annual_discount_percent: discount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", current.id);
        if (cfgErr) throw cfgErr;
      } else {
        const { error: createErr } = await supabase.from("ad_pricing_config").insert({
          config_key: "global",
          monthly_rate: monthly,
          annual_discount_percent: discount,
        });
        if (createErr) throw createErr;
      }

      const { error: histErr } = await supabase.from("ad_pricing_history").insert({
        monthly_rate: monthly,
        annual_discount_percent: discount,
        effective_date: form.effective_date,
        notes: form.notes || null,
        set_by: user?.id || null,
      });
      if (histErr) throw histErr;

      toast?.({
        title: "New rate saved and will take effect on " + moment(form.effective_date).format("MMM D, YYYY"),
      });
      setForm({ monthly_rate: "", annual_discount_percent: "", effective_date: "", notes: "" });
      setShowForm(false);
      load();
    } catch (e) {
      toast?.({ title: "Failed to save rate", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-mint-500" />
      </div>
    );
  }

  const annualPrice = current
    ? Math.round(Number(current.monthly_rate) * 12 * (1 - Number(current.annual_discount_percent) / 100))
    : null;

  return (
    <div className="bg-white border border-border rounded-2xl p-5 space-y-5">
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-heading font-semibold text-base">Current Rates</h3>
          </div>
          <Button
            size="sm"
            className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Set New Rate
          </Button>
        </div>
        {current ? (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <p className="font-heading font-bold text-xl">${current.monthly_rate}/mo</p>
              <p className="text-xs text-muted-foreground">Monthly Plan</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <p className="font-heading font-bold text-xl">${annualPrice?.toLocaleString()}/yr</p>
              <p className="text-xs text-muted-foreground">
                Annual Plan ({current.annual_discount_percent}% off)
              </p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <p className="font-heading font-bold text-xl">{current.annual_discount_percent}%</p>
              <p className="text-xs text-muted-foreground">Annual Discount</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mt-2">No rate configured yet. Set one below.</p>
        )}
      </div>

      {showForm && (
        <div className="border-t border-border pt-5 space-y-4">
          <h4 className="font-heading font-semibold text-sm">Set New Rate</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Monthly Rate ($)</label>
              <Input
                type="number"
                min="1"
                placeholder="150"
                value={form.monthly_rate}
                onChange={(e) => setForm((f) => ({ ...f, monthly_rate: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Annual Discount (%)</label>
              <Input
                type="number"
                min="0"
                max="99"
                placeholder="30"
                value={form.annual_discount_percent}
                onChange={(e) => setForm((f) => ({ ...f, annual_discount_percent: e.target.value }))}
                className="rounded-xl"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Effective Date *</label>
            <Input
              type="date"
              value={form.effective_date}
              onChange={(e) => setForm((f) => ({ ...f, effective_date: e.target.value }))}
              className="rounded-xl max-w-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Rate goes live on this date. Prior rate is closed out the day before.
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Notes (optional)</label>
            <Input
              placeholder="e.g. 2026 Q3 rate increase"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="rounded-xl"
            />
          </div>
          {form.monthly_rate && form.annual_discount_percent && (
            <div className="bg-muted/40 rounded-xl p-3 text-sm">
              <p className="font-medium">Preview:</p>
              <p>
                Monthly: <strong>${parseFloat(form.monthly_rate || 0).toFixed(0)}/mo</strong>
              </p>
              <p>
                Annual:{" "}
                <strong>
                  $
                  {Math.round(
                    parseFloat(form.monthly_rate || 0) *
                      12 *
                      (1 - parseFloat(form.annual_discount_percent || 0) / 100)
                  ).toLocaleString()}
                  /yr
                </strong>
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
              Save Rate
            </Button>
          </div>
        </div>
      )}

      <div className="border-t border-border pt-5">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-muted-foreground" />
          <h4 className="font-heading font-semibold text-sm">Rate History</h4>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No rate history yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Effective</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">End Date</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Monthly</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Annual</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Discount</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((h) => {
                  const annual = Math.round(
                    Number(h.monthly_rate) * 12 * (1 - Number(h.annual_discount_percent) / 100)
                  );
                  const isActive = !h.end_date;
                  return (
                    <tr key={h.id} className={isActive ? "bg-muted/30" : ""}>
                      <td className="px-3 py-2">
                        {moment(h.effective_date).format("MMM D, YYYY")}
                        {isActive && (
                          <span className="ml-2 text-xs text-mint-500 font-semibold">● Current</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {h.end_date ? moment(h.end_date).format("MMM D, YYYY") : "—"}
                      </td>
                      <td className="px-3 py-2 font-medium">${h.monthly_rate}/mo</td>
                      <td className="px-3 py-2 font-medium">${annual.toLocaleString()}/yr</td>
                      <td className="px-3 py-2">{h.annual_discount_percent}%</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{h.notes || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
