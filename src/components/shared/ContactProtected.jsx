import React, { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function ContactProtected({ value, type = "email" }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!value) return null;

  const masked = type === "email"
    ? value.replace(/(.{2})(.*)(@.*)/, "$1***$3")
    : value.replace(/(\d{3})\d{4}(\d{3,4})/, "$1****$2");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
            <span className="truncate">{revealed ? value : masked}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={(e) => { e.stopPropagation(); setRevealed(!revealed); }}>
              {revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCopy} title="Copy to clipboard">
              {copied ? <Check className="w-3 h-3 text-mint-500" /> : <Copy className="w-3 h-3" />}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{revealed ? "Hide contact info" : "Click to reveal"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}