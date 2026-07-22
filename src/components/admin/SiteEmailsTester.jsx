import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Mail, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Realistic sample data for each email template
const SAMPLE_DATA = {
  subscription_renewing_soon: {
    business_name: "Mountain Kids Soccer Club",
    renewal_date: "July 30, 2026",
    zip_code: "89448",
    plan_type: "Annual",
    rate: "1260"
  },
  subscription_renewed: {
    business_name: "Happy Tots Daycare",
    amount: "150",
    zip_code: "89449"
  },
  subscription_payment_failed: {
    business_name: "Summer Camp Adventures"
  },
  waitlist_spot_available: {
    business_name: "Little Stars Learning Center",
    zip_code: "89448",
    expiry_date: "July 7, 2026",
    plan_type: "Monthly",
    rate: "150"
  },
  ad_removed_flagged: {
    business_name: "Kids Activity Zone",
    reason: "Ad content flagged by 3+ community members for policy review"
  },
  ad_flagged_admin: {
    business_name: "Kids Activity Zone",
    zip_code: "89448",
    reason: "The destination link redirected to an unrelated third-party promotion."
  },
  ad_deactivated_admin: {
    business_name: "Little Explorers Gym",
    zip_code: "89449",
    reason: "The ad image did not meet our resolution and quality guidelines."
  },
  activity_removed_admin: {
    contributor_name: "Jamie Rodriguez",
    activity_title: "Summer Soccer Camp",
    reason: "The listed registration link was broken and could not be verified."
  },
  activity_photo_approved_admin: {
    contributor_name: "Jamie Rodriguez",
    activity_title: "Summer Soccer Camp"
  },
  activity_photo_declined_admin: {
    contributor_name: "Jamie Rodriguez",
    activity_title: "Summer Soccer Camp",
    reason: "The photo appeared blurry and did not clearly represent the activity."
  },
  activity_digest: {
    ads: [
      { image_url: "https://images.unsplash.com/photo-1560089000-7433a4ebbd64?w=600", link_url: "#" },
      { image_url: "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=600", link_url: "#" }
    ],
    user_name: "Sarah",
    event1_title: "Summer Soccer Camp",
    event1_org: "Mountain Kids Soccer Club",
    event1_date: "July 15, 2026",
    event1_location: "Las Vegas, NV",
    event1_ages: "Ages 5–12",
    event1_cost: "$75",
    event2_title: "Art & Crafts Workshop",
    event2_org: "Little Stars Learning Center",
    event2_date: "July 18, 2026",
    event2_location: "Henderson, NV",
    event2_ages: "Ages 6–10",
    event2_cost: "$25",
    event3_title: "Youth Basketball League",
    event3_org: "Happy Tots Daycare",
    event3_date: "July 22, 2026",
    event3_location: "North Las Vegas, NV",
    event3_ages: "Ages 7–14",
    event3_cost: "Free"
  }
};

// Email Template Naming Convention:
// Format: [Category] - [Specific Purpose] - [Frequency/Timing if applicable]
// Categories: Advertiser, Community, System, Waitlist
const EMAIL_TEMPLATES = [
  { value: "ad_removed_flagged", label: "Advertiser - Ad Removed (Flagged)", desc: "Sent when ad is removed due to community flags" },
  { value: "ad_flagged_admin", label: "Advertiser - Ad Flagged (Admin Reason)", desc: "Sent when Admin flags an ad with an explanation" },
  { value: "ad_deactivated_admin", label: "Advertiser - Ad Deactivated (Admin Reason)", desc: "Sent when Admin deactivates an ad with an explanation" },
  { value: "activity_removed_admin", label: "Community - Activity Removed (Admin Reason)", desc: "Sent when Admin removes a posted activity with an explanation" },
  { value: "activity_photo_approved_admin", label: "Community - Activity Photo Approved (Manual Review)", desc: "Sent when Admin manually approves an activity photo" },
  { value: "activity_photo_declined_admin", label: "Community - Activity Photo Declined (Manual Review)", desc: "Sent when Admin manually declines an activity photo with an explanation" },
  { value: "subscription_payment_failed", label: "Advertiser - Subscription Payment Failed", desc: "Sent when renewal payment fails" },
  { value: "subscription_renewed", label: "Advertiser - Subscription Renewed", desc: "Sent after successful renewal payment" },
  { value: "subscription_renewing_soon", label: "Advertiser - Subscription Renewing Soon", desc: "Sent 21 days before auto-renewal" },
  { value: "waitlist_spot_available", label: "Advertiser - Spot Available", desc: "Sent when a zip code spot opens up" },
  { value: "activity_digest", label: "Notification - Activity Digest (Weekly)", desc: "Curated weekly event digest for community members" },
];

