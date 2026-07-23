import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import Paginator, { PAGE_SIZE } from "@/components/admin/Paginator";

export default function AdminZipConfigPanel({ ads = [], toast }) {
  const [zipConfigs, setZipConfigs] = useState([]);
  const [zipSearch, setZipSearch] = useState("");
  const [newZip, setNewZip] = useState("");
  const [newSlots, setNewSlots] = useState(4);
  const [savingZip, setSavingZip] = useState(null);
  const [zipPage, setZipPage] = useState(1);

  useEffect(() => {
    loadZipConfigs();
  }, []);

  const loadZipConfigs = async () => {
    try {
      const { data: configs } = await supabase
        .from("ad_zip_config")
        .select("*")
        .order("zip_code", { ascending: true })
        .limit(200);
      setZipConfigs(configs || []);
    } catch {
      setZipConfigs([]);
    }
  };

  const handleAddZip = async () => {
    if (!newZip.trim() || newZip.length < 5) return;
    const trimmed = newZip.trim();
    const existing = zipConfigs.find((z) => z.zip_code === trimmed);
    if (existing) {
      toast?.({ title: `Zip ${trimmed} is already configured. Edit it in the list below.`, variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.from("ad_zip_config").insert({
        zip_code: trimmed,
        max_slots: newSlots,
      });
      if (error) throw error;
      toast?.({ title: `Zip ${trimmed} added with ${newSlots} slots` });
      setNewZip("");
      setNewSlots(4);
      loadZipConfigs();
    } catch (err) {
      toast?.({ title: "Failed to add zip", description: err.message, variant: "destructive" });
    }
  };

  const handleUpdateSlots = async (config, newMax) => {
    setSavingZip(config.id);
    try {
      const { error } = await supabase
        .from("ad_zip_config")
        .update({ max_slots: newMax, updated_at: new Date().toISOString() })
        .eq("id", config.id);
      if (error) throw error;
      setZipConfigs((prev) => prev.map((z) => (z.id === config.id ? { ...z, max_slots: newMax } : z)));
      toast?.({ title: `Updated ${config.zip_code} to ${newMax} slots` });
    } catch (err) {
      toast?.({ title: "Failed to update", description: err.message, variant: "destructive" });
    }
    setSavingZip(null);
  };

  const handleDeleteZip = async (config) => {
    if (!window.confirm(`Remove zip ${config.zip_code}? It will revert to the default (3 slots).`)) return;
    const { error } = await supabase.from("ad_zip_config").delete().eq("id", config.id);
    if (error) {
      toast?.({ title: "Failed to remove zip", description: error.message, variant: "destructive" });
      return;
    }
    setZipConfigs((prev) => prev.filter((z) => z.id !== config.id));
    toast?.({ title: `Zip ${config.zip_code} removed` });
  };

  const filteredZips = [...zipConfigs]
    .filter((z) => !zipSearch.trim() || z.zip_code.includes(zipSearch.trim()))
    .sort((a, b) => a.zip_code.localeCompare(b.zip_code));

  const zipPageData = filteredZips.slice((zipPage - 1) * PAGE_SIZE, zipPage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Default: <strong>3 slots per zip</strong> when no custom configuration is set. Use this list to raise capacity for specific zips.
      </p>

      <Input
        placeholder="Search by zip code…"
        maxLength={5}
        value={zipSearch}
        onChange={(e) => {
          setZipSearch(e.target.value.replace(/\D/g, ""));
          setZipPage(1);
        }}
        className="rounded-lg h-8 text-sm max-w-xs"
      />

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
        <Input
          placeholder="New zip…"
          maxLength={5}
          value={newZip}
          onChange={(e) => setNewZip(e.target.value.replace(/\D/g, ""))}
          className="rounded-xl w-28 h-8 text-sm"
        />
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-muted-foreground shrink-0">Max slots:</span>
          <Input
            type="number"
            min={4}
            max={20}
            value={newSlots}
            onChange={(e) => setNewSlots(Math.max(4, Number(e.target.value)))}
            className="rounded-xl w-16 text-center h-8 text-sm"
          />
        </div>
        <Button
          size="sm"
          className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white shrink-0 h-8"
          onClick={handleAddZip}
          disabled={newZip.length < 5 || !!zipConfigs.find((z) => z.zip_code === newZip.trim())}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Increase
        </Button>
      </div>
      {newZip.length > 0 && zipConfigs.find((z) => z.zip_code === newZip.trim()) && (
        <p className="text-xs text-peach-500">This zip is already configured — find it in the list below.</p>
      )}

      {zipConfigs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No custom zip configurations. All zips default to 3 slots.</p>
      ) : filteredZips.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No matching zip codes found.</p>
      ) : (
        <>
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {zipPageData.map((config) => {
              const isMatch = zipSearch.length >= 5 && config.zip_code === zipSearch.trim();
              return (
                <div
                  key={config.id}
                  className={`flex items-center gap-3 px-4 py-2.5 ${isMatch ? "bg-peach-50" : "bg-muted/20"}`}
                >
                  <span className={`font-medium text-sm w-20 ${isMatch ? "text-peach-600" : ""}`}>
                    {config.zip_code}
                  </span>
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-xs text-muted-foreground">Max slots:</span>
                    <Input
                      type="number"
                      min={4}
                      max={20}
                      value={config.max_slots}
                      onChange={(e) =>
                        setZipConfigs((prev) =>
                          prev.map((z) =>
                            z.id === config.id ? { ...z, max_slots: Math.max(4, Number(e.target.value)) } : z
                          )
                        )
                      }
                      onBlur={(e) => handleUpdateSlots(config, Math.max(4, Number(e.target.value)))}
                      className="rounded-lg w-16 text-center h-7 text-sm"
                      disabled={savingZip === config.id}
                    />
                    {savingZip === config.id && <span className="text-xs text-muted-foreground">Saving…</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {ads.filter((a) => a.zip_code === config.zip_code && a.status === "active").length} active
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleDeleteZip(config)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
          <Paginator total={filteredZips.length} page={zipPage} onPage={setZipPage} />
        </>
      )}
    </div>
  );
}
