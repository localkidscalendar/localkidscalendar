import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Mail, Facebook, Twitter, MessageSquare } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function ShareModal({ open, onOpenChange, url, title }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const shareUrl = url || window.location.href;
  const shareTitle = title || "Check out this event on LocalKidsCalendar.com";

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({ title: "Link copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOptions = [
    { label: "Email", icon: Mail, href: `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareUrl)}` },
    { label: "Facebook", icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
    { label: "X / Twitter", icon: Twitter, href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}` },
    { label: "Text", icon: MessageSquare, href: `sms:?body=${encodeURIComponent(shareTitle + " " + shareUrl)}` },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Share</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-3 my-4">
          {shareOptions.map((opt) => (
            <a key={opt.label} href={opt.href} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-colors">
              <div className="w-10 h-10 rounded-full bg-mint-50 flex items-center justify-center">
                <opt.icon className="w-5 h-5 text-mint-500" />
              </div>
              <span className="text-xs text-muted-foreground">{opt.label}</span>
            </a>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={shareUrl} readOnly className="rounded-xl text-sm" />
          <Button variant="outline" size="icon" className="rounded-xl shrink-0" onClick={copyToClipboard}>
            {copied ? <Check className="w-4 h-4 text-mint-500" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}