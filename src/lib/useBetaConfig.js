// BETA MODE — temporary controls, safe to delete with BetaBanner / AdminBetaPanel / Stage1Gate.
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export {
  BETA_ZIPS_HIDDEN_FROM_DISPLAY,
  sortBetaZips,
  betaZipsForDisplay,
  isZipAllowed,
  betaZipBlockedCopy,
} from "@/lib/betaZipDisplay.js";

export default function useBetaConfig() {
  const [config, setConfig] = useState({
    enabled: false,
    stage1_enabled: false,
    access_code: "",
    zip_codes: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("beta_config")
          .select("*")
          .eq("config_key", "global")
          .maybeSingle();
        if (error) throw error;
        if (!cancelled && data) {
          setConfig({
            ...data,
            zip_codes: Array.isArray(data.zip_codes) ? data.zip_codes : [],
          });
        }
      } catch {
        // Leave defaults (beta off) if table/config is missing
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return { ...config, loading };
}
