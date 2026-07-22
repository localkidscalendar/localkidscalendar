import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Mail, AlertCircle, CheckCircle2 } from "lucide-react";

const SUBJECTS = [
  "Report Technical Issues",
  "Submit New Ideas & Suggestions",
  "Inquire About Activity Details",
  "General Questions",
];

export default function ContactUs() {
  const { user } = useOutletContext();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showActivityWarning, setShowActivityWarning] = useState(false);
  const [senderPhone, setSenderPhone] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [hpField, setHpField] = useState(""); // honeypot - real users never fill this
  const [formLoadTime] = useState(() => Date.now());

  useEffect(() => {
    if (user) {
      const loadContactInfo = async () => {
        if (user?.role === "organizer") {
          try {
            const org = await base44.entities.Organizer.filter({ user_id: user.id });
            if (org.length > 0) {
              setSenderName(org[0].org_name || "");
              setSenderEmail(user.email || "");
            }
          } catch {}
        } else {
          const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.full_name || "";
          setSenderName(name);
          setSenderEmail(user.email || "");
        }
      };
      loadContactInfo();
    }
  }, [user]);

  const handleSubjectChange = (val) => {
    setSubject(val);
    setShowActivityWarning(val === "Inquire About Activity Details");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (showActivityWarning) return;
    if (!subject || !message.trim()) {
      toast({ title: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    if (!user) {
      if (!senderName.trim() || !senderEmail.trim() || !senderPhone.trim()) {
        toast({ title: "Please fill in all required fields.", variant: "destructive" });
        return;
      }
    }
    // Bot protection: honeypot field must stay empty, and a human can't fill this out in under 2 seconds
    if (hpField || Date.now() - formLoadTime < 2000) {
      setSubmitted(true);
      return;
    }
    setSubmitting(true);
    try {
      await base44.entities.ContactMessage.create({
        sender_name: senderName || "",
        sender_email: senderEmail || "",
        sender_phone: senderPhone || "",
        subject,
        message,
        status: "unread",
      });
      setSubmitted(true);
    } catch {
      toast({ title: "Something went wrong. Please try again.", variant: "destructive" });
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <CheckCircle2 className="w-12 h-12 text-mint-500 mx-auto mb-4" />
        <h2 className="font-heading font-bold text-2xl mb-2">Message Sent!</h2>
        <p className="text-muted-foreground">Thanks for reaching out. We'll get back to you as soon as we can.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-mint-100 flex items-center justify-center">
          <Mail className="w-5 h-5 text-mint-500" />
        </div>
        <div>
          <h1 className="font-heading font-bold text-2xl">Contact Us</h1>
          <p className="text-sm text-muted-foreground">We'd love to hear from you</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-6">
        {user ? (
          <p className="text-sm text-muted-foreground mb-6">
            Your contact information is pulled from your account automatically. Fill in the subject and your message below.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mb-6">
            Fill in your contact information and message below. All fields marked with * are required.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Honeypot field - hidden from real users, bots often fill every field */}
          <div className="absolute left-[-9999px]" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={hpField}
              onChange={(e) => setHpField(e.target.value)}
            />
          </div>
          {/* Contact fields - editable for non-logged-in users */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm">Name {user ? "" : "*"}</Label>
              <Input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                readOnly={!!user}
                className="rounded-xl mt-1"
                placeholder={user ? "" : "Your name"}
              />
            </div>
            <div>
              <Label className="text-sm">Email {user ? "" : "*"}</Label>
              <Input
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                readOnly={!!user}
                className="rounded-xl mt-1"
                placeholder={user ? "" : "your@email.com"}
                type="email"
              />
            </div>
          </div>
          <div>
            <Label className="text-sm">Phone {user ? "(optional)" : "*"}</Label>
            <Input
              value={senderPhone}
              onChange={(e) => setSenderPhone(e.target.value)}
              readOnly={!!user}
              className="rounded-xl mt-1"
              placeholder={user ? "Not provided" : "Your phone number"}
            />
          </div>

          {/* Subject */}
          <div>
            <Label className="text-sm">Subject *</Label>
            <Select value={subject} onValueChange={handleSubjectChange}>
              <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Select a topic..." /></SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Activity inquiry warning */}
          {showActivityWarning && (
            <div className="flex items-start gap-3 bg-peach-50 border border-peach-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-5 h-5 text-peach-500 shrink-0 mt-0.5" />
              <p className="text-sm text-peach-500">
                <strong>Heads up!</strong> LocalKidsCalendar.com is not associated with the activity, just helping distribute information about it. Please contact the contributor of the activity directly. Thanks!
              </p>
            </div>
          )}

          {/* Message */}
          <div>
            <Label className="text-sm">Message *</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="rounded-xl mt-1 min-h-[120px]"
              placeholder="Write your message here..."
              disabled={showActivityWarning}
            />
          </div>

          <Button
            type="submit"
            className="w-full rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
            disabled={submitting || showActivityWarning}
          >
            {submitting ? "Sending..." : "Send Message"}
          </Button>
        </form>
      </div>
    </div>
  );
}