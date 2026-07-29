import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import AccountDisabledView from "@/components/account/AccountDisabledView";
import { ACCOUNT_DISABLED_SCENARIOS } from "@/lib/accountDisabledScenarios";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function AccountDisabledPreview() {
  const navigate = useNavigate();
  const { user, authChecked, isLoadingAuth } = useAuth();
  const [scenarioId, setScenarioId] = useState("fresh");
  const scenario = ACCOUNT_DISABLED_SCENARIOS.find((s) => s.id === scenarioId) || ACCOUNT_DISABLED_SCENARIOS[0];

  useEffect(() => {
    if (!authChecked || isLoadingAuth) return;
    if (!user || user.role !== "admin") {
      navigate("/", { replace: true });
    }
  }, [authChecked, isLoadingAuth, user, navigate]);

  if (!authChecked || isLoadingAuth || !user || user.role !== "admin") {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-16 z-20 border-b border-border bg-background/95 backdrop-blur px-4 py-3">
        <div className="max-w-lg mx-auto">
          <p className="text-xs font-medium text-muted-foreground mb-2">Preview scenario</p>
          <div className="flex flex-wrap gap-1.5">
            {ACCOUNT_DISABLED_SCENARIOS.map((s) => (
              <Button
                key={s.id}
                type="button"
                size="sm"
                variant={scenarioId === s.id ? "default" : "outline"}
                className={`rounded-lg text-xs h-7 ${
                  scenarioId === s.id ? "bg-mint-500 hover:bg-mint-600 text-white" : ""
                }`}
                onClick={() => setScenarioId(s.id)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <AccountDisabledView
        key={scenarioId}
        user={{ id: "preview", email: "preview@example.com", full_name: "Preview User" }}
        preview={{
          scenarioLabel: scenario.label,
          disabledNote: scenario.disabledNote,
          disabledAt: scenario.disabledAt,
          request: scenario.request,
          senderName: "Preview User",
          senderEmail: "preview@example.com",
          senderPhone: "(555) 123-4567",
        }}
      />
    </div>
  );
}