export default function SiteEmailsTester() {
  const { toast } = useToast();
  const [selectedEmail, setSelectedEmail] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [useSampleData, setUseSampleData] = useState(true);

  const getPreviewData = () => {
    if (!selectedEmail) return {};
    return useSampleData ? SAMPLE_DATA[selectedEmail] : {};
  };

  const handlePreview = () => {
    if (!selectedEmail) {
      toast({ title: "Select a template", description: "Please choose an email template first.", variant: "destructive" });
      return;
    }

    const data = getPreviewData();

    const adsList = data.ads && data.ads.length > 0
      ? data.ads
      : (data.ad_image_url ? [{ image_url: data.ad_image_url, link_url: data.ad_link_url }] : []);
    const adsHtml = adsList.length === 0 ? '' : `
      <div style="margin-top:8px;margin-bottom:16px;">
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Supporters</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          ${adsList.map((ad) => `
            <td style="padding:0 4px;" valign="top">
              <a href="${ad.link_url || '#'}" style="display:block;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
                <img src="${ad.image_url}" alt="Supporter ad" style="width:100%;display:block;" />
              </a>
            </td>
          `).join('')}
        </tr></table>
      </div>
    `;

    const templates = {
      subscription_renewing_soon: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
          <h2 style="color: #2D7A3E;">Your Supporter Ad is Renewing Soon</h2>
          <p>Hi ${data.business_name || 'Supporter'},</p>
          <p>This is a friendly reminder that your Supporter advertising plan is scheduled to renew on <strong>${data.renewal_date || 'MM/DD/YYYY'}</strong>.</p>
          <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Plan Details:</strong></p>
            <ul>
              <li>Zip Code: ${data.zip_code || '89448'}</li>
              <li>Plan Type: ${data.plan_type || 'Monthly'}</li>
              <li>Renewal Rate: $${data.rate || '150'}</li>
            </ul>
          </div>
          <p>Your ad will continue running seamlessly.</p>
        </div>
      `,
      subscription_renewed: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
          <h2 style="color: #2D7A3E;">Payment Successful - Ad Renewed!</h2>
          <p>Hi ${data.business_name || 'Supporter'},</p>
          <p>Great news! Your Supporter advertising plan has been successfully renewed.</p>
          <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Payment Confirmation:</strong></p>
            <ul>
              <li>Amount Charged: $${data.amount || '150'}</li>
              <li>Zip Code: ${data.zip_code || '89448'}</li>
            </ul>
          </div>
        </div>
      `,
      subscription_payment_failed: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
          <h2 style="color: #D97706;">Payment Past Due - Action Required</h2>
          <p>Hi ${data.business_name || 'Supporter'},</p>
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D97706;">
            <p><strong>Action needed:</strong> Update your payment method to restore your ad.</p>
          </div>
        </div>
      `,
      waitlist_spot_available: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
          <h2 style="color: #2D7A3E;">A Spot Has Opened Up in ${data.zip_code || '89448'}!</h2>
          <p>Hi ${data.business_name || 'Supporter'},</p>
          <p>A Supporter advertising spot has become available in zip code <strong>${data.zip_code || '89448'}</strong>.</p>
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D97706;">
            <p><strong>Offer expires:</strong> ${data.expiry_date || 'MM/DD/YYYY'}</p>
          </div>
        </div>
      `,
      ad_removed_flagged: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
          <h2 style="color: #DC2626;">Ad Removal Notice</h2>
          <p>Hi ${data.business_name || 'Supporter'},</p>
          <p>Your Supporter ad has been removed from LocalKidsCalendar due to community flagging or policy concerns.</p>
          <div style="background: #fee; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
            <p><strong>Reason:</strong> ${data.reason || 'Content flagged by community members'}</p>
          </div>
          <p><strong>What happens next:</strong></p>
          <ul>
            <li>Your subscription remains active</li>
            <li>You can submit a replacement ad that meets our community standards</li>
            <li>Replacement ads undergo manual review before going live</li>
          </ul>
        </div>
      `,
      ad_flagged_admin: `
        <div style="font-family:sans-serif;color:#1a2332;line-height:1.6;padding:20px;">
          <h2 style="margin:0 0 12px;">Your ad was flagged</h2>
          <p>Hi ${data.business_name || 'Supporter'},</p>
          <p>Your Supporter ad for zip code <strong>${data.zip_code || '89448'}</strong> has been flagged by our Admin team.</p>
          <p><strong>Reason:</strong> ${data.reason || 'Policy concern identified during review'}</p>
          <p>Your subscription remains active. Please visit your Ad Manager to submit a corrected ad creative and restore your ad.</p>
          <p><a href="https://app.localkidscalendar.com/ad-manager" style="display:inline-block;background:#2D7A3E;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Go to Ad Manager</a></p>
        </div>
      `,
      ad_deactivated_admin: `
        <div style="font-family:sans-serif;color:#1a2332;line-height:1.6;padding:20px;">
          <h2 style="margin:0 0 12px;">Your ad was deactivated</h2>
          <p>Hi ${data.business_name || 'Supporter'},</p>
          <p>Your Supporter ad for zip code <strong>${data.zip_code || '89448'}</strong> has been deactivated by our Admin team.</p>
          <p><strong>Reason:</strong> ${data.reason || 'Policy concern identified during review'}</p>
          <p>Your subscription remains active. Please visit your Ad Manager to submit a corrected ad creative and restore your ad.</p>
          <p><a href="https://app.localkidscalendar.com/ad-manager" style="display:inline-block;background:#2D7A3E;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Go to Ad Manager</a></p>
        </div>
      `,
      activity_removed_admin: `
        <div style="font-family:sans-serif;color:#1a2332;line-height:1.6;padding:20px;">
          <h2 style="margin:0 0 12px;">Your activity was removed</h2>
          <p>Hi ${data.contributor_name || 'there'},</p>
          <p>Your posted activity "<strong>${data.activity_title || 'Summer Soccer Camp'}</strong>" has been removed from LocalKidsCalendar by our Admin team.</p>
          <p><strong>Reason:</strong> ${data.reason || 'Policy concern identified during review'}</p>
          <p>You can view this note on your Account page under My Posts. If you believe this was a mistake, please contact us.</p>
          <p><a href="https://app.localkidscalendar.com/account" style="display:inline-block;background:#2D7A3E;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Go to My Account</a></p>
        </div>
      `,
      activity_photo_approved_admin: `
        <div style="font-family:sans-serif;color:#1a2332;line-height:1.6;padding:20px;">
          <h2 style="margin:0 0 12px;">Your activity photo was approved</h2>
          <p>Hi ${data.contributor_name || 'there'},</p>
          <p>The photo you uploaded for your activity "<strong>${data.activity_title || 'Summer Soccer Camp'}</strong>" has been manually reviewed by our Admin team and approved.</p>
          <p>Your photo is now live on the listing.</p>
          <p><a href="https://app.localkidscalendar.com/account" style="display:inline-block;background:#2D7A3E;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Go to My Account</a></p>
        </div>
      `,
      activity_photo_declined_admin: `
        <div style="font-family:sans-serif;color:#1a2332;line-height:1.6;padding:20px;">
          <h2 style="margin:0 0 12px;">Your activity photo was declined</h2>
          <p>Hi ${data.contributor_name || 'there'},</p>
          <p>The photo you uploaded for your activity "<strong>${data.activity_title || 'Summer Soccer Camp'}</strong>" has been manually reviewed by our Admin team and was not approved.</p>
          <p><strong>Reason:</strong> ${data.reason || 'Did not meet our community guidelines.'}</p>
          <p>Please edit your activity to upload a different photo. Your activity remains live in the meantime.</p>
          <p><a href="https://app.localkidscalendar.com/account" style="display:inline-block;background:#2D7A3E;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Go to My Account</a></p>
        </div>
      `,
      activity_digest: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
        <body style="margin:0;padding:0;background:#f8f9fa;font-family:'Nunito',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#374151;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 16px;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
                <tr><td style="background:#2D7A3E;padding:32px 24px;text-align:center;">
                  <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">LocalKidsCalendar</h1>
                  <p style="margin:8px 0 0;color:#C9E8D8;font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">Weekly Activity Digest</p>
                </td></tr>
                <tr><td style="background:#fff;padding:24px 24px;border-bottom:1px solid #e5e7eb;">
                  <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#1a2332;">Hi ${data.user_name || 'there'}! 👋</p>
                  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">We found 3 new activities matching your interests. Check them out:</p>
                </td></tr>
                <tr><td style="background:#fff;padding:20px 24px;">
                  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:0;margin-bottom:16px;overflow:hidden;">
                    <img src="https://images.unsplash.com/photo-1566415074467-988b740b76d4?w=400" alt="${data.event1_title}" style="width:100%;max-height:160px;object-fit:cover;display:block;" />
                    <div style="padding:16px;">
                      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;">
                        <span style="display:inline-block;background:#E0F7F2;color:#2D7A3E;font-size:11px;font-weight:700;padding:4px 8px;border-radius:6px;text-transform:capitalize;">camp</span>
                      </div>
                      <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1a2332;line-height:1.4;">${data.event1_title || 'Summer Soccer Camp'}</h3>
                      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">by <strong style="color:#1a2332;">${data.event1_org || 'Mountain Kids Soccer Club'}</strong></p>
                      <div style="margin-bottom:12px;border-top:1px solid #f0f0f0;padding-top:8px;">
                        <div style="margin:0 0 6px;font-size:12px;color:#6b7280;">📅 ${data.event1_date || 'July 15, 2026'}</div>
                        <div style="margin:0 0 6px;font-size:12px;color:#6b7280;">📍 ${data.event1_location || 'Las Vegas, NV'}</div>
                        <div style="margin:0 0 6px;font-size:12px;color:#6b7280;">👥 ${data.event1_ages || 'Ages 5–12'}</div>
                        <div style="font-size:12px;color:#6b7280;">💰 ${data.event1_cost || '$75'}</div>
                      </div>
                      <a href="#" style="display:inline-block;background:#2D7A3E;color:#fff;padding:8px 14px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600;border:none;cursor:pointer;">View Details</a>
                    </div>
                  </div>
                  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:0;margin-bottom:16px;overflow:hidden;">
                    <img src="https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400" alt="${data.event2_title}" style="width:100%;max-height:160px;object-fit:cover;display:block;" />
                    <div style="padding:16px;">
                      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;">
                        <span style="display:inline-block;background:#E0F7F2;color:#2D7A3E;font-size:11px;font-weight:700;padding:4px 8px;border-radius:6px;text-transform:capitalize;">class</span>
                      </div>
                      <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1a2332;line-height:1.4;">${data.event2_title || 'Art & Crafts Workshop'}</h3>
                      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">by <strong style="color:#1a2332;">${data.event2_org || 'Little Stars Learning Center'}</strong></p>
                      <div style="margin-bottom:12px;border-top:1px solid #f0f0f0;padding-top:8px;">
                        <div style="margin:0 0 6px;font-size:12px;color:#6b7280;">📅 ${data.event2_date || 'July 18, 2026'}</div>
                        <div style="margin:0 0 6px;font-size:12px;color:#6b7280;">📍 ${data.event2_location || 'Henderson, NV'}</div>
                        <div style="margin:0 0 6px;font-size:12px;color:#6b7280;">👥 ${data.event2_ages || 'Ages 6–10'}</div>
                        <div style="font-size:12px;color:#6b7280;">💰 ${data.event2_cost || '$25'}</div>
                      </div>
                      <a href="#" style="display:inline-block;background:#2D7A3E;color:#fff;padding:8px 14px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600;border:none;cursor:pointer;">View Details</a>
                    </div>
                  </div>
                  ${adsHtml}
                </td></tr>
                <tr><td style="background:#f9fafb;padding:20px 24px;border-top:1px solid #e5e7eb;text-align:center;">
                  <p style="margin:0 0 12px;font-size:12px;color:#6b7280;">Want to tweak your interests?</p>
                  <a href="#" style="display:inline-block;background:#fff;border:1px solid #d1d5db;color:#2D7A3E;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600;">Manage Preferences</a>
                </td></tr>
                <tr><td style="background:#fff;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;font-size:11px;color:#9ca3af;">© 2024 LocalKidsCalendar · Community-powered kids' activities</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    };

    const template = templates[selectedEmail];
    if (template) {
      setPreviewHtml(template);
      setShowPreview(true);
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
              {EMAIL_TEMPLATES.map((template) => (
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
          <Button 
            type="button"
            disabled={!selectedEmail} 
            onClick={handlePreview}
            className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview Email
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-heading font-semibold text-sm mb-3">All Email Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...EMAIL_TEMPLATES].sort((a, b) => a.label.localeCompare(b.label)).map((template) => (
            <button
              key={template.value}
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
        </ol>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <div className="mt-4 border rounded-lg p-4 bg-white">
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}