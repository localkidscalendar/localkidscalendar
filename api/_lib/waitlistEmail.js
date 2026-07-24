const APP_URL = process.env.VITE_APP_URL || "https://localkidscalendar.vercel.app";

function formatPacific(date) {
  try {
    return new Date(date).toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  } catch {
    return String(date);
  }
}

/**
 * Build subject + HTML for a waitlist spot-available offer email.
 * offer_count = number of prior misses; this send is attempt (offer_count + 1) of 3.
 */
export function buildWaitlistOfferEmail({
  business_name,
  zip_code,
  offer_expires_date,
  offer_count = 0,
} = {}) {
  const zip = zip_code || "your area";
  const name = business_name || "there";
  const offerNum = Number(offer_count || 0) + 1;
  const attemptsLeft = Math.max(0, 3 - offerNum);
  const expiryLabel = formatPacific(offer_expires_date);
  const claimUrl = `${APP_URL}/ad-manager`;

  const attemptsNote =
    attemptsLeft > 0
      ? `You have ${attemptsLeft} offer attempt${attemptsLeft !== 1 ? "s" : ""} remaining before your waitlist entry is cancelled.`
      : "This is your final offer — if not claimed, your waitlist entry will be cancelled.";

  const subject = `A Supporter spot opened in zip ${zip}! Claim it within 24 hours — LocalKidsCalendar`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
      <h2 style="color: #2D7A3E;">A Spot Has Opened Up in ${zip}!</h2>
      <p>Hi ${name},</p>
      <p>Great news! A Supporter advertising spot has opened up in zip code <strong>${zip}</strong>.</p>
      <p>You have <strong>24 hours</strong> to claim it. Here's what to do:</p>
      <ol>
        <li>Log in to your account at Local Kids Calendar</li>
        <li>Go to <strong>Ad Manager</strong></li>
        <li>Open the <strong>Waitlist</strong> tab</li>
        <li>Find zip <strong>${zip}</strong> and click <strong>Subscribe Now</strong></li>
        <li>Complete checkout to lock in your spot</li>
      </ol>
      <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D97706;">
        <p style="margin:0;"><strong>Offer expires:</strong> ${expiryLabel} Pacific Time</p>
      </div>
      <p><a href="${claimUrl}" style="display:inline-block;background:#2D7A3E;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Go to Ad Manager</a></p>
      <p style="margin-top:20px;">⚠️ If you don't complete the process within 24 hours, your spot will be offered to the next person and you'll be moved to the back of the line. ${attemptsNote}</p>
      <p>Thank you for supporting the local kids community!</p>
      <p>— The Local Kids Calendar Team</p>
    </div>
  `;

  return { subject, html, offerNum, attemptsLeft };
}
