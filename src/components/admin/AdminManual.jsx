import React, { useMemo, useState } from "react";
import { BookOpen, ExternalLink, ChevronDown, ChevronUp, Search } from "lucide-react";
import SearchClearField from "@/components/shared/SearchClearField";

/**
 * Admin Site Manual — layman overview + technical breakdown per topic.
 *
 * STANDING RULE: Update this file whenever product rules, admin workflows,
 * signup/profile behavior, or major UX changes ship (same PR / same change set).
 * Prefer updating the relevant section(s) rather than only mentioning changes in chat.
 *
 * Shape per section:
 *   id, title, overview, features[], technicalOverview, technicalFeatures[]
 * Optional: keywords[] — extra search terms not already in the prose
 * Optional: flowCharts[] — { title, caption?, columns[], rows[][] } operator reference tables
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
          "Auth & database: Supabase Auth + Postgres tables with Row Level Security (owners edit own rows; privileged columns locked)",
          "Server: Vercel /api/* routes (checkout, webhooks, digests, photo/ad review, disable user)",
          "Email: Resend; payments: Stripe; image review: OpenAI Moderation API + custom vision when a key is configured; uploads resized client-side before Storage/OpenAI",
        ],
        technicalOverview:
          "Client uses @/lib/supabaseClient.js. Privileged server work uses SUPABASE_SERVICE_ROLE_KEY via createAdminClient() in api/_lib/stripeHelpers.js. Crons are declared in vercel.json (see Scheduled Jobs section for Pacific Time table) and authenticated with CRON_SECRET (or x-vercel-cron).",
        technicalFeatures: [
          "Env (Vite): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY; optional VITE_API_BASE_URL / VITE_APP_URL (production site https://localkidscalendar.com; *.vercel.app still works)",
          "Env (server): SUPABASE_*, RESEND_*, STRIPE_*, OPENAI_API_KEY, CRON_SECRET, EMAIL_SENDING_ENABLED, RESEND_WEBHOOK_SECRET, APP_URL/VITE_APP_URL for email links",
          "Migrations live under supabase/migrations/; production SQL is often applied via the Supabase SQL Editor",
          "RLS ownership on profiles/events/comments/saves/ads/messages; event-media INSERT requires path `{userId}/…`; BEFORE UPDATE triggers lock flag/billing/inbox privileged columns for non-admins (ensure_harden_owner_write_guards.sql)",
          "Legal pages: /terms and /privacy from legalContent.js (Nevada governing law); Supporter TOS remains /advertiser-terms; Community Rules stay on About",
          "Legacy Base44 export archived under archive/base44-prototype/ (not used at runtime)",
          "After connecting the custom domain: set Supabase Auth Site URL + Redirect URLs, Google OAuth origins, Vercel VITE_APP_URL/APP_URL, and Resend domain verification",
        ],
      },
      {
        id: "cron-schedules",
        title: "Scheduled Jobs (Crons)",
        keywords: [
          "cron",
          "schedule",
          "pacific",
          "pt",
          "waitlist",
          "digest",
          "renewal",
          "grace period",
          "plan change",
          "vercel.json",
        ],
        overview:
          "Vercel Cron Jobs call secured /api/cron-* routes on a fixed daily schedule. Times below are Pacific Time (PDT). In winter (PST) they run one hour earlier on the clock. Schedules in vercel.json are stored in UTC.",
        features: [
          "All five jobs run once per day (waitlist is no longer every 30 minutes)",
          "Weekly digests: cron runs every day at 8:00 AM PT, but emails only send on Tuesdays",
          "Auth: CRON_SECRET bearer and/or x-vercel-cron header",
          "See also: Ad Waitlist; Weekly Activity Digests; Payments / Plan changes",
        ],
        flowCharts: [
          {
            title: "Daily cron schedule (Pacific Time)",
            caption:
              "PDT shown. Winter (PST): subtract one hour. Source of truth for UTC expressions: vercel.json.",
            columns: ["Pacific Time (PDT)", "Job", "What it does", "UTC (vercel.json)"],
            rows: [
              [
                "7:00 AM",
                "Waitlist",
                "Expire stale offers; advance open zip slots to the next person in line",
                "0 14 * * *",
              ],
              [
                "8:00 AM",
                "Weekly digests",
                "Send matching activity digests (Tuesday only; other days no-op)",
                "0 15 * * *",
              ],
              [
                "9:00 AM",
                "Renewal reminders",
                "In-app “renewing soon” for ads ~21 days from renewal",
                "0 16 * * *",
              ],
              [
                "9:30 AM",
                "Ad plan changes",
                "Lock in pending monthly ↔ annual switches near renewal; update Stripe when possible",
                "30 16 * * *",
              ],
              [
                "10:00 AM",
                "Grace-period cleanup",
                "Expire past_due ads after 7-day grace; advance waitlist",
                "0 17 * * *",
              ],
            ],
          },
        ],
        technicalOverview:
          "vercel.json → crons[].path. Handlers: cron-process-waitlist, cron-send-notification-emails, cron-renewal-reminders, cron-process-ad-plan-changes, cron-grace-period-cleanup. Keep Admin JWT routes separate (CRON_SECRET rejects admin tokens on cron-only paths).",
        technicalFeatures: [
          "Waitlist also advances from other flows (e.g. grace cleanup, Admin disable, manual Admin waitlist tools) — cron is the daily sweep",
          "Update this table whenever vercel.json schedules change",
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
          "Anywhere a zip is entered, the site requires a valid 5-digit US zip. Search distance (radius) is set on My Account → Profile after signup (default 15 miles) — it is not asked on the create-account profile form. Zip + distance drive homepage filtering and “local” meaning for the session.",
        features: [
          "5-digit zip only (no letters, no ZIP+4)",
          "Profile distance options typically 5 / 10 / 15 / 25 / 50 / 100 miles; default 15",
          "Register / finish-profile: zip required; distance omitted (defaults to 15 until edited on Profile)",
          "Also used on Post Activity, Ad checkout, and Home filters",
        ],
        technicalOverview:
          "Client masks enforce /^\\d{5}$/. Profile stores zip_code and radius_miles on profiles. Distance filtering uses Haversine against geocoded coordinates (zippopotam.us).",
        technicalFeatures: [
          "profiles.radius_miles column (migration profile_radius_miles)",
          "locationDefaults.js centralizes DEFAULT_RADIUS_MILES; Register finalizeProfile writes the default",
          "Exact zip matching is still used in weekly digest matching today (radius geocoding for digests is not applied yet)",
        ],
      },
      {
        id: "title-case-rules",
        title: "Capitalization (Strict vs Soft Title Case)",
        keywords: ["title case", "strict", "soft", "capitalization", "STEM", "YMCA"],
        overview:
          "Form fields use two capitalization helpers so names and titles stay readable without fighting abbreviations.",
        features: [
          "Strict Title Case: first letter of each word up; rest forced lowercase — Community Member first/last name (Register + Profile)",
          "Soft Title Case: first letter of each word up; other letters left as typed (STEM/YMCA OK); shouty ALL CAPS titles are converted — activity Title / Venue / Contact Name, Organizer name (Register + Profile), and Ad Library Asset Name",
          "Street / city on Post Activity still use a simple strict-style title case helper",
        ],
        technicalOverview:
          "src/lib/titleCase.js — toStrictTitleCase (live inputs, preserves spaces), toTitleCaseLabel (trimmed labels), formatActivityTitle (soft + shout detection).",
        technicalFeatures: [
          "Shout detection in formatActivityTitle: letters-only all uppercase, ≥6 letters, and 2+ words or ≥12 letters",
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
        keywords: ["otp", "google", "oauth", "password", "sign up", "register", "honeypot", "bot", "spam", "complete profile"],
        overview:
          "Users register with email/password or Google. Account type (Community Member or Organizer) is chosen on the shared Register profile step and is permanent for that email. Google and any incomplete profile finish on the same Register form — not on My Account → Profile. Email verification uses Supabase confirm flows. Until the profile zip is saved, the rest of the app is gated.",
        features: [
          "Sign-up: email/password or Google OAuth (Register and Login both offer Google)",
          "One profile form for email step 2 and Google/incomplete finish (?complete=1)",
          "Account type: Community Member or Organizer — locked after registration completes",
          "Register asks for names/org + zip (not distance); agreement required for Terms of Service, Privacy Policy, and Community Rules",
          "Incomplete signed-in users cannot browse the site until they finish Register (About / Community Rules / Terms / Privacy still allowed)",
          "Email verification / password reset via Supabase Auth email (branded From requires Custom SMTP — see Email / Auth SMTP)",
          "Register header uses the site /logo.png (same mark as Login)",
          "First-line bot defense on email Register: honeypot + ~3s minimum + Cloudflare Turnstile (verified server-side before signUp)",
        ],
        technicalOverview:
          "Register.jsx / Login.jsx / AuthCallback.jsx / AppLayout.jsx. Google creates auth.users + handle_new_user profile (default community_member, empty zip). AuthCallback and AppLayout send incomplete users to /register?complete=1. isProfileComplete (authRoles.js) requires zip (admins/disabled exempt). Role may change once while zip is still empty (DB trigger prevent_non_admin_role_change).",
        technicalFeatures: [
          "profiles.role from metadata; default community_member if missing",
          "Auth invite links can prefill role/email query params on Register",
          "Primary admin email may be promoted to role=admin via SQL migrations (ensure_admin_role)",
          "Navbar/Admin access: role === 'admin' (Admin page hard-requires admin)",
          "Register honeypot + timing + Turnstile action register via /api/verify-turnstile before signUp (OAuth complete path skips Turnstile)",
          "registeredUser in AuthContext requires isRegistered && isProfileComplete",
          "Migration allow_initial_role_selection.sql — one-time CM↔Organizer while zip empty",
        ],
      },
      {
        id: "user-types",
        title: "Roles: Community Member, Organizer, Admin, Disabled",
        keywords: ["role", "organizer", "community_member", "admin", "suspended"],
        overview:
          "Community Members browse, save, flag, comment, and can post activities. Organizers get org branding and directory presence. Admin is a privileged operator role (not chosen at signup). Disabled accounts cannot use the site normally and see the Account Disabled experience. Suspended is separate from Disabled: at 3+ user flags the account is limited to guest actions + My Messages until Admin clears flags or uses Manual Disable.",
        features: [
          "community_member: core family/user experience",
          "organizer: same plus org profile (name, logo, website, email) and directory listing",
          "admin: Admin panel + elevated APIs; primary account often localkidscalendar@gmail.com",
          "disabled: blocked; digests forced off; prior role stored for restore; content archived; directory hidden",
          "suspended (profiles.suspended_at): guest actions only; digests Off; Ad Manager frozen; can sign in + My Messages; public content and ads stay; organizer still appears in the directory",
          "Supporter is not a role — it is profiles.is_advertiser on top of CM or Organizer",
        ],
        technicalOverview:
          "profiles.role check constraint: admin | organizer | community_member | disabled. organizers table is 1:1 with user_id. Admin Users → List of Users shows role badges, Suspended / Supporter chips, Contributions / Flagged / Flags Filed expanders, and Actions (Grant Supporter, Disable/Reactivate). Search supports Clear plus filters All / Admins / Community Members / Organizers / Supporters.",
        technicalFeatures: [
          "role_before_disabled preserved on disable; restoreRoleFromProfile in authRoles.js",
          "isAccountSuspended gates registered actions while role stays CM/Organizer",
          "Weekly digests intentionally skip organizer and admin recipients (and suspended/disabled)",
          "ProfileTab locks role after registration for non-admins (edit Profile never offers account-type change); admins keep their real role on save",
          "authRoles.isProfileComplete gates app access until zip is set",
          "Organizer org website: validateRequiredPublicWebsite on Register + ProfileTab (shared/linkUrlSafety.js)",
        ],
      },
      {
        id: "account-disable-reactivation",
        title: "Disable Account & Reactivation Requests",
        keywords: ["disable", "reactivate", "banned", "account disabled", "suspend"],
        overview:
          "Admins can disable a user with a required note (severe path, including from Flagged Users → Manual Disable). The user is treated as signed out for normal features, digests turn Off, their active activities and comments are archived (savers get the Saved Activity Removed notice), organizer directory listing is hidden, and they see an Account Disabled page with the note. They may submit one reactivation request for Admin review. Suspension from 3+ user flags is lighter and does not archive content or hide the organizer.",
        features: [
          "Always: role → disabled, digests Off, active activities/comments archived, note shown on Account Disabled",
          "Optional email checkbox on the disable dialog (same Admin note plus structured impact: account effects, and for Supporters ads/renewals/waitlist)",
          "Manual Disable prompt loads this user’s live ads/waitlist and shows counts (slot-holding ads by status + zips, Stripe subs, waitlist) before confirm",
          "Account Disabled page always shows “What this means” (plus Supporter ads/billing bullets when is_advertiser)",
          "Disable email (when sent) includes the same impact summary",
          "Savers of hidden activities get a generic saved_activity_removed notice (never the Admin disable note)",
          "Favoriters of the organizer get favorited_organizer_removed",
          "Organizer directory hides disabled accounts (suspended accounts still appear)",
          "Supporters also: slot-holding ads cancelled, Stripe set not to renew, waitlist cleared, waitlist processor runs",
          "Reactivation: one request per disable cycle (pending / reactivated / declined); a new Admin Disable clears the prior request",
          "Reactivation Requests: All / Open / Closed filter pills next to search (default Open); cards match List of Users identity; Disable context collapses by default (summary: source · flag count · date) and expands to show note, Admin History, and each user-flag report",
          "Approve / Decline both use AdminNoteConfirmDialog with a note to the user (approve note goes in the inbox Message)",
          "Approve dialog lists what is / is not restored (ads, Stripe, waitlist called out for Supporters); inbox Message matches",
          "On approve: prior role restored; Flagged Users case → Manually Reinstated (shows Deactivated + Reinstated pills); optional checkboxes to restore activities/comments archived by the disable; organizer directory returns with Organizer role; digests, ads, and Stripe are not auto-restored",
          "Flow tables: Admin Manual → Admin Communication & Moderation Flows",
        ],
        technicalOverview:
          "Admin Users → Actions → Disable (or Flagged Users Manual Disable) uses AdminNoteConfirmDialog (required note + optional email) → /api/admin-disable-user with disable_source (users_list | flagged_users) stored on user_flag_case_admin_history (also deletes account_reactivation_requests for that user). Content hide archives events/comments; trg_notify_on_content_hidden notifies savers with generic copy only; notify_favoriters_organizer_removed notifies favoriters. Reactivation rows live in account_reactivation_requests. Approve calls notifyAccountReactivated (optional admin note). Stale reactivated rows can be reopened by the disabled user (ensure_reactivation_per_disable_cycle.sql). UI: AccountDisabled.jsx + Admin Users → Reactivation Requests.",
        technicalFeatures: [
          "Caller must be admin (or allowlisted admin email on the API)",
          "Optional send_email delivers the disable note via Resend; Account Disabled page always shows the note",
          "Non-supporter path: role/digest + content hide",
          "Supporter path: banner_ads + Stripe cancel_at_period_end + ad_waitlist cleanup + processWaitlist",
          "authRoles.isAccountDisabled / isRegisteredUser gate registered-only features",
          "ensure_admin_notes_savers_generic.sql — saver notices never include Admin’s poster/user notes",
        ],
      },
      {
        id: "supporter-users",
        title: "Supporter (Advertiser) Flag",
        overview:
          "Supporters buy zip ad slots and use Ad Manager for creatives, billing, waitlist, and renewals. Supporter status is an add-on (is_advertiser) on a Community Member or Organizer account — one active slot per zip per Supporter.",
        features: [
          "Ad Manager for creatives, placements, renewals, plan changes, waitlist",
          "My Active Ads shows the masked card on file and Update Payment Method (Stripe Customer Portal)",
          "Granted automatically on first purchase or via Admin",
          "One slot-holding placement per zip per Supporter",
          "While suspended, Ad Manager is frozen (ads already running continue)",
        ],
        technicalOverview:
          "profiles.is_advertiser. Placements in banner_ads; creatives in ad_library. Checkout via /api/create-ad-checkout. Admin Users → Actions can Grant/Remove Supporter.",
        technicalFeatures: [
          "Slot-holding statuses: active, pending_payment, pending_review, flagged, past_due",
          "Admin can grant advertiser flag from Users",
        ],
      },
      {
        id: "user-dashboard",
        title: "My Account Tabs",
        overview:
          "Everything personal lives under My Account. Default tab is Messages. Profile is for editing a completed account (zip, distance, names/org, password reset) — not for first-time signup. Incomplete Google/email profiles are sent to Register to finish. Suspended accounts can still open Account → Messages only.",
        features: [
          "Messages (default) — in-app inbox",
          "My Activity Posts — Active / Inactive filter chips; inactive rows show reason in the status pill (e.g. Inactive: User Deactivated, Inactive: 3-User Flags, Inactive: Admin Removed)",
          "Saved Activities, Fav Organizers, Email Notifications, Home Search Filters (My Filters), Profile",
          "Profile: account type read-only; distance editable; names/org use Strict/Soft Title Case",
          "Suspended: banner + Messages-only; other tabs and guest-restricted site actions paused",
        ],
        technicalOverview:
          "Account.jsx VALID_TABS: messages, posts, saved, saved-organizers, notifications, saved-filters, profile. Unread badge uses countUnreadMessages. Suspended path uses isAccountSuspended(sessionUser).",
        technicalFeatures: [
          "?tab=flagged redirects to messages (legacy links)",
          "Incomplete profiles: AuthCallback + AppLayout → /register?complete=1 (not Account ?setup=1)",
        ],
      },
      {
        id: "user-messages-inbox",
        title: "In-App Messages Inbox",
        keywords: ["inbox", "user_messages", "welcome"],
        overview:
          "One-way inbox for site notices: welcome messages, billing/plan notices, photo/ad decisions, the full community-flag lifecycle for content and for user (account) flags, and Admin mass messages. Users can mark read and soft-delete. Many items include optional action buttons (e.g. open Ad Manager or My Activity Posts).",
        features: [
          "Unread count in nav / Account tab",
          "System + Admin-authored messages",
          "Content flag lifecycle notices for activities, comments, and Ad Assets",
          "User-flag notices: flagged (1/2), suspended at 3, withdraw, Clear Flags / partial clear",
          "Account reactivation approved → inbox notice (digests stay Off; content/ads not auto-restored)",
          "Optional action label + in-app path",
          "Soft-delete from the user’s view",
        ],
        technicalOverview:
          "user_messages table + helpers in userMessages.js / userMessagesCatalog.js. Content flag notices via notify_owner_flag_lifecycle / admin_notify_owner_flag_lifecycle; user-flag notices via notify_owner_user_flag_lifecycle / admin_notify_owner_user_flag_lifecycle. Welcome onboarding inserts on new profile. Admin Previews → Automated Messages shows the full catalog.",
        technicalFeatures: [
          "Mass messages fan out copies then can be retracted (soft-delete copies + remove archive row)",
          "Some flows are inbox-only (e.g. renewal-soon, most flag notices); others also send Resend email (payment failed, waitlist offer, ad disabled at 3+)",
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
          "Frequency: Off (default) or Weekly (Tuesdays)",
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
          "Community Members and Organizers post activities with dates, ages, cost, location, categories (up to three), and optional photo. End date is required and cannot be before start date (clamped on change; iOS pickers may not gray out earlier days). Community Rules and Terms of Service must be accepted. Validation toasts appear near the bottom on mobile so they stay visible by Submit.",
        features: [
          "Categories / types for camps, classes, sports, etc.",
          "Organizer posts show org branding / highlight styling",
          "Photo optional; auto-resized then AI-reviewed on upload",
          "Optional website field validated when provided (same public-domain rules as ad links)",
          "Zip must be 5 digits; end date required and on/after start date",
          "Title, venue, and contact name use Soft Title Case",
          "Duplicate posts must change a significant field before re-submit",
        ],
        technicalOverview:
          "PostEvent.jsx inserts into events (form noValidate so JS validation always runs). Client processImageForUpload then Supabase event-media upload, then /api/photo-review. posted_by_role / org fields drive EventCard styling. Toasts: src/components/ui/toast.jsx bottom / safe-area.",
        technicalFeatures: [
          "events.status active | deleted | archived | expired",
          "End date onChange clamps to start_date; start_date change also lifts end_date if needed",
          "HistoryBackLink / navigation history for cancel/back UX where wired",
          "src/lib/imageProcess.js presets: activityPhoto + logo",
          "formatActivityTitle on title, location_name, contact_name",
          "validateOptionalPublicWebsite (shared/linkUrlSafety.js) on optional activity website",
        ],
      },
      {
        id: "image-upload-sizing",
        title: "Image Upload Size Management",
        keywords: ["resize", "compress", "storage", "2mb", "logo", "photo", "supabase", "openai"],
        overview:
          "Before any image hits Supabase Storage or OpenAI review, the browser resizes and compresses it to managed dimensions and file size. Users may pick normal phone photos (often 3–8 MB); originals over 15 MB are rejected as too large to process. After processing, a 2 MB hard ceiling applies (512 KB for logos). This keeps review costs and storage under control without asking users to manually shrink files.",
        features: [
          "Auto resize/compress on activity photos, org logos, Ad Assets, and Admin default ads",
          "Accept typical phone photos; fail fast only on absurd originals (>15 MB)",
          "Validate type + minimum dimensions; SVG not allowed",
          "Help tips / Supporter copy explain best display fit and automatic resizing",
        ],
        technicalOverview:
          "Shared helper src/lib/imageProcess.js (processImageForUpload). Wired in PostEvent.jsx, ProfileTab.jsx, AdLibraryManager.jsx, AdminDefaultAdsPanel.jsx. Uploads go to the public event-media bucket under `{auth.uid()}/…` (RLS enforces the folder).",
        technicalFeatures: [
          "Presets: activityPhoto ≤1600×1200 JPEG; adCreative ≤1200×800 JPEG (3:2 visible area; homepage footer is separate); defaultAd ≤1200×858 JPEG (full card height = Supporter 3:2 + footer row, no bar); logo ≤512×512 PNG (falls back to JPEG if still large)",
          "MAX_ORIGINAL_BYTES = 15 MB; MAX_OUTPUT_BYTES_DEFAULT = 2 MB; logo maxOutputBytes = 512 KB",
          "Pipeline: validate original → canvas fitWithin (no upscale) → quality/scale encode → validate result → upload",
          "OpenAI and Storage only see the processed file URL/bytes",
        ],
      },
      {
        id: "activity-photo-moderation",
        title: "Activity Photo Moderation",
        keywords: ["moderation api", "openai", "vision", "photo review", "hybrid"],
        overview:
          "Cover photos are resized/compressed in the browser, then screened automatically. Phase 1 uses OpenAI’s free Moderation API for clear approve/decline (with natural-language decline reasons). Phase 2 (custom gpt-4o-mini vision) runs only when Moderation scores are in the gray middle — still looking like one review to the user. Declines from either phase can request Admin manual review. Community flagging remains a safety net.",
        features: [
          "Client resize/compress before upload and review",
          "Automatic hybrid review on upload (Moderation first, custom vision only when needed)",
          "Natural-language decline reasons (not raw category labels)",
          "Request Manual Review after an automated decline",
          "New posts: review enters the Admin queue only after Submit (copy says so); edits persist the request immediately",
          "Admin approve / decline with notes (inbox CTA: View Activity or Edit Activity for that listing)",
        ],
        technicalOverview:
          "processImageForUpload → event-media → /api/photo-review → reviewImageHybrid. Admin → Reviews → Activity Manual Review (AdminActivityPhotoReviewPanel). Client: PostEvent.jsx + moderateEventImage.js + imageProcess.js.",
        technicalFeatures: [
          "image_moderation_status: approved / declined / manual_review / manual_review_declined / …",
          "PostEvent handleRequestManualImageReview: editId → update events row now; create/duplicate → form-only until insert",
          "notifyActivityPhotoDecision: approve → /event/{id}; decline → /post-event?edit={id}",
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
          "Desktop Cards / List toggle (list is compact rows; phone stays stacked cards)",
          "Session persistence; More Filters auto-expands when advanced values restored",
          "Saved Activities / Fav Organizers / My Filters mutually exclusive",
        ],
        technicalOverview:
          "EventFilters + Home.jsx sessionStorage (home_filters_session, home_feed_layout). Distance via Haversine. Cap ~200 results. Mobile: category full-width; From/to/To dates stay on one row. List layout is lg+ only.",
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
          "Signed-in users comment on Event Detail. Authors can edit or soft-delete their own comments. Comments can be flagged and auto-archived at the same 3-flag threshold as activities.",
        features: [
          "Thread on Event Detail",
          "Authors can Edit or Delete their own comments",
          "Flag with the same reason set as activities",
          "Auto-hide at 3 distinct flaggers; author gets inbox notices for each flag / withdraw / admin clear or reinstate",
        ],
        technicalOverview:
          "comments table with flag_count / flagged_by / status. Owner update/delete via RLS. Shown in Admin → Flags with events and ads.",
        technicalFeatures: [
          "status active | deleted | archived (author delete uses deleted)",
          "Flag lifecycle notices via notify_owner_flag_lifecycle",
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
          "saved_events and favorite_organizers tables. EventDetail Posted by card: icon-only Favorite (organizers) + Flag User in the upper-right (subtle muted icons). Organizers directory also favorites. Auth prompt when signed out.",
        technicalFeatures: [
          "Digest uses favorite_organizers.poster_user_id vs event.created_by_id",
          "Community Member posters cannot be favorited — keeps Fav Organizers / digests organizer-focused",
          "Cleanup migration removes favorite_organizers rows targeting community_member profiles",
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
          "Public list of registered organizers near your Home zip + distance, with profile details and favorite actions for signed-in users.",
        features: [
          "Browse organizers near your Home zip + distance",
          "Org name, description, links, logo when set",
          "Favorite from directory",
        ],
        technicalOverview:
          "Organizers.jsx filters the directory by the same session zip + radius as Home (Haversine via Zippopotam). An organizer appears if they have an active activity in range and/or their profile zip is in range.",
        technicalFeatures: [
          "Unique organizers.user_id",
          "Reads session_zip_current + session_radius; falls back to exact zip only when geocoding is unavailable",
        ],
      },
      {
        id: "flagging-system",
        title: "Flagging & Admin Disposition",
        keywords: ["flag", "3 flags", "override", "flag_auto_hide_exempt", "cascade"],
        overview:
          "Registered users flag activities, comments, or ad creatives from a centered reason modal. Activities and comments use Inaccurate, Inappropriate, Spam, or Other (details required). Ad creatives use Inappropriate, Spam, or Other — not Inaccurate. Separately, community members can flag a user (not the listing) from Posted by / Organizer cards for Misrepresented User, Disregard for Our Community Rules, or Other — details required for all. Owners get an inbox notice on every flag (with reason and N of 3), on reporter withdraw, and when Admin clears flags or uses Override 3+ (content only). At 3 distinct content flaggers, activities/comments auto-archive; ad flags attach to the Ad Asset and disable that creative across all zip placements — unless Admin has applied Override 3+. At 3 distinct user flaggers, the account is suspended for Admin review (guest actions; ads/content stay). Admin Flags reviews dispositions and history.",
        features: [
          "Flag reason prompt opens as a centered modal (not an inline strip)",
          "Shared reasons for activities/comments; ads omit Inaccurate; Other requires text",
          "User flags: Misrepresented User / Disregard for Our Community Rules / Other — details required for every reason",
          "Tapping Flag again after reporting offers Remove Flag (withdraw_flag) or Keep Flag",
          "Owner inbox notices for flag 1/2/3 (with reason), reporter withdraw, Clear Flags (second chance), and Override 3+ (content)",
          "Preview all flag notice copy under Admin → Previews → Automated Messages",
          "Threshold: 3 different users → activity/comment status archived; Ad Asset → moderation flagged (all placements)",
          "User 3+ threshold: suspend account for Admin review (no Override 3+); Clear Flags or individual Clear Flag can reinstate below 3; digests stay Off after unsuspend — Message tells them to re-enable in Account → Notifications",
          "Override 3+: confirm, reinstate, set flag_auto_hide_exempt so further community flags do not auto-hide (users can still flag → Admin Flags + owner notice); case is marked Reviewed",
          "Clear Flags: second chance — flag count hard-reset to 0 (reports retained as cleared), clears exemption so auto-hide can apply again, reinstates content even after Manual Deactivate; case is marked Reviewed",
          "Clear Flag (one): keeps report so that reporter cannot re-flag or withdraw; never undoes Manual Deactivate (use Clear Flags, Reactivate, or Override to bring content back)",
          "Clear Flag / Clear Flags run as one server transaction (admin_clear_flag / admin_clear_all_flags) — same buttons, no mid-clear half-state",
          "Clear Flag / Clear Flags / Manually Deactivate use AdminNoteConfirmDialog (optional notes on clear; required notes on deactivate; ads always email)",
          "Suspended / disabled accounts cannot submit content flags (same account-blocked check as other registered actions)",
          "Activities trash and Flags Manually Deactivate (activities) share remove flow: deleted + admin_notes + activity_removed_admin; savers get generic copy only",
          "Owners cannot flag their own activity, comment, or ad creative; users cannot flag themselves or Admins",
          "Admin → Flags is the primary place for 3+ Override / Clear Flags (All Activities shows a Flag shortcut that opens Flags with the activity title in search)",
          "Admin → Flags → Flagged Content: one card per activity/comment/ad (nested reports); case actions Clear Flags → Manually Deactivate or Override 3+ → Reviewed; per-report Clear Flag",
          "Admin → Flags → Flagged Users: one card per user (nested reports); case actions Clear Flags → Manual Disable → Reviewed; per-report Clear Flag",
          "After Override / Clear Flags / Reviewed (content or users): Mark Unreviewed",
          "A new community flag after Reviewed or Clear Flags reopens the case (clears disposition, Admin History notes “New community flag”, open badge returns)",
          "Admin → Users → List of Users: Contributions / Flagged / Flags Filed counts (click # to expand); nested # Flags show reporter, reason, comments, timestamp; Clear search + role filters; Actions for Supporter and Disable",
          "Admin → Users shows a Suspended badge when suspended_at is set (and role is not disabled)",
          "Ad asset cascade: disabling a creative affects all zip placements using it",
          "Flow tables (notes / email / savers / suspend vs disable): Admin Manual → Admin Communication & Moderation Flows",
        ],
        technicalOverview:
          "flag_reports target_id for ads is ad_library id; user flags use target_type=user and target_id=profile id. Surfaces: UserFlagControl on Event Detail Posted by + OrganizerCard. notify_owner_flag_lifecycle + admin_notify_owner_flag_lifecycle (content); notify_owner_user_flag_lifecycle + admin_notify_owner_user_flag_lifecycle (users). profiles.user_flag_count / suspended_at. flag_auto_hide_exempt on events/comments/ad_library. Ad quarantine helpers in quarantineAdLibrary.js + submit_flag / withdraw_flag / disable_ad_asset RPCs. User helpers: submit_user_flag / withdraw_user_flag. Ensure scripts: ensure_user_flagging_and_suspension.sql, ensure_flag_clear_withdraw_guards.sql, ensure_reopen_flag_case_on_new_flag.sql, then ensure_flag_auto_hide_override.sql.",
        technicalFeatures: [
          "Dispositions include manually_deactivated, overridden, reactivated, reviewed, flags_cleared / flag_cleared",
          "submit_flag / submit_user_flag clear reviewed|flags_cleared and append System unreviewed history when a new flag arrives; ensure_reopen_flag_case_on_new_flag.sql also repairs stuck cases",
          "submit_flag auto-hides only when count ≥ 3 and flag_auto_hide_exempt is false",
          "submit_user_flag suspends at count ≥ 3 via apply_user_flag_suspension; withdraw / Clear Flag below 3 clears suspension",
          "User withdraw deletes their report and decrements counters; may restore auto-hidden content below 3 (not Admin manual deactivate)",
          "3+ hide trigger still notifies activity savers; owner 3+ message comes from submit_flag (avoids duplicates)",
          "Community 3-flag on ads can still email via notify-ad-asset-disabled (idempotent disable_notified_at)",
          "Admin → Flags → Flagged Content: grouped by target item; filters All / Activities / Comments / Ads + combinable 3+ toggle; open badge counts unresolved content cases (excludes Reviewed / Flags Cleared / Manually Deactivated / Override 3+)",
          "Admin → Flags → Flagged Users open badge excludes disabled accounts and closed cases (Reviewed / Flags Cleared / Manually Deactivated / Manually Reinstated)",
          "After Manual Disable then Admin Reactivate: Flagged Users shows Manually Deactivated + Manually Reinstated pills; Admin History keeps both",
          "Admin → Flags → Flagged Users filters: All / Community Members / Organizers / 3+",
          "Admin → Flags → Top Flagging Activity Ranking: report-only leaderboard of Flagging vs Being Flagged (separate rows; Flagging includes user-target reports; Being Flagged = content received + user flags); filters All / Flagging / Being Flagged; click name → Users list by exact email",
          "banner_ads.flag_count mirrors the asset for Ad Manager display",
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
          "Abandoned Stripe checkout leaves ad in Pending Payment with Complete Payment / Cancel Request in Ad Manager",
          "Homepage feed rotates ad positions about every 30s when multiple ads are present; rotation pauses while the user scrolls",
          "Cards (incl. phone): waves of up to 3 ad-rows (one ad per row, staggered), then 1 content-only row; repeats for 4+ slots. Under 6 activities → ads after the list",
          "Desktop List: first up-to-3 ads after the 3rd activity; next waves after every 6 more activities (leftovers at the end)",
          "Configurable slots; one per Supporter per zip",
          "Admin → Ads → All Supporter Ads lists user name, email, and ad name (placement business_name is the creative name)",
          "AI + URL review on Ad Assets",
        ],
        technicalOverview:
          "ad_zip_config, banner_ads, ad_library, ad pricing tables. Checkout /api/create-ad-checkout; resume abandoned checkout /api/resume-ad-checkout. Review /api/creative-review.",
        technicalFeatures: [
          "Statuses: pending_payment, pending_review, active, past_due, rejected, expired, cancelled, flagged, …",
          "pending_payment: Complete Payment (resume checkout), Change Creative, or Cancel Request in Ad Manager",
          "Filler ads fill empty slots (admin_default_ads)",
          "feedAdPlacement.js (buildCardFeedItems / buildListFeedSegments); Home.jsx AdInjectedFeed; list layout is lg+ only",
          "Home.jsx adRotationIndex interval; paused on window scroll until ~1.2s idle (does not increment impressions)",
        ],
      },
      {
        id: "ad-library",
        title: "Ad Library & Asset Cascade",
        overview:
          "Reusable approved creatives (image + link). In-use assets (assigned to active / pending / past-due zip ads) show a greyed, disabled trash control — delete only when unassigned. Community flags and admin disables attach to the Ad Asset and cascade across every zip placement using that creative; Supporters are notified and can assign a different approved creative.",
        features: [
          "Library reuse at checkout/renewal",
          "Cannot delete assets used by live placements",
          "Community flags accumulate on the asset across zips (not per placement)",
          "Cascade disable across matching placements at 3 flags or admin action",
          "What next messaging points Supporter to Ad Manager",
        ],
        technicalOverview:
          "ad_library.flag_count / flagged_by; flag_reports.target_id = asset id for ads. quarantineAdLibrary.js / disable_ad_asset RPCs. Admin Ads + Flags.",
        technicalFeatures: [
          "moderation_status on assets; ManualReviewPanel for manual_review queue",
          "notifyAdCreativeDisabledAdmin / email paths for admin vs community cascade",
          "Placement flag_count mirrored from asset for Ad Manager Creative Flags meter",
        ],
      },
      {
        id: "advertising-discounts",
        title: "Discount Codes",
        overview:
          "Admin percentage codes for monthly/annual/both, with optional expiry, max uses, per-user limits, and optional single-email restriction. Checkout shows struck-through original price and applies a Stripe coupon. Leave Expiration blank to keep a code available until Deactivate; set renewals to Ongoing for lasting Stripe discounts on that subscription.",
        features: [
          "Percent off with plan targeting",
          "Optional expiration (blank = until deactivated) and Ongoing renewals checkbox",
          "Usage limits and personal codes",
          "All / Active / Inactive filter pills",
          "Usage History expand link (user name + timestamp, chronological)",
          "Live discount preview at plan step",
        ],
        technicalOverview:
          "discount_codes validated in create-ad-checkout (null expires_date never expires by date; status must be active). Stripe coupon duration: once (1 cycle), repeating (N cycles), or forever (renewals_applicable ≤ 0). Deactivate blocks new checkouts only. Successful checkout appends used_by_records via stripe-webhook.",
        technicalFeatures: [
          "DiscountCodesPanel in Admin → Ads → Discounts; empty date uses data-empty muted placeholder styling",
          "stripe-webhook checkout.session.completed increments times_used and appends used_by_records (user_name, used_date)",
        ],
      },
      {
        id: "advertising-rules",
        title: "Rules & Terms",
        overview:
          "Family-appropriate standards; three required Review checkboxes before Stripe; community flagging attaches to Ad Assets and can pull that creative from every zip. Supporter Terms and Rules explicitly cover account suspension/Admin deactivation from Community Rules violations or user flagging, with no advertising refunds.",
        features: [
          "Review step requires: Supporter Terms, exact zip targeting (no mile radius), and no-refunds after redirect to payment",
          "3-flag auto disable on the Ad Asset (all placements)",
          "TOS §9 + Supporter Rules: account suspend/deactivate via community user flags or Admin manual disable — ads end, no refund",
          "Clear unavailable messaging in Ad Manager",
        ],
        technicalOverview:
          "supporterContent.js (SUPPORTER_RULES + TOS_SECTIONS) → AdvertiserTerms.jsx, Supporters page, Ad Manager Rules tab. banner_ads.tos_accepted. /api/create-ad-checkout requires agree_terms, agree_exact_zip, agree_no_refunds.",
        technicalFeatures: [
          "InactiveAdCard explains past_due / flagged / admin disabled states",
        ],
      },
      {
        id: "advertising-moderation",
        title: "Ad Creative Review",
        keywords: ["moderation api", "openai", "vision", "ad review", "url check", "hybrid"],
        overview:
          "On submit, destination URL safety is checked (public domain with a dot required, e.g. .com, plus private-host, keyword, and 404 checks). Ad images are resized/compressed in the browser, then reviewed on upload like Post Activity (Moderation API first, custom vision on gray scores). Submit runs creative-review for URL reachability and final status. Declines can request Admin → Reviews → Advertising Manual Review.",
        features: [
          "Client resize/compress before upload (adCreative preset)",
          "Image review immediately after upload (like Post Activity)",
          "URL checks on submit (domain required, private hosts, unsafe keywords, 404)",
          "Hybrid image review (Moderation API → custom vision when needed)",
          "Natural-language decline reasons",
          "Manual review after automated decline",
          "Required admin reason on damaging actions",
        ],
        technicalOverview:
          "AdLibraryManager: processImageForUpload → event-media → moderateAdCreativeImage (/api/photo-review review_type=ad_creative) on upload; validateBusinessLinkUrl (shared/linkUrlSafety.js) on submit; /api/creative-review for URL reachability + final status. ManualReviewPanel; AdminAdsPanel.",
        technicalFeatures: [
          "shared/linkUrlSafety.js — validateBusinessLinkUrl (client + creative-review)",
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
          "When a zip is full, Supporters join a waitlist. When a slot opens, the next person gets an offer (email + in-app) with a 24-hour window. Up to 3 offer attempts; then the queue moves on. Cron runs daily at 7:00 AM PT (see Scheduled Jobs).",
        features: [
          "FIFO-style queue per zip",
          "24-hour offer window",
          "Max 3 offer attempts",
          "Admin can override / re-offer",
        ],
        technicalOverview:
          "ad_waitlist + /api/cron-process-waitlist (7:00 AM PT / 0 14 * * * UTC) + processWaitlistCore. Manual /api/offer-waitlist-spot and expire helpers. Full table: Scheduled Jobs (Crons).",
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
          "My Active Ads: masked card on file (brand, last4, expiry) plus Update Payment Method via Stripe Customer Portal",
          "7-day grace on payment failure (cron cleanup 10:00 AM PT)",
          "14-day cancel warning UI",
          "21-day renewal-soon notices (in-app; cron 9:00 AM PT)",
        ],
        technicalOverview:
          "api/stripe-webhook.js; cancel-ad-renewal; billing-portal; ad-payment-method; cron-grace-period-cleanup (10:00 AM PT); cron-renewal-reminders (9:00 AM PT); adBillingNotices.js. Full table: Scheduled Jobs (Crons).",
        technicalFeatures: [
          "invoice.payment_failed → notifyPaymentFailed (message + email)",
          "invoice.payment_succeeded → renew notices / plan switches as applicable",
          "ActiveAdCard loads /api/ad-payment-method (brand/last4/exp only) and opens /api/billing-portal to update the card; full numbers stay in Stripe",
        ],
      },
      {
        id: "stripe-live-cutover",
        title: "Stripe Live Mode Cutover",
        keywords: ["stripe", "live", "test", "sandbox", "sk_live", "sk_test", "webhook", "payments", "go live"],
        overview:
          "App code is mode-agnostic: Checkout, webhooks, portal, and renewals use STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET. Beta used Sandbox (sk_test_). For real charges, switch Vercel Production to Live keys and a Live webhook — after clearing test Stripe IDs from banner_ads (soft reset or cancel test subs).",
        features: [
          "Confirm Stripe account is activated for Live (business details, payouts)",
          "Create Live webhook → https://localkidscalendar.com/api/stripe-webhook with the same events as Sandbox",
          "Enable Customer Portal in Live (Settings → Billing → Customer portal)",
          "Set Vercel Production: STRIPE_SECRET_KEY=sk_live_… and STRIPE_WEBHOOK_SECRET=whsec_… from the Live endpoint",
          "Redeploy after env change; run one real $ checkout then refund if desired",
          "Do not mix Sandbox customer/subscription IDs with Live keys",
        ],
        technicalOverview:
          "No publishable key required (hosted Checkout). Webhook events: checkout.session.completed, customer.subscription.deleted, invoice.payment_failed, invoice.payment_succeeded. Prefer soft-reset or empty banner_ads before cutover so no sk_test_ sub_* rows remain.",
        technicalFeatures: [
          "Sandbox keys: sk_test_ / sandbox whsec_; Live: sk_live_ / live whsec_",
          "Prices come from ad_pricing_config via Checkout price_data (no hardcoded Stripe Price IDs)",
          "After cutover, Checkout UI no longer says Test mode; real cards are charged",
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
          "Cron locks pending switches daily at 9:30 AM PT",
        ],
        technicalOverview:
          "/api/request-ad-plan-change + /api/cron-process-ad-plan-changes (9:30 AM PT / LOCK_IN_DAYS = 21). Full table: Scheduled Jobs (Crons).",
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
        keywords: ["tuesday", "resend", "digest", "monday"],
        overview:
          "Opt-in weekly emails of matching activities for Community Members. Cron runs daily at 8:00 AM PT but only sends on Tuesdays (see Scheduled Jobs). Default preference is Off. Emails include up to 8 activity cards plus supporter/filler ads for the user’s zip.",
        features: [
          "Weekly only (no daily/monthly)",
          "Tuesday send at ~8:00 AM PT (cron runs daily)",
          "Skip when zero matching activities",
          "Skips organizers and admins as digest recipients",
          "Manage Preferences + unsubscribe link in footer",
        ],
        technicalOverview:
          "vercel.json cron → /api/cron-send-notification-emails (8:00 AM PT) → sendMatchingDigests. HTML from shared/digestEmailHtml.js (buildDigestHtml). Send via sendViaResend. Full table: Scheduled Jobs (Crons).",
        technicalFeatures: [
          "frequenciesForToday() returns ['weekly'] only on Tuesday America/Los_Angeles",
          "Prefs frequency must be weekly; include_fav_organizers / include_other_activities drive matching",
          "Admin template preview: Previews → Emails (activity_digest) uses the same buildDigestHtml as the cron (shared/digestEmailHtml.js).",
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
          "Max digests per Tuesday run (default 200); last_digest_sent_at blocks same-week retries",
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
        id: "email-auth-smtp",
        title: "Auth Emails (Signup Confirm / Password Reset)",
        keywords: ["smtp", "supabase", "noreply", "confirm", "verification", "resend smtp"],
        overview:
          "Signup confirmation and password-reset messages are sent by Supabase Auth — not by the app’s Resend helper used for digests and supporter mail. Out of the box they come from Supabase’s default sender (looks generic). Production should use Custom SMTP (typically Resend) with a verified domain so From looks like Local Kids Calendar.",
        features: [
          "Default: Supabase built-in SMTP (limited rate; team-only destinations on free tier; generic From)",
          "Production: Authentication → SMTP in Supabase — host smtp.resend.com, user resend, password = Resend API key, sender on a Resend-verified domain (e.g. noreply@yourdomain.com)",
          "Minimum interval per user (default 60s) limits resend spam — leave as-is unless you have a reason",
          "Register step 3 shows signup confirmation + bold red spam/junk hint (shared/authEmailCopy.js); Login shows that hint only if sign-in fails because email is not confirmed",
          "Google OAuth consent branding is configured in Google Cloud (app name/logo/domain), not in this repo; fully hiding *.supabase.co in the allow line needs a Supabase custom Auth domain",
        ],
        technicalOverview:
          "Supabase Dashboard Auth SMTP + Email Templates. App transactional mail remains api/_lib/resendSend.js + RESEND_FROM_EMAIL.",
        technicalFeatures: [
          "Do not use onboarding@resend.dev as Auth From for real users",
          "Gmail addresses cannot be used as Resend From for the product domain",
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
          "Catalog of system messages (welcome, supporter welcome, billing, photo/ad decisions, and the full community-flag lifecycle for content and user accounts). Previewed under Admin → Previews → Automated Messages without sending — search + category pills (Welcome / Flags / Reviews / Admin Removals / Billing / Saved); titles use topic format (e.g. Flags · Activity · Flagged). Comment flag notices and user-account flag notices have no action button (already on My Messages / edit comments on the activity page).",
        features: [
          "Catalog-driven copy in userMessagesCatalog.js",
          "Content flag lifecycle: flagged (1/2), removed at 3, flag withdrawn, Clear Flags (second chance), Override 3+ — for activities, comments, and Ad Assets",
          "User-flag lifecycle: flagged (1/2), suspended at 3, withdraw, Clear Flags / partial clear",
          "Preview with sample data (no send); filter by workflow category or search",
          "Triggered by submit_flag / withdraw_flag / submit_user_flag / withdraw_user_flag, Admin Flags actions, DB events, or webhooks",
        ],
        technicalOverview:
          "userMessagesCatalog.js powers Admin → Previews → Automated Messages (AUTOMATED_NOTICE_CATEGORIES + category on each notice). Live inserts via create_user_message / notify_owner_flag_lifecycle / admin_notify_owner_flag_lifecycle / notify_owner_user_flag_lifecycle / admin_notify_owner_user_flag_lifecycle and related helpers.",
        technicalFeatures: [
          "Welcome trigger on new profiles migration",
          "Ad 3+ disable still emails via notify-ad-asset-disabled; inbox copy aligned in catalog",
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
        keywords: ["contact", "support message", "honeypot", "bot", "spam"],
        overview:
          "Anyone can submit Contact Us (topic + message). Admin reviews in Contact Us tab by subject boxes. Messages soft-delete to a Deleted section and can be restored; they are not hard-deleted from the DB by that UI. Submissions go through /api/contact-submit with honeypot, timing, and Cloudflare Turnstile.",
        features: [
          "Topics: technical, suggestions, activity questions, general",
          "Admin: unread / resolved / deleted",
          "Soft-delete with restore",
          "Honeypot + ~2s + Turnstile + server verify before insert",
        ],
        technicalOverview:
          "contact_messages with deleted_at. ContactUs.jsx → /api/contact-submit → service role insert. Admin Contact sections. See Bot Protection.",
        technicalFeatures: [
          "No Resend email on submit — Admin reviews in-app",
          "Bot hits still show the success screen (silent fail) so scrapers get less signal",
        ],
      },
      {
        id: "bot-protection",
        title: "Bot Protection (Honeypot, Timing & Turnstile)",
        keywords: [
          "bot",
          "bots",
          "spam",
          "honeypot",
          "captcha",
          "turnstile",
          "cloudflare",
          "first line of defense",
          "register",
          "contact",
          "reactivation",
          "timing",
        ],
        overview:
          "Public forms use honeypot + minimum fill time. Contact Us, email Register, and account reactivation also require Cloudflare Turnstile with server-side verification. Contact inserts go through /api/contact-submit (rate-limited, service-role). Register and reactivation call /api/verify-turnstile immediately before the protected action (tokens are single-use).",
        features: [
          "Register (email signup): honeypot + ~3s + Turnstile on profile step; verified before supabase.auth.signUp (Google OAuth / finish-profile skips Turnstile)",
          "Contact Us: honeypot + ~2s + Turnstile + /api/contact-submit (max 5/hour per email)",
          "Account reactivation request: honeypot + ~2s + Turnstile + /api/verify-turnstile before insert/update",
          "Failed bot checks fail closed without creating accounts/messages (Contact may still show a fake success screen)",
        ],
        technicalOverview:
          "ContactUs.jsx → /api/contact-submit (contactBotGuards.js, turnstileVerify.js). Register.jsx + AccountDisabledView.jsx → /api/verify-turnstile (turnstileFormGuards.js). Shared widget: TurnstileWidget.jsx. Env: VITE_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY. Migration revokes anon insert on contact_messages.",
        technicalFeatures: [
          "Honeypot field website / hp_website must stay empty (client + server)",
          "Timing: Contact/reactivate < 2000ms or Register < 3000ms from form mount → treat as bot",
          "Turnstile actions: contact | register | reactivate; Contact silent 200 for bot/Turnstile failures; verify-turnstile returns 400",
          "Run supabase/scripts/ensure_contact_messages_api_only.sql on prod after deploy if needed",
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
          "Activities — All/Active/Inactive pills; status + reason (Active, User deactivated, Admin removed, Community flags); expandable admin notes; View always aligned with a reserved action slot; Trash on active; Restore only for Admin removed (confirm); Flag icon on community-flagged rows opens Flags with title search + Activities filter",
          "Ads — All Supporter Ads shows user name, email, and ad name; zip config, waitlist, rates, discounts, fillers",
          "Beta — stage gates / zip whitelist",
          "Contact Us — inbound messages (unread count on tab + subject subtabs)",
          "FAQs — manage public FAQ entries",
          "Flags — Flagged Content, Flagged Users, Top Flagging Activity Ranking (parent open-count badge splits onto Content + Users subtabs)",
          "Manual — this document (keep updated when product/admin rules change; includes cron schedule in PT)",
          "Mass Messages — compose, archive, digest controls",
          "Previews — emails, automated messages, site notices",
          "Reviews — activity photos + ad creatives needing humans (queue counts on tab + subtabs)",
          "Users — List of Users (default), Reactivation Requests, Zip Code Reports",
        ],
        technicalOverview:
          "Admin page modules: src/pages/Admin.jsx (orchestration + dialogs), src/components/admin/adminPageConstants.js (section nav arrays), adminPageHelpers.js (pure helpers), useAdminPageActions.js (load + mutations), tab components AdminActivitiesTab / AdminFlagsTab / AdminUsersTab / AdminContactTab. All Activities helpers: getActivityStatusMeta, openFlagsForActivity, handleReactivateItem (admin notes required for events). Users list: openUserInUsersList from Top Flagging Activity Ranking; USER_LIST_FILTERS + Contributions/Flagged/Flags Filed panels.",
        technicalFeatures: [
          "Hard gate: if user.role !== 'admin' navigate home",
          "Consistent AdminSectionHeader + AdminPanelShell chrome",
          "Deletion encoding: user deactivate → deleted + empty admin_notes; admin remove → deleted + notes; 3-flag → archived (flag_count ≥ 3)",
          "My Posts: user may self-reactivate only deleted + empty notes; inactiveStatusPill labels reason on the pill (filters stay All/Active/Inactive)",
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
          "Temporary access controls for a limited launch. Stage 1 is an access code gate. Stage 2 limits where activities and ads can be listed (whitelist zips) — not who may create an account. Users may store any real profile zip; if Home’s session zip is outside the whitelist, a highly visible notice explains that activities won’t appear until they pick a beta zip for browsing (session only).",
        features: [
          "Toggle beta / stage 1 access code",
          "Stage 2 allowed zip list for listings",
          "Home out-of-area notice + empty activity list (profile zip unchanged)",
          "Post Activity and Ad purchase/waitlist still blocked outside whitelist",
          "Register / Profile beta zip note only after a 5-digit zip is entered that is outside the whitelist (lists public beta zips; internal sample zips like 00000 stay allowed but hidden from lists)",
          "Beta banner locations dialog works on mobile (DialogTrigger)",
        ],
        technicalOverview:
          "beta_config; AdminBetaPanel; BetaBanner / BetaStage1Gate; BetaOutOfAreaNotice on Home; isZipAllowed in useBetaConfig.js. Register BetaZipOutsideNote / Profile BetaZipOutsideNote.",
        technicalFeatures: [
          "Publicly readable config for client gates",
          "betaZipsForDisplay() hides BETA_ZIPS_HIDDEN_FROM_DISPLAY (00000) from banner/Home/Register lists; isZipAllowed still accepts them",
          "create-ad-checkout.js rejects non-whitelist zips when beta.enabled",
          "Home filteredEvents returns [] when session zip is outside Stage 2 list",
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
        id: "admin-communication-flows",
        title: "Admin Communication & Moderation Flows",
        keywords: [
          "flow chart",
          "flows",
          "savers",
          "optional email",
          "AdminNoteConfirmDialog",
          "manually deactivate",
          "clear flag",
          "suspend vs disable",
          "activity trash",
        ],
        overview:
          "Quick-reference tables for how Admin actions notify posters, Supporters, savers, and (when applicable) email. All note prompts use the shared AdminNoteConfirmDialog style. Detailed Admin notes go to the poster/user only — savers always get generic copy.",
        features: [
          "Shared dialog for disable, remove/deactivate, and clear-flag actions",
          "Email only when the table says so (optional on account disable; always on ad creative disable)",
          "Clearing a flag keeps the report row — the same reporter cannot re-flag or withdraw that report",
          "Clear all flags hard-resets counters to 0 and reinstates content (second chance). Clearing one flag never undoes Manual Deactivate",
          "See also: Flagging & Admin Disposition; Disable Account & Reactivation Requests",
        ],
        flowCharts: [
          {
            title: "Admin dialog actions (notes / email / savers)",
            caption:
              "Inbox = My Messages. Site notice = Account Disabled page. Savers never receive Admin’s detailed comments.",
            columns: ["Action", "Where", "Notes", "Poster / owner", "Email", "Savers"],
            rows: [
              [
                "Disable user",
                "Users or Flags → Flagged Users",
                "Required",
                "Site notice (Account Disabled)",
                "Optional checkbox",
                "Generic “saved activity removed” if posts hidden; favoriters get organizer-removed",
              ],
              [
                "Remove activity",
                "Activities trash or Flags → Manually Deactivate",
                "Required",
                "Inbox Message + My Posts note",
                "No",
                "Generic only",
              ],
              [
                "Deactivate comment",
                "Flags → Manually Deactivate",
                "Required",
                "Inbox Message",
                "No",
                "—",
              ],
              [
                "Disable ad creative",
                "Flags Manually Deactivate or Ads → Ban",
                "Required",
                "Inbox Message",
                "Always (required)",
                "—",
              ],
              [
                "Clear flag / Clear all flags",
                "Flags (content or users)",
                "Optional",
                "Inbox Message (notes appended when provided)",
                "No",
                "—",
              ],
              [
                "Decline reactivation",
                "Users → Reactivation Requests",
                "Required",
                "Site notice on Account Disabled",
                "No",
                "—",
              ],
            ],
          },
          {
            title: "Content flagging lifecycle (activity / comment / ad)",
            caption: "Registered users flag content. Distinct reporters count toward 3. Owner gets inbox notices throughout.",
            columns: ["Step", "What happens", "Owner Message", "Email", "Savers"],
            rows: [
              [
                "Flag 1 or 2",
                "Count increases; content stays live (unless already Admin-hidden)",
                "Flagged (reason + N of 3)",
                "No",
                "—",
              ],
              [
                "Flag 3 (auto)",
                "Activity/comment archived; ad creative disabled across zips (unless Override 3+ exempt)",
                "Removed / disabled at 3+",
                "Ads: yes (community 3+ path)",
                "Activity: generic saved-removed notice",
              ],
              [
                "Reporter withdraws",
                "Their report removed; count decreases; may restore auto-hidden content below 3",
                "Flag withdrawn",
                "No",
                "—",
              ],
              [
                "Admin Clear Flag",
                "Count −1; report kept (no re-flag / no withdraw by same user); optional Admin note",
                "Partial clear (+ optional note)",
                "No",
                "—",
              ],
              [
                "Admin Clear Flags (case card)",
                "Count → 0 hard-reset; second chance (reinstates even after Manual Deactivate); optional note",
                "Cleared / reinstated (+ optional note)",
                "No",
                "—",
              ],
              [
                "Admin Override 3+",
                "Live again; exempt from community auto-hide; users can still flag for Admin review",
                "Override / reinstated",
                "No",
                "—",
              ],
              [
                "Admin Manually Deactivate",
                "Same dialog family as Activities trash for activities; required notes",
                "Admin removal Message",
                "Ads always; activities/comments no",
                "Activity: generic only",
              ],
            ],
          },
          {
            title: "User (account) flagging lifecycle",
            caption: "Flag User from Posted by / Organizer card — reports the person, not a listing.",
            columns: ["Step", "What happens", "Target user Message", "Email", "Public content"],
            rows: [
              [
                "Flag 1 or 2",
                "user_flag_count increases",
                "Account flagged (reason + N of 3)",
                "No",
                "Unchanged",
              ],
              [
                "Flag 3",
                "Account suspended (guest actions; Messages OK)",
                "Suspended for Admin review",
                "No",
                "Activities/comments/ads stay; organizer still in directory",
              ],
              [
                "Reporter withdraws / Admin Clear below 3",
                "May clear suspension",
                "Withdrawn or partial clear (+ optional Admin note)",
                "No",
                "Unchanged",
              ],
              [
                "Admin Clear all flags",
                "Count → 0; reinstated; optional note",
                "Flags cleared (+ optional note)",
                "No",
                "Unchanged",
              ],
              [
                "Admin Manual Disable",
                "Full disable path (see Disable table) — not the same as suspend",
                "Account Disabled site notice (+ optional email)",
                "Optional",
                "Active posts archived; savers get generic notices",
              ],
            ],
          },
          {
            title: "Taking an activity down — three paths",
            caption: "These are different intents. Users tab has no per-activity trash — only Disable User (cascade).",
            columns: ["Path", "Intent", "Status / notes", "Poster", "Savers"],
            rows: [
              [
                "Activities → Trash",
                "Remove one listing",
                "deleted + required admin_notes",
                "Inbox with Reason",
                "Generic only",
              ],
              [
                "Flags → Manually Deactivate (activity)",
                "Hide flagged listing (same product outcome as trash)",
                "deleted + required admin_notes",
                "Inbox with Reason",
                "Generic only",
              ],
              [
                "Users → Disable",
                "Disable the account",
                "Their active activities archived with fixed “account disabled” note",
                "Account Disabled page (your disable note)",
                "Generic only (not the disable note)",
              ],
            ],
          },
          {
            title: "Suspended vs Disabled",
            columns: ["", "Suspended (3+ user flags)", "Disabled (Admin)"],
            rows: [
              ["Role", "Stays CM / Organizer", "role → disabled"],
              ["Sign-in", "Yes — Messages only for registered actions", "Account Disabled page"],
              ["Digests", "Forced Off (stay Off after unsuspend — user re-enables)", "Forced Off"],
              ["Public activities / comments", "Stay visible", "Active ones archived"],
              ["Organizer directory", "Still listed", "Hidden"],
              ["Ads", "Keep running; Ad Manager frozen", "Slot-holding ads cancelled (Supporters)"],
              ["Primary notice", "Inbox (suspended)", "Site notice (+ optional email)"],
              ["Savers / favoriters", "No cascade", "Generic saver + favoriter notices when content/organizer hidden"],
            ],
          },
          {
            title: "Reactivation request flow",
            caption: "One request per disable cycle. A new Admin Disable clears any prior request. Approve restores role, stamps Manually Reinstated, and can optionally restore activities/comments — not digests, ads, or Stripe. Organizer directory returns with Organizer role.",
            columns: ["Step", "What happens", "User sees", "Email"],
            rows: [
              [
                "User submits request",
                "Row in Reactivation Requests (pending)",
                "Confirmation on Account Disabled",
                "No",
              ],
              [
                "Admin Approve",
                "Prior role restored; request → reactivated; Flagged Users → Manually Reinstated; required Admin note in inbox Message; optional restore of disable-archived activities/comments",
                "Inbox Message (account reactivated + note)",
                "No",
              ],
              [
                "Admin Decline",
                "Required note → request + disabled_note; request → declined",
                "Updated site notice (Account Disabled)",
                "No",
              ],
              [
                "Admin Disable again later",
                "Prior reactivation row deleted; fresh request allowed",
                "Request form on Account Disabled",
                "Optional (disable dialog)",
              ],
            ],
          },
        ],
        technicalOverview:
          "UI: AdminNoteConfirmDialog (emailMode optional | always | never). Disable: /api/admin-disable-user send_email (+ clears account_reactivation_requests). Activity remove: notifyActivityRemovedAdmin + DB saver trigger (generic). Ads: sendAdAssetDisabledEmail + notifyAdCreativeDisabledAdmin. Clear flags: admin_clear_flag / admin_clear_all_flags (atomic) → notify_* with optional p_details. Reactivation approve: notifyAccountReactivated. Savers: notify_savers_activity_removed ignores Admin detail text (ensure_admin_notes_savers_generic.sql).",
        technicalFeatures: [
          "Keep these tables in sync when changing AdminNoteConfirmDialog modes or notify helpers",
          "Previews → Automated Messages / Site Notices / Emails for sample copy",
        ],
      },
      {
        id: "admin-previews",
        title: "Previews Tab",
        overview:
          "Safe previews of outbound-looking content: email HTML templates, the automated message catalog (including flag lifecycle notices), and site notices — without blasting users.",
        features: [
          "Emails tester (send sample to the signed-in admin only) — topic titles with search + category pills; titles match Automated Messages when both channels send the same notice",
          "Automated Messages catalog — topic titles (Flags / Reviews / Billing / …) with search + category pills",
          "Site Notices preview — topic titles (Site / Account) with search + category pills",
        ],
        technicalOverview:
          "PreviewsPanels (Emails + Automated Messages from EMAIL_TEMPLATE_META / AUTOMATED_NOTICE_CATALOG) + SiteEmailsTester + SiteNoticesPreview under Admin → Previews. Shared Category · Target · Event naming across all three.",
        technicalFeatures: [
          "Email send uses /api/send-email admin auth",
          "Emails filter by EMAIL_TEMPLATE_CATEGORIES; overlapping keys prefer AUTOMATED_NOTICE_CATALOG titles",
          "Automated Messages list is catalog-driven — new notice keys appear automatically after catalog updates; filter by AUTOMATED_NOTICE_CATEGORIES",
          "Site Notices filter by SITE_NOTICE_CATEGORIES (accountDisabledScenarios.js)",
        ],
      },
    ],
  },
];

function sectionSearchText(section, categoryLabel) {
  const chartText = (section.flowCharts || [])
    .flatMap((chart) => [
      chart.title,
      chart.caption,
      ...(chart.columns || []),
      ...(chart.rows || []).flat(),
    ])
    .filter(Boolean);
  return [
    categoryLabel,
    section.title,
    section.overview,
    section.technicalOverview,
    ...(section.features || []),
    ...(section.technicalFeatures || []),
    ...(section.keywords || []),
    ...chartText,
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

/** Operator reference table for Admin Manual flowCharts. */
function ManualFlowChart({ chart, searchTerms }) {
  if (!chart?.columns?.length || !chart?.rows?.length) return null;
  return (
    <div className="space-y-2">
      {chart.title ? (
        <h5 className="font-medium text-sm text-foreground">
          <HighlightedText text={chart.title} terms={searchTerms} />
        </h5>
      ) : null}
      {chart.caption ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          <HighlightedText text={chart.caption} terms={searchTerms} />
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs border-collapse min-w-[36rem]">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              {chart.columns.map((col) => (
                <th key={col} className="px-3 py-2 font-semibold text-foreground whitespace-nowrap align-bottom">
                  <HighlightedText text={col} terms={searchTerms} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chart.rows.map((row, ri) => (
              <tr key={ri} className="border-b border-border last:border-0 odd:bg-white even:bg-muted/20">
                {chart.columns.map((_, ci) => (
                  <td key={ci} className="px-3 py-2 text-muted-foreground align-top leading-relaxed">
                    <HighlightedText text={row[ci] ?? ""} terms={searchTerms} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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

        <div className="max-w-md">
          <SearchClearField
            value={query}
            onValueChange={setQuery}
            placeholder="Search keywords (e.g. digest, waitlist, disable…)"
            wrapperClassName="flex items-center gap-2 w-full"
            inputClassName="rounded-xl flex-1 min-w-0"
            leading={<Search className="w-4 h-4" />}
            aria-label="Search site manual"
          />
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
                    {section.flowCharts?.length ? (
                      <div className="space-y-5">
                        <h4 className="font-medium text-sm text-foreground">Flows</h4>
                        {section.flowCharts.map((chart) => (
                          <ManualFlowChart key={chart.title || chart.columns.join("-")} chart={chart} searchTerms={searchTerms} />
                        ))}
                      </div>
                    ) : null}
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
