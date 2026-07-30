import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Mail, Facebook, Twitter, MessageSquare, Share2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

function isMobileUa() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
}

async function shareNative({ title, url }) {
  if (!navigator.share) return false;
  try {
    await navigator.share({ title, text: title, url });
    return true;
  } catch (err) {
    if (err?.name === "AbortError") return true;
    return false;
  }
}

function facebookSharerUrl(shareUrl) {
  // m.facebook.com is more reliable on phones than www + target=_blank
  // (the FB app often hijacks www links and drops the shared URL).
  const base = isMobileUa()
    ? "https://m.facebook.com/sharer.php"
    : "https://www.facebook.com/sharer/sharer.php";
  return `${base}?u=${encodeURIComponent(shareUrl)}`;
}

export default function ShareModal({ open, onOpenChange, url, title }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const shareTitle = title || "Check out this event on LocalKidsCalendar.com";
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({ title: "Link copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const openFacebookShare = (e) => {
    e.preventDefault();
    const sharer = facebookSharerUrl(shareUrl);
    if (isMobileUa()) {
      // Same-tab navigation: new tabs get claimed by the FB app without the share payload.
      window.location.assign(sharer);
      return;
    }
    window.open(sharer, "_blank", "noopener,noreferrer");
  };

  const openNativeShare = async (e) => {
    e.preventDefault();
    const ok = await shareNative({ title: shareTitle, url: shareUrl });
    if (!ok) {
      toast({
        title: "Share unavailable",
        description: "Copy the link below instead.",
        variant: "destructive",
      });
    }
  };

  const shareOptions = [
    {
      label: "Email",
      icon: Mail,
      href: `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: "Facebook",
      icon: Facebook,
      href: facebookSharerUrl(shareUrl),
      onClick: openFacebookShare,
    },
    {
      label: "X / Twitter",
      icon: Twitter,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: "Text",
      icon: MessageSquare,
      href: `sms:?&body=${encodeURIComponent(`${shareTitle} ${shareUrl}`)}`,
    },
  ];

  if (canNativeShare) {
    shareOptions.push({
      label: "More",
      icon: Share2,
      href: "#",
      onClick: openNativeShare,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Share</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-3 my-4">
          {shareOptions.map((opt) => (
            <a
              key={opt.label}
              href={opt.href}
              target={opt.onClick ? undefined : "_blank"}
              rel={opt.onClick ? undefined : "noopener noreferrer"}
              onClick={opt.onClick}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-colors"
            >
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
