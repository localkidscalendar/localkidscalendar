import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Mail, Eye, Send, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EMAIL_TEMPLATE_META, SAMPLE_DATA, buildEmail } from "@/lib/emailTemplates";
import { sendEmail } from "@/lib/sendEmail";
import { supabase } from "@/lib/supabaseClient";

export default function SiteEmailsTester() {
  const { toast } = useToast();
  const [selectedEmail, setSelectedEmail] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [useSampleData, setUseSampleData] = useState(true);
  const [sending, setSending] = useState(false);

  const getPreviewData = () => {
    if (!selectedEmail) return {};
    return useSampleData ? SAMPLE_DATA[selectedEmail] || {} : {};
  };

  const handlePreview = () => {
    if (!selectedEmail) {
      toast({ title: "Select a template", description: "Please choose an email template first.", variant: "destructive" });
      return;
    }

    try {
      const { subject, html } = buildEmail(selectedEmail, getPreviewData());
      setPreviewSubject(subject);
      setPreviewHtml(html);
      setShowPreview(true);
    } catch (err) {
      toast({ title: "Preview failed", description: err.message, variant: "destructive" });
    }
  };

  const handleSendTestToMe = async () => {
    if (!selectedEmail) {
      toast({ title: "Select a template", description: "Please choose an email template first.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.email) {
        throw new Error("Could not determine your signed-in email address.");
      }

      const { subject, html } = buildEmail(selectedEmail, getPreviewData());
      await sendEmail({ to: userData.user.email, subject, html });
      toast({
        title: "Test email sent",
        description: `Sent “${subject}” to ${userData.user.email}`,
      });
    } catch (err) {
      toast({
        title: "Send failed",
        description: err.message || "Could not send test email.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-mint-100 flex items-center justify-center">
          <Mail className="w-4 h-4 text-mint-500" />
        </div>
        <div>
          <h2 className="font-heading font-semibold text-base">Site Emails</h2>
          <p className="text-xs text-muted-foreground">Preview system-generated emails with realistic sample data.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1">Email Type *</label>
          <Select value={selectedEmail} onValueChange={(val) => { setSelectedEmail(val); setUseSampleData(true); }}>
            <SelectTrigger className="rounded-xl max-w-md">
              <SelectValue placeholder="Select an email template" />
            </SelectTrigger>
            <SelectContent>
              {EMAIL_TEMPLATE_META.map((template) => (
                <SelectItem key={template.value} value={template.value}>
                  {template.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">Choose the type of email to preview.</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              id="sample-data-toggle"
              checked={useSampleData}
              onCheckedChange={setUseSampleData}
              disabled={!selectedEmail}
            />
            <label htmlFor="sample-data-toggle" className="text-sm font-medium cursor-pointer">
              Use Sample Data
            </label>
            <p className="text-xs text-muted-foreground">
              {useSampleData
                ? "(shows realistic business names, dates, etc.)"
                : "(shows generic placeholders)"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!selectedEmail}
              onClick={handlePreview}
              className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview Email
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!selectedEmail || sending}
              onClick={handleSendTestToMe}
              className="rounded-xl"
            >
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send test to me
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-heading font-semibold text-sm mb-3">All Email Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...EMAIL_TEMPLATE_META].sort((a, b) => a.label.localeCompare(b.label)).map((template) => (
            <button
              key={template.value}
              type="button"
              onClick={() => { setSelectedEmail(template.value); setUseSampleData(true); }}
              className={`text-left p-3 rounded-xl border transition-all ${
                selectedEmail === template.value
                  ? "border-mint-500 bg-mint-50"
                  : "border-border bg-white hover:border-mint-200"
              }`}
            >
              <p className="font-medium text-sm">{template.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{template.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 bg-muted/40 rounded-xl p-4 text-xs text-muted-foreground space-y-2">
        <p><strong>How it works:</strong></p>
        <ol className="list-decimal list-inside space-y-1 ml-2">
          <li>Select an email template from the list or dropdown</li>
          <li>Toggle <strong>Use Sample Data</strong> ON to see realistic content, or OFF to see generic placeholders</li>
          <li>Click <strong>Preview Email</strong> to view in the dialog</li>
          <li>Click <strong>Send test to me</strong> to deliver the built email to your signed-in admin address via Resend</li>
        </ol>
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview{previewSubject ? `: ${previewSubject}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 border rounded-lg p-4 bg-white">
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
