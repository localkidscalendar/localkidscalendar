// Site-wide Terms of Service and Privacy Policy (general users).
// Supporter advertising terms live separately in supporterContent.js.
// Governing law: State of Nevada (same as Supporter Terms).

export const LEGAL_EFFECTIVE_DATE = "August 6, 2026";

export const SITE_NAME = "LocalKidsCalendar";
export const SITE_URL = "https://localkidscalendar.com";
export const CONTACT_PATH = "/contact";

export const TERMS_INTRO =
  `These Terms of Service ("Terms") govern your access to and use of ${SITE_NAME} (the "Platform," "we," "us," or "our"), including our website at ${SITE_URL}. By creating an account, signing in, posting content, or otherwise using the Platform, you agree to these Terms. If you do not agree, do not use the Platform.`;

export const TERMS_SECTIONS = [
  {
    title: "1. Eligibility",
    paragraphs: [
      "You must be at least 18 years old to create an account and use registered features. The Platform is intended for adults organizing or discovering family-friendly activities. You are responsible for all activity under your account.",
    ],
  },
  {
    title: "2. Accounts & Profiles",
    paragraphs: [
      "You agree to provide accurate registration information and to keep it current. You are responsible for safeguarding your login credentials. Notify us promptly if you believe your account has been compromised. We may suspend or disable accounts that violate these Terms, Our Community Rules, or applicable law.",
    ],
  },
  {
    title: "3. Our Community Rules",
    paragraphs: [
      "Our Community Rules (published on the About page) describe expected conduct for members and organizers. They are incorporated into these Terms by reference. Violations may result in content removal, account suspension, or permanent disablement.",
    ],
  },
  {
    title: "4. User Content",
    paragraphs: [
      "You retain ownership of content you post (such as activities, comments, photos, and organization details). By posting, you grant us a non-exclusive, worldwide, royalty-free license to host, display, distribute, and otherwise use that content as needed to operate and improve the Platform.",
      "You represent that you have the rights to post your content and that it does not infringe others' rights or violate law. We do not organize, administer, or endorse listed activities. Content is contributed by the community and may be inaccurate or incomplete.",
    ],
  },
  {
    title: "5. Moderation & Flagging",
    paragraphs: [
      "We may review, remove, hide, or refuse content at our discretion, including after community flags, automated screening, or Admin review. Community flagging and Admin tools are described in Our Community Rules and related Platform notices. We are not obligated to monitor all content.",
    ],
  },
  {
    title: "6. Advertising (Supporters)",
    paragraphs: [
      "Paid advertising is offered under separate Supporter Rules and Supporter Terms of Service. If you purchase or run ads, those documents also apply and control for advertising-specific matters (including payments and refunds).",
    ],
  },
  {
    title: "7. Acceptable Use",
    paragraphs: [
      "You may not misuse the Platform, including by attempting unauthorized access, scraping in a way that harms service availability, interfering with security or other users, posting illegal or harmful content, impersonating others, or using the Platform to harm children or families.",
    ],
  },
  {
    title: "8. Third-Party Services",
    paragraphs: [
      "The Platform relies on third-party providers (for example authentication, hosting, email, payments, and content review). Your use may also be subject to those providers' terms. We are not responsible for third-party sites linked from user or advertiser content.",
    ],
  },
  {
    title: "9. Disclaimers",
    paragraphs: [
      `THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT LISTINGS ARE ACCURATE OR SAFE.`,
    ],
    emphasis: true,
  },
  {
    title: "10. Limitation of Liability",
    paragraphs: [
      "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, LOCALKIDSCALENDAR AND ITS OWNERS, OPERATORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF OR INABILITY TO USE THE PLATFORM. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS OR THE PLATFORM SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR PLATFORM SERVICES IN THE 30 DAYS BEFORE THE CLAIM OR (B) ONE HUNDRED U.S. DOLLARS (US $100).",
    ],
  },
  {
    title: "11. Dispute Resolution & Arbitration",
    paragraphs: [
      "Any dispute, claim, or controversy arising out of or relating to these Terms or your use of the Platform shall be resolved by binding arbitration administered under the rules of the American Arbitration Association (AAA) in the State of Nevada, rather than in court, except that either party may seek emergency injunctive relief in a court of competent jurisdiction. YOU WAIVE YOUR RIGHT TO A JURY TRIAL AND TO PARTICIPATE IN A CLASS ACTION LAWSUIT OR CLASS-WIDE ARBITRATION. The arbitrator's award shall be final and binding and may be entered as a judgment in any court of competent jurisdiction.",
    ],
  },
  {
    title: "12. Governing Law",
    paragraphs: [
      "These Terms are governed by and construed in accordance with the laws of the State of Nevada, without regard to its conflict of law principles.",
    ],
  },
  {
    title: "13. Changes",
    paragraphs: [
      "We may update these Terms from time to time. The Effective Date above will change when we do. Continued use of the Platform after changes become effective constitutes acceptance of the updated Terms. For material changes, we may also provide notice through the Platform or by email when appropriate.",
    ],
  },
  {
    title: "14. Contact",
    paragraphs: [
      `Questions about these Terms may be sent through our Contact Us page at ${SITE_URL}${CONTACT_PATH}.`,
    ],
  },
];

export const TERMS_FOOTER =
  `By using ${SITE_NAME}, you acknowledge that you have read, understood, and agree to these Terms of Service. Last updated: ${LEGAL_EFFECTIVE_DATE}.`;

