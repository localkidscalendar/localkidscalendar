// Shared source of truth for Supporter Rules and Supporter Terms of Service.
// Edit this file to update content everywhere it's displayed: the Supporters page,
// Ad Manager (Rules & Terms tab), and the Advertiser Terms page.

export const SUPPORTER_RULES = [
  { title: "Family-Friendly Content Only", text: "All ads must be appropriate for children and families. Content that is violent, obscene, pornographic, sexually suggestive, or otherwise inappropriate for a family audience will be immediately rejected and removed." },
  { title: "Honest & Accurate Advertising", text: "Ads must accurately represent your business, products, or services. Misleading claims, deceptive pricing, or false statements are strictly prohibited." },
  { title: "Working, Safe Links", text: "All destination URLs must be active, safe, and relevant to your ad content. Links to malware, phishing sites, or unrelated content will result in immediate removal." },
  { title: "Local Community Focus", text: "We prioritize businesses and services that are genuinely relevant to local families and children. Ads should have a clear connection to the community they are targeting." },
  { title: "No Competitor Targeting", text: "Ads may not directly disparage or negatively target competing businesses, organizations, or individuals." },
  { title: "Image Quality Standards", text: "Ad images must be high resolution, clear, and professional. Blurry, pixelated, or low-quality images that reflect poorly on the platform will not be approved. Best display fit for Supporter ads is 600 × 400 px (3:2 landscape). The site resizes and compresses photos before upload." },
  { title: "Compliance with Laws", text: "All ads must comply with applicable local, state, and federal laws, including truth-in-advertising standards, privacy laws, and any regulations relevant to your industry." },
  { title: "Community Flagging", text: "Our community of parents can flag ad creatives they feel are inappropriate or spam. Flags attach to the Ad Asset (creative), not a single zip placement — so reports from any zip count together. An asset flagged by 3 or more distinct users is automatically disabled everywhere that creative is running, pending review. Separately, community members may flag a user account for rule violations; repeated or serious reports can lead to suspension or Admin deactivation of the account. Repeated creative or account violations may result in permanent removal without refund." },
  { title: "Replacement Ads", text: "If your ad creative is disabled due to flagging or violation, you must assign a compliant replacement asset before each affected zip spot can go live again. New replacement creatives undergo review." },
  { title: "Account Deactivation for Rule Violations", text: "If you do not comply with Our Community Rules or these Supporter Rules, your account may be suspended or deactivated (disabled) as determined by the Platform Administrator and/or through community user flagging. Admin may also manually deactivate your account at any time for non-compliance. Deactivation ends normal use of the Platform and cancels or removes your advertising placements. No refunds or credits are issued for unused advertising time." },
  { title: "No Refunds for Policy Violations", text: "Ads removed due to policy violations, community flags, Terms of Service breaches, account suspension, or Admin deactivation of your account are not eligible for refunds or credits, regardless of remaining plan time." },
];

/** Display sizes for ad creatives (object-cover frames). Large originals are auto-resized before upload. */
export const SUPPORTER_AD_IMAGE_RECOMMENDED =
  "Best fit: 600 × 400 px (3:2 landscape), JPG or PNG. Phone photos are OK — we resize/compress automatically before upload. Keep the main subject centered — the image fills the frame and may crop edges if the ratio differs.";

export const DEFAULT_AD_IMAGE_RECOMMENDED =
  "Best fit: 600 × 467 px (taller than Supporter ads — full photo, no footer bar), JPG or PNG. Large files are resized automatically. Keep the main subject centered — the image fills the frame and may crop edges if the ratio differs.";

/** Shown on Ad Library upload so advertisers know what will be declined. */
export const AD_IMAGE_REVIEW_GUIDELINES = [
  "Best fit: 600 × 400 px (3:2 landscape) — keep the main subject centered",
  "The site resizes and compresses photos before upload",
  "No nudity, sexual content, or sexually suggestive imagery",
  "No graphic violence, gore, weapons, or hate symbols",
  "No drugs, alcohol-focused marketing, gambling, or illegal products",
  "Images must be clear and professional — not blank, blurry, or illegible",
  "Content must be appropriate for children and families viewing the calendar",
  "Destination links must be safe, working, and related to your business",
];

