import React from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus, Lock } from "lucide-react";

export default function AuthPromptModal({ open, onOpenChange, message = "Sign in to continue." }) {
  const navigate = useNavigate();

  const handleSignIn = () => {
    onOpenChange(false);
    navigate("/login");
  };

  const handleRegister = () => {
    onOpenChange(false);
    navigate("/register");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-2xl text-center p-8">
        <div className="w-14 h-14 rounded-2xl bg-mint-50 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7 text-mint-500" />
        </div>
        <h2 className="font-heading font-bold text-xl mb-2">Sign In Required</h2>
        <p className="text-sm text-muted-foreground mb-6">{message}</p>
        <div className="flex flex-col gap-3">
          <Button className="w-full rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={handleSignIn}>
            <LogIn className="w-4 h-4 mr-2" /> Sign In
          </Button>
          <Button variant="outline" className="w-full rounded-xl" onClick={handleRegister}>
            <UserPlus className="w-4 h-4 mr-2" /> Create a Free Account
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}