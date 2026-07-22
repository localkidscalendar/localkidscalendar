// BETA MODE — temporary access gate, safe to remove along with the Stage 1 fields
// on BetaConfig and the Stage 1 section in AdminBetaPanel.jsx
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

const STORAGE_KEY = "beta_stage1_access_code";

export default function BetaStage1Gate({ children }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    base44.entities.BetaConfig.filter({ config_key: "global" })
      .then((rows) => setConfig(rows[0] || null))
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!config) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && config.access_code && stored === config.access_code) setVerified(true);
    } catch {}
  }, [config]);

  if (loading) return null;
  if (!config?.stage1_enabled || !config?.access_code) return children;
  if (verified) return children;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() === config.access_code) {
      try { localStorage.setItem(STORAGE_KEY, input.trim()); } catch {}
      setVerified(true);
      setError("");
    } else {
      setError("Incorrect access code.");
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background px-4 z-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl border border-border p-6 space-y-4">
        <div>
          <h1 className="font-heading font-bold text-xl mb-1">Private Preview</h1>
          <p className="text-sm text-muted-foreground">Enter the access code to continue.</p>
        </div>
        <input
          type="text"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Access code"
          className="w-full px-3 py-2 rounded-xl border border-input bg-white text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button type="submit" className="w-full rounded-xl bg-mint-500 hover:bg-mint-600 text-white text-sm font-medium py-2 transition-colors">
          Enter
        </button>
      </form>
    </div>
  );
}