export const TOS_EFFECTIVE_DATE = "August 26, 2026";

export const TOS_INTRO = "These Supporter Terms of Service (\"Terms\") govern your participation as an advertiser (\"Supporter\") on LocalKidsCalendar (\"Platform,\" \"we,\" \"us,\" or \"our\"). By submitting an advertisement, completing payment, or clicking \"I Agree,\" you accept these Terms in full. If you do not agree, do not proceed with your Supporter application.";

export const TOS_SECTIONS = [
  {
    title: "1. Eligibility & Account",
    paragraphs: [
      "You must be at least 18 years of age and have the legal authority to enter into a binding agreement on behalf of yourself or your business. You are responsible for maintaining accurate account information and for all activity under your account.",
      "As a Supporter you remain bound by Our Community Rules (published on the About page) in addition to these Terms and the Supporter Rules. Failure to comply may result in suspension or deactivation of your account as described below, without refund for advertising.",
    ],
  },
  {
    title: "2. Ad Content Standards",
    paragraphs: ["All submitted advertisements must comply with our Supporter Rules as published on the Supporters page, which are incorporated herein by reference. We reserve the right to reject, modify, or remove any ad at our sole discretion, including but not limited to ads containing inappropriate, violent, obscene, sexually suggestive, or misleading content. Ads linking to unsafe, non-functional, or unrelated websites will be rejected without refund."],
  },
  {
    title: "3. Payments & Subscriptions",
    paragraphs: ["All plans are prepaid in full before your ad becomes active. We offer:"],
    list: [
      { label: "Monthly Plan", text: "30-day period, billed at the current monthly rate per zip code." },
      { label: "Annual Plan", text: "365-day period, billed at the current annual rate (monthly rate × 12, less the published annual discount) per zip code." },
    ],
    afterListParagraphs: ["Rates are set by the Platform and may change. Your renewal rate will be the current rate as of 21 days before your renewal date. Plans automatically renew for the same period unless cancelled at least 14 days prior to renewal. Payment is processed via Stripe. By providing payment information, you authorize us to charge your payment method for all applicable fees."],
  },
  {
    title: "4. No Refund Policy",
    paragraphs: ["ALL SALES ARE FINAL. WE DO NOT OFFER REFUNDS OR CREDITS UNDER ANY CIRCUMSTANCES, INCLUDING BUT NOT LIMITED TO: platform downtime, technical errors, ad rejection, ad removal due to community flags or policy violations, suspension or deactivation (disablement) of your account by the Administrator or as a result of community user flagging, cancellation of your account, termination of the Platform, or any other reason. If your ad is removed or your advertising placements end because of rule violations or account deactivation, no refund or credit will be issued for any unused portion of your plan period. If your ad is flagged and temporarily suspended while you upload a replacement, no credit will be issued for the suspension period."],
    emphasis: true,
  },
  {
    title: "5. Cancellation & Renewal",
    paragraphs: ["You may cancel automatic renewal at any time from your Account page, provided cancellation is completed at least 14 days before your renewal date. Cancellation stops future charges but does not entitle you to a refund for any current or past period. Your ad will remain active through the end of the paid period. If cancelled fewer than 14 days before renewal, the next renewal charge will still be processed."],
  },
  {
    title: "6. Discount Codes",
    paragraphs: ["Discount codes may be offered at our discretion and are subject to expiration dates and usage limits. Each discount code may only be used once per account. Attempting to circumvent this limitation by creating multiple accounts is a violation of these Terms. Discount codes have no cash value and cannot be combined with other offers unless explicitly stated."],
  },
  {
    title: "7. Ad Review & Moderation",
    paragraphs: ["Submitted ads undergo automated content screening and may also be subject to manual review. We reserve the right to approve, reject, or request modifications to any ad. Community flags attach to the Ad Asset (creative). An asset flagged by 3 or more distinct community members is automatically disabled across every zip placement using that creative, pending review. If a replacement is required (due to flagging or rejection), it must also pass review before your ad spot is restored. There is no credit or refund for time lost during review or suspension."],
  },
  {
    title: "8. Zip Code Availability",
    paragraphs: ["Ad spots are sold by zip code, subject to availability. A maximum number of Supporters per zip code (the \"slot limit\") is set by the Platform and may vary by zip code. If a zip code is at capacity, you may join the waitlist. A spot offer is valid for 7 days; failure to complete payment within that window forfeits your position and the offer passes to the next waitlisted applicant."],
  },
  {
    title: "9. Account Suspension & Deactivation",
    paragraphs: [
      "Compliance with Our Community Rules and the Supporter Rules is required at all times. Whether conduct violates those rules is determined by the Platform Administrator and/or through community user flagging on the Platform.",
      "Community members may flag a user account for reasons such as misrepresentation or disregard for Our Community Rules. When an account receives flags from the threshold number of distinct reporters (currently three), the account may be automatically suspended pending Administrator review. While suspended, your ability to use the Platform is limited as described in product messaging, and advertising may be restricted.",
      "Separately, the Administrator may manually deactivate (disable) your account at any time for non-compliance with Our Community Rules, these Terms, or the Supporter Rules, or for other conduct the Administrator determines to be harmful to the Platform or its users—whether or not community flagging has occurred.",
      "If your account is suspended or deactivated: (a) normal access to the Platform may end or be severely limited; (b) your advertising placements, renewals, and waitlist positions may be cancelled or removed; and (c) you are not entitled to any refund or credit for prepaid, unused advertising time or related fees. Reactivation, if offered, is at the Administrator's sole discretion and does not restore cancelled advertising or create any refund obligation.",
    ],
  },
  {
    title: "10. Limitation of Liability",
    paragraphs: ["TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, LOCALKIDSCALENDAR AND ITS OWNERS, OPERATORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, BUSINESS INTERRUPTION, OR LOSS OF DATA, ARISING FROM YOUR USE OF OR INABILITY TO USE THE PLATFORM, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING FROM THESE TERMS SHALL NOT EXCEED THE TOTAL AMOUNT PAID BY YOU TO US IN THE 30 DAYS PRECEDING THE CLAIM."],
  },
  {
    title: "11. Dispute Resolution & Arbitration",
    paragraphs: ["Any dispute, claim, or controversy arising out of or relating to these Terms or your use of the Platform shall be resolved by binding arbitration administered under the rules of the American Arbitration Association (AAA) in the state of Nevada, rather than in court, except that either party may seek emergency injunctive relief in a court of competent jurisdiction. YOU WAIVE YOUR RIGHT TO A JURY TRIAL AND TO PARTICIPATE IN A CLASS ACTION LAWSUIT OR CLASS-WIDE ARBITRATION. The arbitrator's award shall be final and binding and may be entered as a judgment in any court of competent jurisdiction."],
  },
  {
    title: "12. Platform Termination",
    paragraphs: ["We reserve the right to suspend or terminate the Platform, or your access to it, at any time with or without notice. In the event of Platform termination, no refunds will be issued for any prepaid, unused periods of service."],
  },
  {
    title: "13. Modifications to Terms",
    paragraphs: ["We may update these Terms at any time. Continued use of the Platform following notice of changes constitutes acceptance of the updated Terms. We will endeavor to notify active Supporters of material changes via email."],
  },
  {
    title: "14. Governing Law",
    paragraphs: ["These Terms are governed by and construed in accordance with the laws of the State of Nevada, without regard to its conflict of law principles."],
  },
];

export const TOS_FOOTER = "By completing your Supporter application and payment, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. Last updated: " + TOS_EFFECTIVE_DATE + ".";