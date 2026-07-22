// BETA MODE — temporary controls, safe to delete this file along with:
// src/components/beta/BetaBanner.jsx, src/components/admin/AdminBetaPanel.jsx,
// base44/entities/BetaConfig.jsonc, and the Beta tab in src/pages/Admin.jsx,
// plus the isZipAllowed() checks in Home.jsx, PostEvent.jsx, and AdSubmissionForm.jsx.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export default function useBetaConfig() {
  const [config, setConfig] = useState({ enabled: false, zip_codes: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.BetaConfig.filter({ config_key: "global" })
      .then((rows) => { if (rows[0]) setConfig(rows[0]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { ...config, loading };
}

// Returns true if the zip is allowed under current beta restrictions.
// If beta mode is off, or no zip list has been configured, everything is allowed.
export function isZipAllowed(zip, betaConfig) {
  if (!betaConfig || !betaConfig.enabled) return true;
  if (!betaConfig.zip_codes || betaConfig.zip_codes.length === 0) return true;
  return betaConfig.zip_codes.includes(zip);
}