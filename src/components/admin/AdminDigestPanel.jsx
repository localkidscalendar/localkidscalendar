import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Mail } from "lucide-react";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import AdminPanelShell from "@/components/admin/AdminPanelShell";

export default function AdminDigestPanel({ toast }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState({ weekly: 0, suppressed: 0 });
  const [inactivityDays, setInactivityDays] = useState("90");
  const [maxSends, setMaxSends] = useState("200");

  const load = async () => {
    setLoading(true);
    try {
      let { data, error } = await supabase
        .from("email_config")
        .select("*")
        .eq("config_key", "global")
        .maybeSingle();
      if (error) throw error;

      if (!data) {
        const { data: created, error: createError } = await supabase
          .from("email_config")
          .insert({
            config_key: "global",
            digests_paused: false,
            inactivity_days: 90,
            max_sends_per_run: 200,
          })
          .select("*")
          .single();
        if (createError) throw createError;
        data = created;
      }

      setConfig(data);
      setInactivityDays(String(data.inactivity_days ?? 90));
      setMaxSends(String(data.max_sends_per_run ?? 200));

      const [{ count: weekly }, { count: suppressed }] = await Promise.all([
        supabase
          .from("notification_preferences")
          .select("user_id", { count: "exact", head: true })
          .eq("frequency", "weekly"),
        supabase.from("email_suppressions").select("id", { count: "exact", head: true }),
      ]);
      setStats({ weekly: weekly || 0, suppressed: suppressed || 0 });
    } catch (err) {
      toast?.({
        title: "Could not load digest settings",
        description: err.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (updates) => {
    if (!config?.id) return;
    setSaving(true);
    try {
      const payload = { ...updates, updated_at: new Date().toISOString() };
      if (Object.prototype.hasOwnProperty.call(updates, "digests_paused")) {
        payload.paused_at = updates.digests_paused ? new Date().toISOString() : null;
        const { data: auth } = await supabase.auth.getUser();
        payload.paused_by = updates.digests_paused ? auth?.user?.id || null : null;
      }
      const { data: updated, error } = await supabase
        .from("email_config")
        .update(payload)
        .eq("id", config.id)
        .select("*")
        .single();
      if (error) throw error;
      setConfig(updated);
      setInactivityDays(String(updated.inactivity_days ?? 90));
      setMaxSends(String(updated.max_sends_per_run ?? 200));
      toast?.({ title: "Digest settings updated" });
    } catch (err) {
      toast?.({ title: "Failed to update", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const saveLimits = async () => {
    const days = Math.min(365, Math.max(14, Number(inactivityDays) || 90));
    const cap = Math.min(5000, Math.max(1, Number(maxSends) || 200));
    await save({ inactivity_days: days, max_sends_per_run: cap });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-mint-500" />
      </div>
    );
  }

  const paused = Boolean(config?.digests_paused);

  return (
    <>
      <AdminSectionHeader title="Digest Notification" icon={Mail} />
      <AdminPanelShell>
        <div className="space-y-6 max-w-xl">
          <p className="text-sm text-muted-foreground">
            Controls for Monday weekly activity digest emails. Digests only send when a user has Weekly on and matching new activities.
          </p>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
            <div>
              <p className="text-sm font-medium">Pause weekly digests</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                When on, the Monday cron sends no digest emails. Transactional emails (billing, waitlist) are unaffected.
              </p>
              {paused && config?.paused_at && (
                <p className="text-[11px] text-amber-700 mt-1">
                  Paused since {new Date(config.paused_at).toLocaleString()}
                </p>
              )}
            </div>
            <Switch
              checked={paused}
              disabled={saving}
              onCheckedChange={(v) => save({ digests_paused: v })}
            />
          </div>

          <div className="rounded-xl border border-border p-4 space-y-3">
            <p className="text-sm font-medium">Safeguard limits</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Auto-off after inactivity (days)</Label>
                <Input
                  className="mt-1 rounded-xl"
                  type="number"
                  min={14}
                  max={365}
                  value={inactivityDays}
                  onChange={(e) => setInactivityDays(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Max digests per Monday run</Label>
                <Input
                  className="mt-1 rounded-xl"
                  type="number"
                  min={1}
                  max={5000}
                  value={maxSends}
                  onChange={(e) => setMaxSends(e.target.value)}
                />
              </div>
            </div>
            <Button
              size="sm"
              className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
              onClick={saveLimits}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save limits
            </Button>
          </div>

          <div className="rounded-xl border border-border p-4 text-sm space-y-1">
            <p>
              <span className="font-medium">{stats.weekly}</span>{" "}
              <span className="text-muted-foreground">users with Weekly digests on</span>
            </p>
            <p>
              <span className="font-medium">{stats.suppressed}</span>{" "}
              <span className="text-muted-foreground">suppressed addresses (bounce / complaint / unsubscribe)</span>
            </p>
          </div>

          <div className="rounded-xl bg-muted/40 border border-border p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground text-sm">Also in place</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                Env kill switch: set <code className="text-[11px]">EMAIL_SENDING_ENABLED=false</code> in{" "}
                <strong className="font-medium text-foreground">Vercel → Project → Settings → Environment Variables</strong>
                {" "}(then redeploy). Stops all Resend email (digests + transactional). Omit or set to{" "}
                <code className="text-[11px]">true</code> for normal sending.
              </li>
              <li>Disabled accounts and inactive accounts (no sign-in within the days above) are skipped; inactive Weekly prefs are turned Off.</li>
              <li>Same-week retry protection via last-sent stamp; bounce/complaint webhooks suppress future mail.</li>
            </ul>
          </div>
        </div>
      </AdminPanelShell>
    </>
  );
}
