import React, { useMemo, useState } from "react";
import { BookOpen, ExternalLink, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Admin Site Manual — layman overview + technical breakdown per topic.
 * Update this file whenever product rules or major workflows change.
 *
 * Shape per section:
 *   id, title, overview, features[], technicalOverview, technicalFeatures[]
 * Optional: keywords[] — extra search terms not already in the prose
 */

const categories = [
  {
    id: "platform",
    label: "Platform & Design",
    sections: [
      {
        id: "stack-overview",
        title: "Tech Stack (Post–Base44)",
        keywords: ["supabase", "vercel", "react", "vite", "postgres", "resend", "stripe"],
        overview:
          "LocalKidsCalendar runs as a React (Vite) front end on Vercel, with Supabase for auth and Postgres data, and Vercel serverless API routes for Stripe, Resend email, OpenAI moderation, and cron jobs. Base44 is no longer the runtime for the live site.",
        features: [
          "Front end: React + Vite + Tailwind + shared UI components (shadcn-style)",
          "Auth & database: Supabase Auth + Postgres tables with Row Level Security",
          "Server: Vercel /api/* routes (checkout, webhooks, digests, photo/ad review, disable user)",
          "Email: Resend; payments: Stripe; image review: OpenAI Moderation API + custom vision when a key is configured",
        ],
        technicalOverview:
          "Client uses @/lib/supabaseClient.js. Privileged server work uses SUPABASE_SERVICE_ROLE_KEY via createAdminClient() in api/_lib/stripeHelpers.js. Crons are declared in vercel.json and authenticated with CRON_SECRET (or x-vercel-cron).",
        technicalFeatures: [
          "Env (Vite): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY; optional VITE_API_BASE_URL / VITE_APP_URL",
          "Env (server): SUPABASE_*, RESEND_*, STRIPE_*, OPENAI_API_KEY, CRON_SECRET, EMAIL_SENDING_ENABLED, RESEND_WEBHOOK_SECRET",
          "Migrations live under supabase/migrations/; production SQL is often applied via the Supabase SQL Editor",
          "Legacy base44/ folder may still exist in the repo but is not the live path for Admin/email/ads",
        ],
      },
      {
        id: "layout-design",
        title: "Layout & Design",
        overview:
          "The site uses a clean, modern design with a mint green and navy color scheme. The layout is responsive for desktop, tablet, and mobile.",
        features: [
          "Color palette: mint green and navy applied consistently",
          "Typography: Quicksand for headings, Nunito for body text",
          "Visual style: rounded corners, consistent spacing, clear hierarchy",
          "Responsive layout with sticky nav; dialogs sit above the nav (z-index)",
        ],
        technicalOverview:
          "Built with React + Vite, styled with Tailwind and design tokens in src/index.css. AppLayout wraps authenticated pages with Navbar, BetaBanner, and Footer.",
        technicalFeatures: [
          "Shared UI under src/components/ui/",
          "Routing: React Router in src/App.jsx; AppLayout outlet for main pages",
          "Mobile: hamburger for site pages; profile menu for Account / Ad Manager; Post CTA on the top bar",
        ],
      },
      {
        id: "zip-code-validation",
        title: "Zip Code & Distance Defaults",
        overview:
          "Anywhere a zip is entered, the site requires a valid 5-digit US zip. Signed-in users also set a preferred search distance on Profile (default 15 miles). Together these drive homepage filtering and “local” meaning for the session.",
        features: [
          "5-digit zip only (no letters, no ZIP+4)",
          "Profile distance options typically 5 / 10 / 15 / 25 / 50 / 100 miles; default 15",
          "Used on Post Activity, Profile, Ad checkout, and filters",
        ],
        technicalOverview:
          "Client masks enforce /^\\d{5}$/. Profile stores zip_code and radius_miles on profiles. Distance filtering uses Haversine against geocoded coordinates (zippopotam.us).",
        technicalFeatures: [
          "profiles.radius_miles column (migration profile_radius_miles)",
          "locationDefaults.js centralizes default radius where used",
          "Exact zip matching is still used in weekly digest matching today (radius geocoding for digests is not applied yet)",
        ],
      },
    ],
  },
  {
    id: "users",
    label: "Users & Accounts",
    sections: [
      {
        id: "user-registration",
        title: "User Registration & Login",
        keywords: ["otp", "google", "oauth", "password", "sign up"],
        overview:
          "Users register with email/password or Google. At signup they choose Community Member or Organizer (permanent for that account). Email verification uses Supabase OTP/confirm flows. Returning users sign in the same ways, or reset a password via email link.",
        features: [
          "Sign-up: email/password or Google OAuth",
          "Account type: Community Member or Organizer — one email cannot be both",
          "Email verification required before full access (OTP / confirm link)",
          "Password reset via secure email link",
          "Phone may be collected later on Profile where enabled; not required for signup",
          "Register form includes timing/honeypot bot checks",
        ],
        technicalOverview:
          "Register.jsx / Login.jsx / ForgotPassword.jsx / ResetPassword.jsx / AuthCallback.jsx use supabase.auth. Profile rows are created by handle_new_user from auth metadata (role, names, zip). Organizer shell rows can be created in finalizeProfile or AuthContext when org metadata is present.",
        technicalFeatures: [
          "profiles.role from metadata; default community_member if missing",
          "Auth invite links can prefill role/email query params on Register",
          "Primary admin email may be promoted to role=admin via SQL migrations (ensure_admin_role)",
          "Navbar/Admin access: role === 'admin' (Admin page hard-requires admin)",
        ],
      },
      {
        id: "user-types",
        title: "Roles: Community Member, Organizer, Admin, Disabled",
        keywords: ["role", "organizer", "community_member", "admin"],
        overview:
          "Community Members browse, save, flag, comment, and can post activities. Organizers get org branding and directory presence. Admin is a privileged operator role (not chosen at signup). Disabled accounts cannot use the site normally and see the Account Disabled experience.",
        features: [
          "community_member: core family/user experience",
          "organizer: same plus org profile (name, logo, website, email) and directory listing",
          "admin: Admin panel + elevated APIs; primary account often localkidscalendar@gmail.com",
          "disabled: blocked; digests forced off; prior role stored for restore",
          "Supporter is not a role — it is profiles.is_advertiser on top of CM or Organizer",
        ],
        technicalOverview:
          "profiles.role check constraint: admin | organizer | community_member | disabled. organizers table is 1:1 with user_id. Admin Users list shows the live profiles.role label.",
        technicalFeatures: [
          "role_before_disabled preserved on disable; restoreRoleFromProfile in authRoles.js",
          "Weekly digests intentionally skip organizer and admin recipients",
          "ProfileTab locks role after setup for non-admins; admins keep their real role on save",
        ],
      },
      {
        id: "account-disable-reactivation",
        title: "Disable Account & Reactivation Requests",
        keywords: ["disable", "reactivate", "banned", "account disabled"],
        overview:
          "Admins can disable a user with a required note. The user is treated as signed out for normal features, digests turn Off, and they see an Account Disabled page with the note. They may submit one reactivation request for Admin review.",
        features: [
          "Always: role → disabled, digests Off, note shown on Account Disabled",
          "Supporters also: slot-holding ads cancelled, Stripe set not to renew, waitlist cleared, waitlist processor runs",
          "Reactivation: one request per user lifetime (pending / reactivated / declined)",
          "On approve: prior role restored (admin prior is stored carefully; organizer restores as organizer)",
        ],
        technicalOverview:
          "Admin Users → disable calls /api/admin-disable-user. Reactivation rows live in account_reactivation_requests. UI: AccountDisabled.jsx + Admin Users → Reactivation Requests.",
        technicalFeatures: [
          "Caller must be admin (or allowlisted admin email on the API)",
          "Non-supporter path: simple role/digest updates",
          "Supporter path: banner_ads + Stripe cancel_at_period_end + ad_waitlist cleanup + processWaitlist",
          "authRoles.isAccountDisabled / isRegisteredUser gate registered-only features",
        ],
      },
      {
        id: "supporter-users",
        title: "Supporter (Advertiser) Flag",
        overview:
          "Supporters buy zip ad slots and use Ad Manager for creatives, billing, waitlist, and renewals. Supporter status is an add-on (is_advertiser) on a Community Member or Organizer account — one active slot per zip per Supporter.",
        features: [
          "Ad Manager for creatives, placements, renewals, plan changes, waitlist",
          "Granted automatically on first purchase or via Admin",
          "One slot-holding placement per zip per Supporter",
        ],
        technicalOverview:
          "profiles.is_advertiser. Placements in banner_ads; creatives in ad_library. Checkout via /api/create-ad-checkout.",
        technicalFeatures: [
          "Slot-holding statuses: active, pending_payment, pending_review, flagged, past_due",
          "Admin can grant advertiser flag from Users",
        ],
      },
      {
        id: "user-dashboard",
        title: "My Account Tabs",
        overview:
          "Everything personal lives under My Account. Default tab is Messages. There is no separate Dashboard and no Flagged Content tab anymore (flags are handled via moderation and Admin Flags).",
        features: [
          "Messages (default) — in-app inbox",
          "My Activity Posts — for community members / organizers / admin",
          "Saved Activities, Fav Organizers, Email Notifications, Home Search Filters (My Filters), Profile",
        ],
        technicalOverview:
          "Account.jsx VALID_TABS: messages, posts, saved, saved-organizers, notifications, saved-filters, profile. Unread badge uses countUnreadMessages.",
        technicalFeatures: [
          "?tab=flagged redirects to messages (legacy links)",
          "?setup=1 opens Profile for zip completion after OAuth/setup",
        ],
      },
      {
        id: "user-messages-inbox",
        title: "In-App Messages Inbox",
        keywords: ["inbox", "user_messages", "welcome"],
        overview:
          "One-way inbox for site notices: welcome messages, billing/plan notices, photo/ad decisions, flag outcomes, and Admin mass messages. Users can mark read and soft-delete. Many items include optional action buttons (e.g. open Ad Manager).",
        features: [
          "Unread count in nav / Account tab",
          "System + Admin-authored messages",
          "Optional action label + in-app path",
          "Soft-delete from the user’s view",
        ],
        technicalOverview:
          "user_messages table + helpers in userMessages.js / userMessagesCatalog.js. Welcome onboarding inserts on new profile. Admin Previews → Automated Messages shows catalog samples.",
        technicalFeatures: [
          "Mass messages fan out copies then can be retracted (soft-delete copies + remove archive row)",
          "Some flows are inbox-only (e.g. renewal-soon); others also send Resend email (payment failed, waitlist offer)",
        ],
      },
      {
        id: "saved-filter-preferences",
        title: "Saved Filter Preferences (My Filters)",
        overview:
          "Signed-in users save go-to homepage filters (category, sort, zip/distance, ages, price/Free) and apply them in one click. My Filters, Saved Activities, and Fav Organizers are mutually exclusive on the homepage.",
        features: [
          "My Account → Home Search Filters to save",
          "Homepage My Filters button applies them",
          "Highlight clears if the user changes a preference field after apply",
          "Signed-out: buttons greyed; click opens auth prompt",
        ],
        technicalOverview:
          "saved_filters one row per user. EventFilters.jsx merges into active filters and tracks an applied snapshot.",
        technicalFeatures: [
          "Does not store date range or Saved/Fav toggles",
          "Help panel on the filter bar explains AND/OR and session retention",
        ],
      },
      {
        id: "notification-preferences",
        title: "Email Notification Preferences",
        overview:
          "Weekly activity digests are Off by default. Users can choose Weekly and include Favorite Organizers and/or Activity Matches (zip, keywords, age). Digests only send when there is matching content. A More… link explains auto-off and unsubscribe behavior without cluttering the form.",
        features: [
          "Frequency: Off (default) or Weekly (Mondays)",
          "Favorite Organizers and/or Activity Matches toggles",
          "No empty “nothing new” emails",
          "One-click unsubscribe in each digest; Manage Preferences in Account",
        ],
        technicalOverview:
          "notification_preferences: frequency weekly|none; include_fav_organizers; include_other_activities; zip/keywords/ages/locations. UI: NotificationsTab.jsx.",
        technicalFeatures: [
          "Digest matching in api/_lib/sendNotificationDigestsCore.js",
          "See Email Digest Safeguards for pause, inactivity, suppressions, and caps",
        ],
      },
    ],
  },
  {
    id: "activities",
    label: "Activities & Community",
    sections: [
      {
        id: "posting-activity",
        title: "Posting an Activity",
        overview:
          "Community Members and Organizers post activities with dates, ages, cost, location, categories (up to three), and optional photo. End date is required and cannot be before start date. Community Rules must be accepted.",
        features: [
          "Categories / types for camps, classes, sports, etc.",
          "Organizer posts show org branding / highlight styling",
          "Photo optional; goes through AI review on upload",
          "Zip must be 5 digits; end date required",
        ],
        technicalOverview:
          "PostEvent.jsx inserts into events. Image upload then /api/photo-review. posted_by_role / org fields drive EventCard styling.",
        technicalFeatures: [
          "events.status active vs archived for moderation/removal",
          "HistoryBackLink / navigation history for cancel/back UX where wired",
        ],
      },
      {
        id: "activity-photo-moderation",
        title: "Activity Photo Moderation",
        keywords: ["moderation api", "openai", "vision", "photo review", "hybrid"],
        overview:
          "Cover photos are screened automatically on upload. Phase 1 uses OpenAI’s free Moderation API for clear approve/decline (with natural-language decline reasons). Phase 2 (custom gpt-4o-mini vision) runs only when Moderation scores are in the gray middle — still looking like one review to the user. Declines from either phase can request Admin manual review. Community flagging remains a safety net.",
        features: [
          "Automatic hybrid review on upload (Moderation first, custom vision only when needed)",
          "Natural-language decline reasons (not raw category labels)",
          "Request Manual Review after an automated decline",
          "Admin approve / decline with notes",
        ],
        technicalOverview:
          "/api/photo-review → reviewImageHybrid in api/_lib/imageModeration.js. Admin → Reviews → Activity Manual Review (AdminActivityPhotoReviewPanel). Client: PostEvent.jsx + moderateEventImage.js.",
        technicalFeatures: [
          "image_moderation_status: approved / declined / manual_review / manual_review_declined / …",
          "Phase 1: omni-moderation-latest; high score (≥0.85 or flagged ≥0.7) → decline; low (≤0.20, unflagged) → approve; else escalate",
          "Phase 2: gpt-4o-mini vision with ACTIVITY_PHOTO_VISION_PROMPT",
          "Without OPENAI_API_KEY, fails open to approved (community flagging remains)",
          "creative-review.js is the parallel path for Ad Assets (URL checks run separately first)",
        ],
      },
      {
        id: "activity-filters",
        title: "Activity Filters & Sorting",
        overview:
          "Homepage filters combine with AND logic (every selected filter must match). Keyword search is the exception: multiple words use OR across title, description, keywords, organizer name, and city. Filters persist for the browser session. Help on the filter bar explains this.",
        features: [
          "Category, free/price, ages, zip+radius, dates, sort",
          "Session persistence; More Filters auto-expands when advanced values restored",
          "Saved Activities / Fav Organizers / My Filters mutually exclusive",
        ],
        technicalOverview:
          "EventFilters + Home.jsx sessionStorage (home_filters_session). Distance via Haversine. Cap ~200 results.",
        technicalFeatures: [
          "Search strips punctuation and splits words (OR)",
          "My Filters applied snapshot clears highlight when fields diverge",
        ],
      },
      {
        id: "search-location",
        title: "Search & Location-Based Results",
        overview:
          "Signed-in users prefer profile zip + radius. Guests use geolocation or a required zip modal / banner override. The site is local-first — browsing without a zip is blocked when location cannot be resolved.",
        features: [
          "Profile zip wins when signed in",
          "Geolocation or manual zip for guests",
          "ZipRequiredModal when nothing is available",
        ],
        technicalOverview:
          "session_zip_current, profile zip, useGeoLocation, ZipRequiredModal. Zippopotam for lat/lng.",
        technicalFeatures: [
          "Banner zip override for the session without permanently changing Profile until saved",
        ],
      },
      {
        id: "comments",
        title: "Comments on Activities",
        overview:
          "Signed-in users comment on Event Detail. Comments can be flagged and auto-archived at the same 3-flag threshold as activities.",
        features: [
          "Thread on Event Detail",
          "Flag with the same reason set as activities",
          "Auto-hide at 3 distinct flaggers",
        ],
        technicalOverview:
          "comments table with flag_count / flagged_by / status. Shown in Admin → Flags with events and ads.",
        technicalFeatures: [
          "status active | deleted | archived",
        ],
      },
      {
        id: "liking-favoriting",
        title: "Saved Activities & Favorite Organizers",
        overview:
          "Bookmark activities and favorite organizers. Both appear in My Account and power homepage filter buttons and digest Favorite Organizers matching.",
        features: [
          "Save activity (bookmark)",
          "Favorite organizer (follow)",
          "Used by digests when Favorite Organizers is enabled",
        ],
        technicalOverview:
          "saved_events and favorite_organizers tables. EventDetail / EventCard toggle UX with auth prompt when signed out.",
        technicalFeatures: [
          "Digest uses favorite_organizers.poster_user_id vs event.created_by_id",
        ],
      },
      {
        id: "invite-templates",
        title: "Invite Templates",
        overview:
          "Static invite pages for Community Member, Organizer, and Supporter with copy / email / SMS share. Buttons on Organizers, Supporters, and About highlight the page’s primary audience.",
        features: [
          "Three invite routes with ready-made copy",
          "Copy, mailto, and sms actions",
          "Back uses browser history",
        ],
        technicalOverview:
          "InviteCommunityMemberPage / InviteOrganizerPage / InviteSupporterPage — no DB writes.",
        technicalFeatures: [
          "Routes: /invite-community-member, /invite-organizer, /invite-supporter",
        ],
      },
      {
        id: "organizer-directory",
        title: "Organizer Directory",
        overview:
          "Public list of registered organizers with profile details and favorite actions for signed-in users.",
        features: [
          "Browse organizers",
          "Org name, description, links, logo when set",
          "Favorite from directory",
        ],
        technicalOverview:
          "Organizers.jsx reads organizers (+ related events proximity rules as implemented).",
        technicalFeatures: [
          "Unique organizers.user_id",
        ],
      },
      {
        id: "flagging-system",
        title: "Flagging & Admin Disposition",
        keywords: ["flag", "3 flags", "manually_deactivated", "cascade"],
        overview:
          "Registered users flag activities, comments, or ads (Inaccurate, Inappropriate, Spam, Other with required details). At 3 distinct flaggers, content auto-hides (or ads go flagged). Admin Flags reviews dispositions and history.",
        features: [
          "Same reasons everywhere; Other requires text",
          "Threshold: 3 different users",
          "Admin: Manually Deactivate, Reactivate, Reviewed, Clear Flag / flags cleared",
          "Ad asset cascade: disabling a creative can affect all zip placements using it",
        ],
        technicalOverview:
          "flag_reports + admin_action_history arrays. Admin → Flags → Flagged Content / Users Flagging. Ad quarantine helpers in quarantineAdLibrary.js + RPCs.",
        technicalFeatures: [
          "Dispositions include manually_deactivated, reactivated, reviewed, flags_cleared / flag_cleared",
          "Community 3-flag on ads can notify via notify-ad-asset-disabled (idempotent disable_notified_at)",
          "Threshold filters in Admin: All / 3+ / 5+ / 10+",
        ],
      },
    ],
  },
  {
    id: "advertising",
    label: "Advertising (Supporter) System",
    sections: [
      {
        id: "advertising-overview",
        title: "Advertising Overview",
        overview:
          "Supporters buy zip slots ($150/mo or $1,260/yr ≈ 30% off). Ads show on the homepage feed and in weekly digests. Default 3 slots per zip (admin-configurable). One slot per Supporter per zip. Creatives go through automated review.",
        features: [
          "Monthly / annual pricing",
          "Homepage + digest placement",
          "Configurable slots; one per Supporter per zip",
          "AI + URL review on Ad Assets",
        ],
        technicalOverview:
          "ad_zip_config, banner_ads, ad_library, ad pricing tables. Checkout /api/create-ad-checkout. Review /api/creative-review.",
        technicalFeatures: [
          "Statuses: pending_payment, pending_review, active, past_due, rejected, expired, cancelled, flagged, …",
          "Filler ads fill empty slots (admin_default_ads)",
        ],
      },
      {
        id: "ad-library",
        title: "Ad Library & Asset Cascade",
        overview:
          "Reusable approved creatives (image + link). In-use assets cannot be deleted. Flagging/disabling an asset can cascade across zip placements; Supporters are notified and can assign a different approved creative.",
        features: [
          "Library reuse at checkout/renewal",
          "Cannot delete assets used by live placements",
          "Cascade disable across matching placements",
          "What next messaging points Supporter to Ad Manager",
        ],
        technicalOverview:
          "ad_library + banner_ads.ad_library_id. quarantineAdLibrary.js / disable RPCs. Admin Ads + Flags.",
        technicalFeatures: [
          "moderation_status on assets; ManualReviewPanel for manual_review queue",
          "notifyAdCreativeDisabledAdmin / email paths for admin vs community cascade",
        ],
      },
      {
        id: "advertising-discounts",
        title: "Discount Codes",
        overview:
          "Admin percentage codes for monthly/annual/both, with expiry, max uses, per-user limits, and optional single-email restriction. Checkout shows struck-through original price.",
        features: [
          "Percent off with plan targeting",
          "Usage limits and personal codes",
          "Live discount preview at plan step",
        ],
        technicalOverview:
          "discount_codes validated in create-ad-checkout; usage stamped on banner_ads.",
        technicalFeatures: [
          "DiscountCodesPanel in Admin → Ads → Discounts",
        ],
      },
      {
        id: "advertising-rules",
        title: "Rules & Terms",
        overview:
          "Family-appropriate standards; TOS agreement at checkout; community flagging can pull ads from rotation.",
        features: [
          "TOS on Advertiser Terms + checkout agreement fields",
          "3-flag auto flagged status",
          "Clear unavailable messaging in Ad Manager",
        ],
        technicalOverview:
          "AdvertiserTerms.jsx; banner_ads.tos_agreed / tos_agreed_date.",
        technicalFeatures: [
          "InactiveAdCard explains past_due / flagged / admin disabled states",
        ],
      },
      {
        id: "advertising-moderation",
        title: "Ad Creative Review",
        keywords: ["moderation api", "openai", "vision", "ad review", "url check", "hybrid"],
        overview:
          "On submit, destination URL safety is checked first (separately from images). Then the ad image goes through the same hybrid flow as activity photos: free Moderation API first, custom vision only for gray scores, still one seamless review for the Supporter. Declines from either image phase (or from URL checks) can request Admin → Reviews → Advertising Manual Review. Status changes that hurt the Supporter require an explanation and notify them.",
        features: [
          "Separate URL safety checks (invalid, private, unsafe keywords, 404)",
          "Hybrid image review (Moderation API → custom vision when needed)",
          "Natural-language decline reasons",
          "Manual review after automated decline",
          "Required admin reason on damaging actions",
        ],
        technicalOverview:
          "/api/creative-review (URL then reviewImageHybrid); ManualReviewPanel; AdminAdsPanel. Client: moderateAdContent.js + AdLibraryManager.",
        technicalFeatures: [
          "URL declined before any OpenAI image call",
          "Image phases same thresholds as activity photos (api/_lib/imageModeration.js)",
          "Fail-open image approve if OPENAI_API_KEY missing (URL checks still run)",
        ],
      },
      {
        id: "zip-reservation",
        title: "Zip Reservation & Checkout",
        overview:
          "Choosing a zip holds the slot for 10 minutes during checkout so two Supporters cannot buy the same slot. Countdown shows in the flow; hold releases if abandoned.",
        features: [
          "10-minute reservation",
          "Live countdown",
          "Completes on successful Stripe checkout",
        ],
        technicalOverview:
          "Zip reservation records + AdManager checkout steps.",
        technicalFeatures: [
          "RESERVATION_MINUTES = 10",
        ],
      },
      {
        id: "advertising-waitlist",
        title: "Ad Waitlist",
        overview:
          "When a zip is full, Supporters join a waitlist. When a slot opens, the next person gets an offer (email + in-app) with a 24-hour window. Up to 3 offer attempts; then the queue moves on. Cron checks about every 30 minutes.",
        features: [
          "FIFO-style queue per zip",
          "24-hour offer window",
          "Max 3 offer attempts",
          "Admin can override / re-offer",
        ],
        technicalOverview:
          "ad_waitlist + /api/cron-process-waitlist (*/30) + processWaitlistCore. Manual /api/offer-waitlist-spot and expire helpers.",
        technicalFeatures: [
          "Statuses: waiting, offered, accepted, expired, declined, cancelled",
          "AdminWaitlistPanel under Ads → Waitlist",
        ],
      },
      {
        id: "advertising-payments",
        title: "Payments, Grace Period & Cancellation",
        overview:
          "Stripe Checkout + subscriptions. Failed renewal → Past Due with a 7-day grace period, then cleanup. From 14 days before renewal, Ad Manager shows cancel-outcome messaging. ~21 days before renewal, in-app renewal reminders can fire.",
        features: [
          "Stripe monthly/annual",
          "7-day grace on payment failure",
          "14-day cancel warning UI",
          "21-day renewal-soon notices (in-app)",
        ],
        technicalOverview:
          "api/stripe-webhook.js; cancel-ad-renewal; cron-grace-period-cleanup; cron-renewal-reminders; adBillingNotices.js.",
        technicalFeatures: [
          "invoice.payment_failed → notifyPaymentFailed (message + email)",
          "invoice.payment_succeeded → renew notices / plan switches as applicable",
        ],
      },
      {
        id: "advertising-plan-changes",
        title: "Plan Upgrades & Downgrades",
        overview:
          "Monthly ↔ annual switches are requested in Ad Manager, take effect at next renewal, and lock the new rate ~21 days before renewal.",
        features: [
          "Pending upgrade/downgrade flags",
          "Effect at renewal, not immediately",
          "21-day rate lock-in",
          "Cancel pending change supported",
        ],
        technicalOverview:
          "/api/request-ad-plan-change + /api/cron-process-ad-plan-changes (LOCK_IN_DAYS = 21).",
        technicalFeatures: [
          "Pending fields on banner_ads; Stripe price update at renewal",
        ],
      },
      {
        id: "advertising-default-ads",
        title: "Default / Filler Ads",
        overview:
          "Empty zip slots show admin-managed filler creatives so the feed and digests are never blank.",
        features: [
          "Admin assigns fillers to slots 1–3",
          "No billing / impression charges",
          "Used on homepage and digests",
        ],
        technicalOverview:
          "admin_default_ads + pickDefaultFillerAds (client and digest core).",
        technicalFeatures: [
          "Admin → Ads → Default/Filler",
        ],
      },
    ],
  },
  {
    id: "emails",
    label: "Emails & Digests",
    sections: [
      {
        id: "email-notifications",
        title: "Weekly Activity Digests",
        keywords: ["monday", "resend", "digest"],
        overview:
          "Opt-in weekly emails of matching activities for Community Members. Cron runs daily at 8:00am Pacific but only sends on Mondays. Default preference is Off. Emails include up to 8 activity cards plus supporter/filler ads for the user’s zip.",
        features: [
          "Weekly only (no daily/monthly)",
          "Monday ~8am PT",
          "Skip when zero matching activities",
          "Skips organizers and admins as digest recipients",
          "Manage Preferences + unsubscribe link in footer",
        ],
        technicalOverview:
          "vercel.json cron → /api/cron-send-notification-emails → sendMatchingDigests. HTML from buildDigestHtml. Send via sendViaResend.",
        technicalFeatures: [
          "frequenciesForToday() returns ['weekly'] only on Monday America/Los_Angeles",
          "Prefs frequency must be weekly; include_fav_organizers / include_other_activities drive matching",
          "Admin template preview: Previews → Emails (activity_digest)",
        ],
      },
      {
        id: "email-digest-safeguards",
        title: "Email Digest Safeguards & Cost Controls",
        keywords: [
          "EMAIL_SENDING_ENABLED",
          "pause",
          "inactivity",
          "suppression",
          "unsubscribe",
          "bounce",
          "kill switch",
        ],
        overview:
          "Digests are expensive if they go to abandoned or bad addresses. Safeguards: opt-in default Off; empty-week skip; hard-skip disabled; inactivity auto-off; Admin pause; env kill switch for all Resend mail; per-run cap; same-week send stamp; bounce/complaint suppressions; one-click unsubscribe.",
        features: [
          "Admin → Mass Messages → Digest Notification: Pause weekly digests (digests only; billing/waitlist still send)",
          "Env EMAIL_SENDING_ENABLED=false: stops ALL Resend sends (emergency)",
          "Inactivity: no sign-in within configured days (default 90) → Weekly forced Off",
          "Max digests per Monday run (default 200); last_digest_sent_at blocks same-week retries",
          "email_suppressions for bounce / complaint / unsubscribe / manual",
          "List-Unsubscribe headers + /unsubscribe page (no login required)",
          "Disabled accounts: digests Off on disable AND hard-skipped in the cron",
        ],
        technicalOverview:
          "email_config, email_suppressions, profiles.last_seen_at (touched ≤ hourly in AuthContext). emailGuards.js + sendNotificationDigestsCore.js. Webhook /api/resend-webhook. Unsubscribe /api/unsubscribe-digest.",
        technicalFeatures: [
          "digests_paused, inactivity_days (14–365), max_sends_per_run (1–5000)",
          "RESEND_WEBHOOK_SECRET verifies Svix signatures when set; test via send to bounced@resend.dev / complained@resend.dev",
          "UNSUBSCRIBE_SECRET optional; falls back to CRON_SECRET for HMAC tokens",
          "Account Email Notifications → More… documents auto-off for users; FAQs updated similarly",
        ],
      },
      {
        id: "email-supporter",
        title: "Supporter & Transactional Emails",
        overview:
          "Not all notices are digests. Waitlist offers and payment-failed notices use email (+ often in-app). Many billing/plan/creative notices are in-app only to control cost. Admin Previews lists each template and channel.",
        features: [
          "Waitlist offer: email + message",
          "Payment failed: email + message",
          "Renewal soon / renewed / plan change: typically in-app",
          "Ad creative disabled / declined: notify Supporter (email and/or message per path)",
        ],
        technicalOverview:
          "adBillingNotices.js, waitlist email helpers, quarantine notify routes, /api/send-email for Admin tester (sends to the signed-in admin).",
        technicalFeatures: [
          "Transactional mail still respects EMAIL_SENDING_ENABLED",
          "Admin digest pause does NOT block transactional Resend mail",
        ],
      },
    ],
  },
  {
    id: "messaging",
    label: "Mass & System Messaging",
    sections: [
      {
        id: "mass-messages",
        title: "Mass Messages",
        overview:
          "Admins compose one-way site messages to audiences (All, Community Members, Organizers, Advertisers — multi-select) and optional zip filters. Optional action button (label + in-app path). Archive lists past sends; Retract removes inbox copies and the archive row.",
        features: [
          "Audience chips + zip all/custom",
          "Optional CTA from approved in-app paths",
          "Archive + retract",
          "Does not email — inbox only",
        ],
        technicalOverview:
          "Admin → Mass Messages → Compose / Archive. send_mass_message / retract_mass_message RPCs. AdminMassMessagesPanel.jsx.",
        technicalFeatures: [
          "Audience excludes disabled users in SQL",
          "messageActionPages.js whitelist for action hrefs",
        ],
      },
      {
        id: "digest-admin-controls",
        title: "Digest Notification Controls",
        overview:
          "Same Mass Messages area hosts Digest Notification: pause switch, inactivity days, max sends per run, and counts of Weekly users vs suppressed addresses.",
        features: [
          "Pause weekly digests without redeploying",
          "Tune inactivity days and send cap",
          "See opted-in and suppressed counts",
        ],
        technicalOverview:
          "AdminDigestPanel reads/writes email_config; notes env kill switch for operators.",
        technicalFeatures: [
          "Section id mass-digest under Mass Messages sub-nav",
        ],
      },
      {
        id: "automated-notices",
        title: "Automated In-App Notices",
        overview:
          "Catalog of system messages (welcome, supporter welcome, billing, photo/ad decisions, flags). Previewed under Admin → Previews → Automated Messages without sending.",
        features: [
          "Catalog-driven copy",
          "Preview with sample data",
          "Triggered by DB events, webhooks, or Admin actions",
        ],
        technicalOverview:
          "userMessagesCatalog.js + insert helpers. PreviewsPanels.jsx.",
        technicalFeatures: [
          "Welcome trigger on new profiles migration",
        ],
      },
    ],
  },
  {
    id: "support",
    label: "Support & Resource Pages",
    sections: [
      {
        id: "contact-us",
        title: "Contact Us",
        overview:
          "Anyone can submit Contact Us (topic + message). Admin reviews in Contact Us tab by subject boxes. Messages soft-delete to a Deleted section and can be restored; they are not hard-deleted from the DB by that UI.",
        features: [
          "Topics: technical, suggestions, activity questions, general",
          "Admin: unread / resolved / deleted",
          "Soft-delete with restore",
        ],
        technicalOverview:
          "contact_messages with deleted_at. ContactUs.jsx + Admin Contact sections. Honeypot / timing on the form.",
        technicalFeatures: [
          "No Resend email on submit — Admin reviews in-app",
        ],
      },
      {
        id: "bot-protection",
        title: "Bot Protection",
        overview:
          "Contact and Register use honeypot fields and minimum fill times to reduce spam submissions.",
        features: [
          "Honeypot fields",
          "Minimum time on form before submit (~2s Contact / ~3s Register)",
        ],
        technicalOverview:
          "Client-side checks before insert/signUp.",
        technicalFeatures: [
          "Not a CAPTCHA; keeps UX light for real users",
        ],
      },
      {
        id: "tips-pages",
        title: "Tips Pages & FAQs",
        overview:
          "Public tips for Community Members, Organizers, and Supporters. FAQs are admin-managed and shown on About. Digest-related FAQ copy explains weekly-only and inactivity auto-off.",
        features: [
          "Tips routes per audience",
          "FAQ manager in Admin",
          "Public FAQ search/filter on About",
        ],
        technicalOverview:
          "faqs table; FAQManager; Tips* pages.",
        technicalFeatures: [
          "Migrations update FAQ answers when product rules change",
        ],
      },
    ],
  },
  {
    id: "admin-tools",
    label: "Admin Tools",
    sections: [
      {
        id: "admin-dashboard",
        title: "Admin Dashboard Map",
        overview:
          "Admin is a tabbed operator console. Many tabs have a sub-nav for sections. Access requires profiles.role = admin.",
        features: [
          "Activities — list/edit/remove activities",
          "Ads — supporter ads, zip config, waitlist, rates, discounts, fillers",
          "Beta — stage gates / zip whitelist",
          "Contact Us — inbound messages",
          "FAQs — manage public FAQ entries",
          "Flags — flagged content + users flagging",
          "Manual — this document",
          "Mass Messages — compose, archive, digest controls",
          "Previews — emails, automated messages, site notices",
          "Reviews — activity photos + ad creatives needing humans",
          "Users — zip reports, user list, reactivation requests",
        ],
        technicalOverview:
          "Admin.jsx tabs + AdminSubNav section arrays (ADS_SECTIONS, FLAGS_SECTIONS, USER_SECTIONS, PREVIEW_SECTIONS, REVIEW_SECTIONS, MASS_MESSAGE_SECTIONS, …).",
        technicalFeatures: [
          "Hard gate: if user.role !== 'admin' navigate home",
          "Consistent AdminSectionHeader + AdminPanelShell chrome",
        ],
      },
      {
        id: "admin-reviews",
        title: "Reviews Queues",
        overview:
          "Human queues for activity photos and advertising creatives that users send after an automated decline (from Moderation API phase 1 or custom vision phase 2), or that were escalated to manual_review. Automation usually finishes in one seamless pass; this queue is the human fallback.",
        features: [
          "Activity Manual Review",
          "Advertising Manual Review",
          "Approve/decline with notes; notify contributors/Supporters",
        ],
        technicalOverview:
          "Admin → Reviews. AdminActivityPhotoReviewPanel + ManualReviewPanel.",
        technicalFeatures: [
          "Queues filter moderation_status / image_moderation_status = manual_review",
          "Automated path: reviewImageHybrid (Moderation → optional vision); URL checks only on ads",
        ],
      },
      {
        id: "admin-beta-mode",
        title: "Beta Mode",
        overview:
          "Temporary access controls: Stage 1 access code and/or Stage 2 zip whitelist. Banner can show when beta is enabled.",
        features: [
          "Toggle beta / stage 1",
          "Access code",
          "Allowed zip list",
        ],
        technicalOverview:
          "beta_config table; AdminBetaPanel; BetaBanner / BetaStage1Gate.",
        technicalFeatures: [
          "Publicly readable config for client gates",
        ],
      },
      {
        id: "admin-user-zip-reports",
        title: "User Zip Reports",
        overview:
          "At-a-glance community strength by zip: Community Members, Organizers, active Supporters, waitlisted demand.",
        features: [
          "Per-zip tallies",
          "Top-zip ranking + search",
        ],
        technicalOverview:
          "AdminUserZipReportsSection + ZipCodeRankingCard under Users → Zip Code Reports.",
        technicalFeatures: [
          "Aggregates profiles, banner_ads, ad_waitlist",
        ],
      },
      {
        id: "admin-previews",
        title: "Previews Tab",
        overview:
          "Safe previews of outbound-looking content: email HTML templates, automated message catalog, and site notices — without blasting users.",
        features: [
          "Emails tester (send sample to the signed-in admin only)",
          "Automated Messages catalog",
          "Site Notices preview",
        ],
        technicalOverview:
          "PreviewsPanels + SiteEmailsTester + SiteNoticesPreview under Admin → Previews.",
        technicalFeatures: [
          "Email send uses /api/send-email admin auth",
        ],
      },
    ],
  },
];

function sectionSearchText(section, categoryLabel) {
  return [
    categoryLabel,
    section.title,
    section.overview,
    section.technicalOverview,
    ...(section.features || []),
    ...(section.technicalFeatures || []),
    ...(section.keywords || []),
  ]
    .join(" ")
    .toLowerCase();
}

function parseSearchTerms(query) {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function filterCategories(query) {
  const terms = parseSearchTerms(query);
  if (!terms.length) return categories.map((c) => ({ ...c, sections: c.sections }));

  return categories
    .map((cat) => {
      const sections = cat.sections.filter((section) => {
        const hay = sectionSearchText(section, cat.label);
        return terms.every((t) => hay.includes(t));
      });
      return { ...cat, sections };
    })
    .filter((cat) => cat.sections.length > 0);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Split text into plain + highlighted parts for active search terms (case-insensitive). */
function HighlightedText({ text, terms }) {
  if (!text) return null;
  if (!terms?.length) return text;

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const parts = String(text).split(pattern);
  if (parts.length === 1) return text;

  const termSet = new Set(terms.map((t) => t.toLowerCase()));
  return parts.map((part, i) =>
    termSet.has(part.toLowerCase()) ? (
      <mark
        key={`${i}-${part}`}
        className="bg-amber-200/90 text-foreground rounded-sm px-0.5 font-semibold not-italic"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={`${i}-${part}`}>{part}</React.Fragment>
    )
  );
}

export default function AdminManual() {
  const [openSection, setOpenSection] = useState(null);
  const [query, setQuery] = useState("");

  const searchTerms = useMemo(() => parseSearchTerms(query), [query]);
  const visible = useMemo(() => filterCategories(query), [query]);
  const matchCount = useMemo(
    () => visible.reduce((n, c) => n + c.sections.length, 0),
    [visible]
  );
  const searching = searchTerms.length > 0;

  const scrollToCategory = (catId) => {
    const el = document.getElementById(`manual-cat-${catId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6">
      <div className="mb-3 flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-mint-500 shrink-0" />
        <h2 className="font-heading font-bold text-lg text-foreground">Site Manual</h2>
      </div>

      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Operator reference for LocalKidsCalendar: what each area does, the rules that matter day-to-day, and a technical breakdown for implementation details.
          Expand a topic for the overview bullets, then the technical section underneath. Update this manual when product behavior changes.
        </p>

        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keywords (e.g. digest, waitlist, disable…)"
            className="pl-9 pr-9 rounded-xl"
            aria-label="Search site manual"
          />
          {searching && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {searching && (
          <p className="text-xs text-muted-foreground">
            {matchCount === 0
              ? "No topics matched. Try a different keyword."
              : `${matchCount} topic${matchCount === 1 ? "" : "s"} matched — sections expanded with search words highlighted.`}
          </p>
        )}

        {!searching && (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => scrollToCategory(cat.id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted hover:bg-mint-100 hover:text-mint-600 transition-colors"
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {visible.map((category) => (
        <div key={category.id} id={`manual-cat-${category.id}`} className="space-y-3 scroll-mt-4">
          <h2 className="font-heading font-bold text-lg text-foreground px-1">
            <HighlightedText text={category.label} terms={searchTerms} />
          </h2>
          {category.sections.map((section) => {
            const isOpen = searching || openSection === section.id;
            return (
              <div key={section.id} className="bg-white rounded-2xl border border-border overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/40 transition-colors"
                  onClick={() => {
                    if (searching) return;
                    setOpenSection(openSection === section.id ? null : section.id);
                  }}
                >
                  <span className="font-heading font-semibold text-sm text-foreground">
                    <HighlightedText text={section.title} terms={searchTerms} />
                  </span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                    <div>
                      <h4 className="font-medium text-sm text-foreground mb-2">Overview</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                        <HighlightedText text={section.overview} terms={searchTerms} />
                      </p>
                      <ul className="list-disc pl-5 space-y-1">
                        {section.features.map((f, i) => (
                          <li key={i} className="text-sm text-muted-foreground leading-relaxed">
                            <HighlightedText text={f} terms={searchTerms} />
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-muted/40 rounded-xl p-4">
                      <h4 className="font-medium text-sm text-foreground mb-2 flex items-center gap-2">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Review in more detail — technical breakdown
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed font-mono mb-2">
                        <HighlightedText text={section.technicalOverview} terms={searchTerms} />
                      </p>
                      <ul className="list-disc pl-5 space-y-1">
                        {section.technicalFeatures.map((f, i) => (
                          <li key={i} className="text-xs text-muted-foreground leading-relaxed font-mono">
                            <HighlightedText text={f} terms={searchTerms} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
