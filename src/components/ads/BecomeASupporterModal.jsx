import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, LogIn, UserPlus, Mail } from "lucide-react";

export default function BecomeASupporterModal({ open, onClose, user }) {
  const navigate = useNavigate();

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
            Supporter advertising signup is paused during our private beta while we finish payments and ad management on the new platform.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You can still invite businesses, read the tips, and contact us if you want to be notified when ads open.
          </p>

          <div className="flex flex-col gap-2">
            {!user && (
              <>
                <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={() => { onClose(); navigate("/login"); }}>
                  <LogIn className="w-4 h-4 mr-2" /> Log in
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => { onClose(); navigate("/register"); }}>
                  <UserPlus className="w-4 h-4 mr-2" /> Create an account
                </Button>
              </>
            )}
            <Button className="rounded-xl bg-peach-500 hover:bg-peach-400 text-white" onClick={() => { onClose(); navigate("/contact"); }}>
              <Mail className="w-4 h-4 mr-2" /> Contact us
            </Button>
            <Button variant="outline" className="rounded-xl" asChild>
              <Link to="/tips-supporters" onClick={onClose}>Tips for Supporters</Link>
            </Button>
            <Button variant="ghost" className="rounded-xl" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
