// BETA MODE — temporary admin controls, safe to remove along with useBetaConfig.js and BetaBanner.jsx
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, X, Plus, RefreshCw } from "lucide-react";

export default function AdminBetaPanel({ toast }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newZip, setNewZip] = useState("");
  const [codeInput, setCodeInput] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.BetaConfig.filter({ config_key: "global" });
      if (rows.length > 0) {
        setConfig(rows[0]);
        setCodeInput(rows[0].access_code || "");
      } else {
        const created = await base44.entities.BetaConfig.create({ config_key: "global", enabled: true, zip_codes: [], stage1_enabled: false, access_code: "" });
        setConfig(created);
      }
    } catch {}
    setLoading(false);
  };

  const save = async (updates) => {
    setSaving(true);
    try {
      const updated = await base44.entities.BetaConfig.update(config.id, updates);
      setConfig(updated);
      toast?.({ title: "Beta settings updated" });
    } catch {
      toast?.({ title: "Failed to update", variant: "destructive" });
    }
    setSaving(false);
  };

  const addZip = () => {
    const zip = newZip.trim();
    if (zip.length !== 5) return;
    if (config.zip_codes.includes(zip)) { setNewZip(""); return; }
    save({ zip_codes: [...config.zip_codes, zip] });
    setNewZip("");
  };

  const removeZip = (zip) => {
    save({ zip_codes: config.zip_codes.filter((z) => z !== zip) });
  };

  const generateCode = () => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    setCodeInput(code);
    save({ access_code: code });
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-mint-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stage 1: site-wide access code gate */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Enable Beta Mode Stage 1</p>
          <Switch checked={!!config.stage1_enabled} disabled={saving} onCheckedChange={(v) => save({ stage1_enabled: v })} />
        </div>
        <p className="text-xs text-muted-foreground">
          When enabled, every visitor (regardless of account or login status) must enter the access code below before they can view any part of the site.
        </p>
        <div>
          <label className="text-sm font-medium block mb-2">Access Code</label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. LKC2026"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save({ access_code: codeInput.trim() }); }}
              className="rounded-xl"
            />
            <Button
              variant="outline"
              className="rounded-xl shrink-0"
              onClick={() => save({ access_code: codeInput.trim() })}
              disabled={saving || codeInput.trim() === (config.access_code || "")}
              title="Save custom code"
            >
              Save
            </Button>
            <Button
              variant="outline"
              className="rounded-xl shrink-0"
              onClick={generateCode}
              disabled={saving}
              title="Generate a new random code"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Type any custom code and click Save, or generate a random one. The code is case sensitive — visitors must enter it exactly as shown.
          </p>
          {!config.access_code && (
            <p className="text-xs text-muted-foreground mt-1">No access code set — Stage 1 will not block visitors until a code is added.</p>
          )}
        </div>
      </div>

      {/* Stage 2: zip-code limited beta */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Enable Beta Mode Stage 2</p>
          <Switch checked={!!config.enabled} disabled={saving} onCheckedChange={(v) => save({ enabled: v })} />
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">Allowed Zip Codes</label>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="89448"
              maxLength={5}
              value={newZip}
              onChange={(e) => setNewZip(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addZip(); }}
              className="rounded-xl"
            />
            <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white shrink-0" onClick={addZip} disabled={saving || newZip.trim().length !== 5}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {config.zip_codes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No zip codes added — beta mode has no restriction until you add at least one.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {config.zip_codes.map((z) => (
                <span key={z} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-mint-50 text-mint-600 text-sm font-medium">
                  {z}
                  <button onClick={() => removeZip(z)} className="hover:text-mint-800">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}