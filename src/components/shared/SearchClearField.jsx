import React from "react";
import { Input } from "@/components/ui/input";

/**
 * Text input with a Clear control when the field has text.
 * Matches Admin → Users list search UX.
 */
export default function SearchClearField({
  value,
  onValueChange,
  placeholder,
  wrapperClassName = "flex items-center gap-2 w-full sm:max-w-xs",
  inputClassName = "rounded-lg h-8 text-sm flex-1 min-w-0",
  leading = null,
  clearLabel = "Clear",
  ...inputProps
}) {
  const hasValue = String(value || "").trim().length > 0;
  const input = (
    <Input
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      placeholder={placeholder}
      className={leading ? `${inputClassName} pl-9` : inputClassName}
      {...inputProps}
    />
  );

  return (
    <div className={wrapperClassName}>
      {leading ? (
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
            {leading}
          </span>
          {input}
        </div>
      ) : (
        input
      )}
      {hasValue ? (
        <button
          type="button"
          className="shrink-0 text-xs font-medium text-mint-600 hover:underline"
          onClick={() => onValueChange("")}
        >
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
}
