import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, LogIn, UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";

export default function BecomeASupporterModal({ open, onClose, user }) {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const becomeSupporter = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      if (!user.is_advertiser) {
        const { error } = await supabase.from("profiles").update({
          is_advertiser: true,
          updated_at: new Date().toISOString(),
        }).eq("id", user.id);
        if (error) throw error;
        setUser((prev) => (prev ? { ...prev, is_advertiser: true } : prev));
      }
      onClose();
      navigate("/ad-manager");
    } catch (err) {
      toast({
        title: "Could not enable Supporter access",
        description: err.message,
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Heart className="w-5 h-5 text-peach-500" />
            Become a Supporter
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Becoming a Supporter adds Ad Manager to your account menu so you can upload creatives and request zip placements.
            During beta, billing is waived and an admin activates approved ads.
          </p>
          <div className="flex flex-col gap-2">
            {!user ? (
              <>
                <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={() => { onClose(); navigate("/login"); }}>
                  <LogIn className="w-4 h-4 mr-2" /> Log in
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => { onClose(); navigate("/register"); }}>
                  <UserPlus className="w-4 h-4 mr-2" /> Create an account
                </Button>
              </>
            ) : (
              <Button
                className="rounded-xl bg-peach-500 hover:bg-peach-400 text-white"
                disabled={saving}
                onClick={becomeSupporter}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Heart className="w-4 h-4 mr-2" />}
                {user.is_advertiser ? "Open Ad Manager" : "Become a Supporter"}
              </Button>
            )}
            <Button variant="ghost" className="rounded-xl" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
