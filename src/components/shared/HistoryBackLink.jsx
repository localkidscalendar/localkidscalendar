import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canNavigateBack } from "@/lib/navigationHistory";

/**
 * Top-of-page Back control that returns to the prior in-app page.
 * Hidden when the user landed directly (no prior history entry).
 */
export default function HistoryBackLink({
  label = "Back",
  variant = "link",
  className,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasPriorPage = canNavigateBack() || Boolean(location.state?.fromApp);

  if (!hasPriorPage) return null;

  const text = location.state?.backLabel || label;

  const goBack = () => {
    if (location.state?.returnTo) {
      navigate(location.state.returnTo);
      return;
    }
    navigate(-1);
  };

  if (variant === "button") {
    return (
      <Button
        type="button"
        variant="ghost"
        className={className || "mb-4 rounded-xl text-sm"}
        onClick={goBack}
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> {text}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={
        className ||
        "inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-mint-500 mb-6 transition-colors"
      }
    >
      <ArrowLeft className="w-4 h-4" /> {text}
    </button>
  );
}