export const PRIVACY_INTRO =
  `This Privacy Policy explains how ${SITE_NAME} ("we," "us," or "our") collects, uses, and shares information when you use our Platform at ${SITE_URL}. By using the Platform, you acknowledge this Policy. For advertising-specific data practices related to paid placements, also see our Supporter Terms.`;

export const PRIVACY_SECTIONS = [
  {
    title: "1. Information We Collect",
    paragraphs: [
      "Depending on how you use the Platform, we may collect:",
    ],
    list: [
      { label: "Account information", text: "email address, name or organization details, zip code, role (community member / organizer), and profile fields you choose to provide." },
      { label: "Authentication data", text: "information from email/password signup or third-party sign-in (such as Google), processed through our auth provider." },
      { label: "Content you submit", text: "activities, comments, photos/logos, saved filters, favorites, messages, flags, and related metadata." },
      { label: "Advertising / billing data", text: "if you become a Supporter — business and creative details, zip placements, and payment-related information processed by Stripe (we do not store full card numbers on our servers)." },
      { label: "Usage & device data", text: "approximate logs such as pages viewed, referral info, and technical diagnostics from our hosting and analytics tools when enabled." },
      { label: "Communications", text: "messages you send via Contact Us, and emails we send (such as account, digest, or transactional notices) including delivery events from our email provider." },
    ],
  },
  {
    title: "2. How We Use Information",
    paragraphs: [
      "We use information to:",
    ],
    list: [
      { label: "Operate the Platform", text: "provide accounts, listings, search/filter by location, messaging, and moderation." },
      { label: "Communicate", text: "send transactional email, optional weekly digests you enable, waitlist/offer notices, and Admin or system messages." },
      { label: "Safety & integrity", text: "enforce Our Community Rules, review images/creatives, process flags, prevent abuse, and secure accounts." },
      { label: "Payments", text: "process Supporter purchases, renewals, and related billing with Stripe." },
      { label: "Improve the service", text: "understand feature usage, fix bugs, and develop new capabilities." },
    ],
    afterListParagraphs: [
      "We do not sell your personal information.",
    ],
  },
  {
    title: "3. How We Share Information",
    paragraphs: [
      "We share information only as needed to run the Platform or as required by law, including with:",
    ],
    list: [
      { label: "Service providers", text: "such as Supabase (auth/database/storage), Vercel (hosting), Resend (email), Stripe (payments), OpenAI (automated image/content review when configured), and Google (if you use Google sign-in)." },
      { label: "Other users", text: "content you choose to make public (for example activity listings, organizer profiles, and comments) is visible to visitors of the Platform." },
      { label: "Legal & safety", text: "when we believe disclosure is reasonably necessary to comply with law, protect rights/safety, or investigate abuse." },
    ],
  },
  {
    title: "4. Children's Privacy",
    paragraphs: [
      "The Platform is designed for adults. We do not knowingly collect personal information directly from children under 13. Listings and photos should not include personal information about children without appropriate permission. If you believe a child has provided personal information to us, contact us and we will take appropriate steps.",
    ],
  },
  {
    title: "5. Cookies & Similar Technologies",
    paragraphs: [
      "We and our providers may use cookies or local storage for authentication, preferences (such as zip), and basic site operation. You can control cookies through your browser settings; some features may not work if you block them.",
    ],
  },
  {
    title: "6. Data Retention",
    paragraphs: [
      "We retain account and content data for as long as needed to provide the Platform and for legitimate business, legal, or safety purposes (for example moderation history and billing records). You may request account-related assistance through Contact Us. Some information may remain in backups or logs for a limited period.",
    ],
  },
  {
    title: "7. Security",
    paragraphs: [
      "We use administrative and technical measures designed to protect information (including access controls and encrypted connections where provided by our vendors). No method of transmission or storage is completely secure.",
    ],
  },
  {
    title: "8. Your Choices",
    paragraphs: [
      "You can update profile information in Account settings, manage notification preferences (including digests), withdraw certain flags where the Platform allows, and soft-delete some of your content. You may also contact us to ask questions about your information. If you use Google sign-in, you can manage that connection through your Google account settings.",
    ],
  },
  {
    title: "9. U.S. State Privacy Notices",
    paragraphs: [
      "Depending on where you live, you may have rights to request access to or deletion of certain personal information, or to appeal a decision. To make a request, use our Contact Us page and describe what you need. We will verify and respond as required by applicable law. We do not sell personal information as that term is commonly defined under U.S. state privacy laws.",
    ],
  },
  {
    title: "10. International Users",
    paragraphs: [
      "The Platform is operated for use in the United States. If you access it from elsewhere, you understand that information may be processed in the United States.",
    ],
  },
  {
    title: "11. Changes to This Policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time. The Effective Date will change when we do. Continued use after an update constitutes acknowledgment of the revised Policy.",
    ],
  },
  {
    title: "12. Governing Law",
    paragraphs: [
      "This Privacy Policy is governed by the laws of the State of Nevada, without regard to its conflict of law principles, except where mandatory local privacy laws apply.",
    ],
  },
  {
    title: "13. Contact",
    paragraphs: [
      `Privacy questions may be sent through our Contact Us page at ${SITE_URL}${CONTACT_PATH}.`,
    ],
  },
];

export const PRIVACY_FOOTER =
  `This Privacy Policy was last updated on ${LEGAL_EFFECTIVE_DATE}.`;
