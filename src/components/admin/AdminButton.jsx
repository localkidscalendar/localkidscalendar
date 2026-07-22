import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

/**
 * Standardized action button patterns for admin panels.
 * 
 * Usage:
 * <AdminButton variant="primary" onClick={handleSave} loading={saving}>
 *   Save Changes
 * </AdminButton>
 * 
 * Variants:
 * - primary: Green mint button for main actions (save, approve, create)
 * - secondary: Outline button for secondary actions (edit, cancel)
 * - destructive: Red-toned button for delete/reject actions
 * - ghost: Minimal button for icon-only actions
 */
export function AdminButton({ variant = "primary", loading = false, children, onClick, disabled, size = "sm", className = "" }) {
  const baseClasses = "rounded-xl";
  
  const variantClasses = {
    primary: "bg-mint-500 hover:bg-mint-600 text-white",
    secondary: "border-border bg-white hover:bg-muted text-foreground",
    destructive: "bg-red-500 hover:bg-red-600 text-white",
    ghost: "hover:bg-accent text-muted-foreground hover:text-foreground",
    mint: "text-mint-600 border-mint-200 hover:bg-mint-50",
    peach: "text-peach-500 border-peach-200 hover:bg-peach-50",
  };

  return (
    <Button
      size={size}
      className={`${baseClasses} ${variantClasses[variant] || variantClasses.primary} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
      {children}
    </Button>
  );
}