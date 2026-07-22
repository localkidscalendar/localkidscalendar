import React, { useState } from "react";
import { BookOpen, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

// Each category groups related topics. Add new topics under the right category,
// or add a new category object as the site grows.
// Each section has: overview (paragraph) + features (bullet list) for the layman view,
// and technicalOverview (paragraph) + technicalFeatures (bullet list) for the technical view.
const categories = [
  {
    id: "platform",
    label: "Platform & Design",
    sections: [
      {
        id: "layout-design",
        title: "Layout & Design",
        overview: "The site uses a clean, modern design with a mint green and navy color scheme. The layout is responsive, working well on desktop, tablet, and mobile devices.",
        features: [
          "Color palette: mint green and navy scheme applied consistently across the site",
          "Typography: Quicksand for headings, Nunito for body text",
          "Visual style: rounded corners on cards, consistent spacing, clear visual hierarchy",
          "Responsive design: adapts to desktop, tablet, and mobile screen sizes"
        ],
        technicalOverview: "Built with React + Vite, styled using Tailwind CSS with a custom design token system defined in src/index.css.",
        technicalFeatures: [
          "Design tokens: color palette uses HSL values for consistency, defined in src/index.css",
          "Component library: shared UI components live in src/components/ui/ (shadcn/ui)",
          "Routing: React Router with protected routes for authenticated pages",
          "Layout: AppLayout component wraps all authenticated pages with a consistent Navbar header and footer"
        ]
      },
      {
        id: "zip-code-validation",
        title: "Zip Code Input Validation",
        overview: "Anywhere a zip code is entered — posting an activity, account settings, ad checkout — the site requires a valid 5-digit number. This keeps location-based search, filtering, and ad targeting accurate across the whole site.",
        features: [
          "5-digit format required: rejects letters, extra digits, or ZIP+4 formats",
          "Applied everywhere: PostEvent form, Account settings, Ad checkout",
          "Consistency: matches the format expected by the site's geocoding lookups"
        ],
        technicalOverview: "PostEvent.jsx, Account.jsx, and any other zip-code input enforce a strict 5-digit numeric pattern on both the input mask and form submission.",
        technicalFeatures: [
          "Validation pattern: regex /^\\d{5}$/ enforced on input mask and submit",
          "Geocoding compatibility: mirrors the format required by zippopotam.us lookups used for distance-based filtering and email matching"
        ]
      }
    ]
  },
  {
    id: "users",
    label: "Users & Accounts",
    sections: [
      {
        id: "user-registration",
        title: "User Registration & Login",
        overview: "Users can register with email/password or Google OAuth. During registration, they must choose between Community Member or Organizer account type (this choice is permanent). After registration, users verify their email via an OTP code. Returning users log in with email/password or Google, and can reset a forgotten password via a secure email link.",
        features: [
          "Sign-up methods: email/password or Google OAuth",
          "Account type: Community Member or Organizer, chosen at registration and permanent",
          "Email verification: OTP code sent after registration, required before full access",
          "Duplicate prevention: one email cannot be used for multiple accounts",
          "Password reset: secure email link flow for forgotten passwords",
          "No phone number collected during registration"
        ],
        technicalOverview: "Registration flow: Register.jsx collects email, password, and account type (community_member/organizer), then routes through OTP verification before granting access.",
        technicalFeatures: [
          "Register.jsx calls base44.auth.register(), which sends an OTP email",
          "verifyOtp() returns an access_token, stored via setToken(), then hard-redirects to the homepage",
          "Account type is stored on the User entity",
          "Google OAuth uses base44.auth.loginWithProvider('google')",
          "Login.jsx handles loginViaEmailPassword(); ForgotPassword.jsx/ResetPassword.jsx handle resetPasswordRequest()/resetPassword() with a token query param",
          "Phone numbers are not collected during registration"
        ]
      },
      {
        id: "user-types",
        title: "Community Member vs Organizer",
        overview: "Community Members can browse, save, and flag activities, post events on behalf of organizations, and receive notifications. Organizers have all Community Member features plus can represent their organization with official branding, post activities that get highlighted placement, and build follower bases. Account types are separate — one email cannot be both.",
        features: [
          "Community Member: browse, save, flag activities, post events, receive notifications",
          "Organizer: all Community Member features plus official org branding (logo, org name), highlighted activity placement, and followers",
          "Separation: one email/account can only be one type at a time"
        ],
        technicalOverview: "User entity has a 'role' field distinguishing account types, with Organizer-specific data stored on a separate entity.",
        technicalFeatures: [
          "User.role values: community_member, organizer, admin, disabled",
          "Organizer entity: org_name, org_description, org_logo, org_website, org_email, linked by user_id",
          "posted_by_role on Event determines card styling (Organizer posts get a green border highlight)",
          "FavoriteOrganizer entity tracks follower relationships (organizer_id, poster_user_id)",
          "Organizers cannot be created via SDK — users must register with the organizer role"
        ]
      },
      {
        id: "supporter-users",
        title: "Supporter (Advertiser) Role",
        overview: "Supporters are businesses or organizations that purchase ad slots in specific zip codes. They get access to Ad Manager to upload ad creatives, track performance (impressions, clicks), manage subscriptions, and renew, upgrade, downgrade, or cancel ads. Supporter is a role that can be added to any user account (Community Member or Organizer). Each Supporter is limited to one ad slot per zip code to prevent monopolizing inventory.",
        features: [
          "Ad Manager access: upload creatives, track impressions/clicks, manage subscription",
          "Plan actions: renew, upgrade, downgrade, or cancel ads",
          "Add-on role: can be granted to any Community Member or Organizer account",
          "Slot limit: one active ad slot per Supporter per zip code"
        ],
        technicalOverview: "Supporter status is tracked via a flag on the User entity, with all ad data stored on the BannerAd entity.",
        technicalFeatures: [
          "User.is_advertiser boolean flag (granted via Admin panel or automatically on first ad purchase)",
          "BannerAd entity: user_id, business_name, image_url, link_url, zip_code, status (pending_payment/pending_review/active/past_due/rejected/expired/cancelled/flagged), plan_type (monthly/annual), stripe_subscription_id, auto_renew, next_renewal_date",
          "AdLibrary entity stores a user's approved ad creatives for reuse across zip codes",
          "createAdCheckout enforces a per-Supporter, per-zip-code slot cap of one active/pending BannerAd before allowing a new purchase"
        ]
      },
      {
        id: "user-dashboard",
        title: "User Dashboard & Account Settings",
        overview: "Registered users manage everything from one My Account page, organized into tabs: Saved Activities, Fav Organizers, My Posts (community members and organizers only), Flagged Content, Notifications, and Profile. There is no separate Dashboard page. Zip code fields on the Profile tab require a valid 5-digit number.",
        features: [
          "Saved Activities tab: activities the user bookmarked",
          "Fav Organizers tab: organizers the user follows",
          "My Posts tab: activities the user has posted (community members/organizers only)",
          "Flagged Content tab: content the user has flagged",
          "Notifications tab: email preference settings",
          "Profile tab: account details, including a 5-digit zip code requirement"
        ],
        technicalOverview: "Account.jsx is the single account hub (route /account), rendering each area as a tab.",
        technicalFeatures: [
          "SavedActivitiesTab: queries SavedEvent entity",
          "SavedOrganizersTab: queries FavoriteOrganizer entity",
          "MyPostsTab: shown only when role is community_member/organizer/admin; queries Event.filter({ created_by_id: user.id })",
          "FlaggedContentTab: shows the user's flagged content",
          "NotificationsTab: reads/writes the NotificationPreference entity",
          "ProfileTab: reads/writes the User entity via base44.auth.updateMe(), including zip_code with 5-digit validation",
          "Newly registered users with no saved data yet see empty-state messaging rather than errors"
        ]
      },
      {
        id: "saved-filter-preferences",
        title: "Saved Filter Preferences (My Filters)",
        overview: "Signed-in users can save their go-to homepage filter selections — activity type, subtype, sort order, zip code and distance, age range, and price range — from a 'My Filters' tab in My Account, then apply them all at once on the homepage with a single click. For signed-out visitors, the saved-filters button (along with saved-activities and favorite-organizers) appears greyed out, and clicking one prompts sign-in or registration.",
        features: [
          "My Filters tab (My Account): save/edit go-to filter selections",
          "One-click apply: a dedicated homepage button loads the saved selections",
          "Hover tooltips: each of the three related buttons (saved activities, fav organizers, my filters) explains what it does and that a signed-in account is required",
          "Signed-out behavior: buttons appear greyed out; clicking prompts sign-in/registration"
        ],
        technicalOverview: "SavedFilter entity stores one record per user, holding the reusable subset of filter fields (excluding dates and toggle-only fields).",
        technicalFeatures: [
          "SavedFilter fields: search, category, subcategory, sortBy, zipCode, radiusMiles, ageMin, ageMax, priceMin, priceMax",
          "Excluded fields: dateFrom/dateTo, savedOnly, favOrgsOnly — not part of the reusable preference",
          "No status field — the entity schema doesn't include an active/inactive selector",
          "Numeric fields converted from form strings to numbers via a toNum() helper (undefined when blank) before saving",
          "SavedFiltersTab.jsx (Account.jsx 'My Filters' tab) loads any existing record on mount and upserts on Save with a confirmation toast",
          "EventFilters.jsx: a Sliders-icon button beside Bookmark (saved activities) and Heart (favorite organizers) calls base44.entities.SavedFilter.filter({ created_by_id: user.id }) and merges results into active filters",
          "All three buttons share the same signed-out styling (opacity-50/cursor-not-allowed) and open AuthPromptModal when clicked while signed out"
        ]
      },
      {
        id: "notification-preferences",
        title: "Notification Preferences",
        overview: "Users choose how often they want activity update emails (weekly or none), and can narrow results by category, age range, keywords, favorite organizers, home zip code, and search radius (up to 100 miles).",
        features: [
          "Frequency: weekly or none",
          "Filters: category, age range, keywords, favorite organizers",
          "Location: home zip code with search radius up to 100 miles"
        ],
        technicalOverview: "NotificationPreference entity (one per user) stores the matching criteria used by the email-sending function.",
        technicalFeatures: [
          "Fields: frequency, categories (array), organizer_ids (array), keywords, zip_code, radius_miles (up to 100), age_min, age_max",
          "Notifications.jsx is the settings UI, saving directly to the entity",
          "initUserPreferences backend function creates a default preference record for brand-new users",
          "sendNotificationEmails reads this entity to determine who gets emailed and what content matches"
        ]
      }
    ]
  },
  {
    id: "activities",
    label: "Activities & Community",
    sections: [
      {
        id: "posting-activity",
        title: "Posting an Activity",
        overview: "Community Members and Organizers can post a new activity (camp, class, event, sport, general interest) with details like dates, ages, cost, location, and an optional photo. Organizer-posted activities display official branding and a highlighted border. End dates cannot be earlier than the start date, zip codes must be valid 5-digit numbers, and posters must agree to the Community Rules before submitting.",
        features: [
          "Activity types: camp, class, event, sport, general interest",
          "Details captured: dates, ages, cost, location, optional photo",
          "Organizer branding: official logo/org name and highlighted border on Organizer posts",
          "Validation: end date can't precede start date, zip code must be 5 digits",
          "Community Rules agreement required before submitting"
        ],
        technicalOverview: "PostEvent.jsx is a multi-field form writing to the Event entity.",
        technicalFeatures: [
          "Event fields: title, description, category, age_min/max, start/end dates, registration window, recurring pattern, time, address/city/state/zip, cost, contact info, website, event_image, org info",
          "posted_by_role set from the poster's User.role at submission, used by EventCard for conditional styling",
          "Images uploaded via Core.UploadFile before the entity is created, then routed through activity photo moderation",
          "Form validation enforces end_date >= start_date, a 5-digit zip_code pattern, and a mandatory Community Rules checkbox before submit is enabled"
        ]
      },
      {
        id: "activity-photo-moderation",
        title: "Activity Photo Moderation",
        overview: "Photos uploaded with an activity are automatically screened by AI before the listing goes live, to keep images appropriate for a family site. Most photos pass instantly. If AI is unsure, the photo is queued for a human admin to manually approve or decline it. If an admin declines a photo, it's removed from the listing and the contributor is notified by email with the reason.",
        features: [
          "Automatic AI screening on upload",
          "Manual review queue for uncertain cases",
          "Admin approve/decline with optional reason",
          "Email notification to contributor on a decline decision"
        ],
        technicalOverview: "Event entity tracks moderation status; the moderateEventImage backend function runs the AI check, and AdminActivityPhotoReviewPanel handles manual decisions.",
        technicalFeatures: [
          "Event fields: image_moderation_status (pending/approved/declined/manual_review/manual_review_declined), image_moderation_notes, image_moderation_date",
          "moderateEventImage: vision-capable InvokeLLM call classifies event_image on upload, resulting in auto approve/decline or a manual_review flag",
          "AdminActivityPhotoReviewPanel (Admin → Activities tab): lists manual_review items with Approve/Decline actions and an optional notes field",
          "Declining an image clears event_image on the Event record and triggers an automated contributor email explaining the decision"
        ]
      },
      {
        id: "activity-filters",
        title: "Activity Filters & Sorting",
        overview: "Users can filter activities by category, age range, location (city/zip) with a search radius up to 100 miles, date range, and cost. Sorting options include date posted, activity date, and registration date. All filter choices persist for the rest of the browser session, and reset back to defaults only when the session ends or filters are explicitly cleared. If a returning visitor has an age or price range set from earlier in the session, the 'More Filters' panel auto-expands so they can see those active values right away. The keyword search box matches any individual word typed (not the full phrase) against an activity's title, description, keywords, organizer name, or city, ignoring punctuation — hovering the search icon (or its counterpart in My Filters) explains this behavior. The 'My Saved Activities' and 'My Fav Organizers' toggle buttons work the same way as every other filter on the bar: each one narrows the results further, so turning both on shows only activities that are BOTH saved AND from a favorite organizer, not either/or.",
        features: [
          "Filter by: category, age range, location/radius (up to 100 miles), date range, cost",
          "Sort by: date posted, activity date, or registration date",
          "Session persistence: filters stay applied across the browser session",
          "Auto-expand: 'More Filters' panel opens automatically if age or price range is active from earlier in the session",
          "Keyword search: matches any single word entered (OR logic), not the exact phrase, and ignores punctuation",
          "Hover tooltip on the search icon (homepage and My Filters) explains the multi-word OR/punctuation-insensitive matching",
          "'My Saved Activities' and 'My Fav Organizers' toggles can both be active at once, and combine as AND — consistent with every other filter on the bar"
        ],
        technicalOverview: "EventFilters component manages filter state, persisted to sessionStorage and applied against Event.filter() queries.",
        technicalFeatures: [
          "Home.jsx persists the filters object (minus zipCode/radiusMiles, which use their own session keys) to sessionStorage under home_filters_session",
          "A one-time effect checks restored ageMin/ageMax/priceMin/priceMax on mount; if either range is non-default, sets expandFilters=true (passed to EventFilters as a controlled 'expanded' prop)",
          "Age filtering: $gte/$lte on age_min/age_max fields",
          "Location filtering: exact zip match, city string contains, or Haversine-based radius filtering against latitude/longitude",
          "Date filtering compares start_date against the selected range",
          "Sorting uses list('-field_name') for descending or 'field_name' for ascending",
          "Results capped at 200 per query for performance",
          "Search: Home.jsx strips punctuation from the search string, splits it into individual words, joins title/description/keywords/org_name/city into one lowercase string per activity, and keeps any activity where at least one word matches (OR, not AND)",
          "EventFilters.jsx wraps the search icon in a Tooltip (Radix) explaining the OR/punctuation-insensitive logic; SavedFiltersTab.jsx (My Filters) shows the same explanation via the shared HelpTip component next to the 'Keywords' label",
          "Home.jsx applies filters.savedOnly and filters.favOrgsOnly as two separate, independent .filter() steps (each its own AND condition) rather than one combined OR check, matching how category/zip/age/price/date are applied"
        ]
      },
      {
        id: "search-location",
        title: "Search & Location-Based Results",
        overview: "The homepage can use the visitor's device location (with permission) to prioritize nearby activities, or users can manually enter a zip code to see what's happening in their area — including a manual zip override right in the homepage banner. If no location can be determined at all, a modal prompts the visitor for a zip code before they can use the rest of the site, since results are always local.",
        features: [
          "Device location: used with permission to prioritize nearby activities",
          "Manual zip entry: quick override in the homepage banner",
          "Required zip prompt: shown if no location can be resolved by any method"
        ],
        technicalOverview: "useGeoLocation hook wraps the browser geolocation API; Home.jsx merges profile zip, session zip, and geolocation with profile zip taking precedence.",
        technicalFeatures: [
          "useGeoLocation wraps navigator.geolocation, returning coordinates when permission is granted",
          "Home.jsx merges signed-in profile zip, session zip (sessionStorage session_zip_current), and geolocation — profile zip always takes precedence when authenticated",
          "ZipRequiredModal blocks app usage and forces zip entry when no location can be resolved",
          "Distance calculations use a Haversine formula (also used server-side in sendNotificationEmails)",
          "Zip-to-coordinates lookups via the free zippopotam.us API"
        ]
      },
      {
        id: "comments",
        title: "Comments on Activities",
        overview: "Users can leave comments on an activity's detail page, ask questions, or share experiences. Comments can be flagged by the community just like activities, and removed if they violate guidelines.",
        features: [
          "Comment threads on each activity's detail page",
          "Community flagging with the same rules as activities",
          "Auto-removal once flag threshold is reached"
        ],
        technicalOverview: "Comment entity stores each comment along with its own flag tracking, rendered by EventDetail.jsx.",
        technicalFeatures: [
          "Comment fields: event_id, content, author_name, flag_count, flagged_by (array), status (active/deleted/archived)",
          "EventDetail.jsx renders the comment thread and submission form",
          "Comments follow the same flagging/auto-archive rules as activities (see Flagging Self-Moderation System) and appear in the Admin Flags tab alongside flagged events"
        ]
      },
      {
        id: "liking-favoriting",
        title: "Liking & Favoriting",
        overview: "Users can save activities to view later (bookmarks) and favorite organizers to follow their updates. Saved activities appear in the user's My Account page.",
        features: [
          "Save/bookmark activities for later",
          "Favorite organizers to follow their future activities",
          "Saved items appear in My Account"
        ],
        technicalOverview: "SavedEvent and FavoriteOrganizer entities track per-user saves and follows.",
        technicalFeatures: [
          "SavedEvent entity: event_id and created_by_id (user); each save increments Event.save_count for display on the card",
          "FavoriteOrganizer entity: links organizer_id (User entity for organizer) and poster_user_id (follower)",
          "Both entities are user-scoped — users only see their own saves/favorites",
          "My Account queries SavedEvent.filter({ created_by_id: user.id }) to populate the saved list"
        ]
      },
      {
        id: "invite-templates",
        title: "Invite Templates (Community Member, Organizer, Supporter)",
        overview: "Users can invite others to join the community using ready-made message templates, one for each audience: Community Member, Organizer, and Supporter. Each template page shows a preview of the invitation message and offers three ways to send it: copy the message to the clipboard, open it as a pre-filled email, or open it as a pre-filled text message. A row of three buttons — Invite a Community Member, Invite an Organizer, Invite a Supporter — appears on the Organizers, Supporters, and About pages, so visitors can invite the right kind of person from wherever they are. A 'Back' link at the top of each template returns to whichever page the visitor came from.",
        features: [
          "Three dedicated invite template pages: Community Member, Organizer, Supporter",
          "Each template offers Copy to Clipboard, Create Email, and Create Text options",
          "Invite button row (Community Member / Organizer / Supporter) appears on Organizers, Supporters, and About pages",
          "The button matching that page's primary audience is shown in the darker green; the other two are lighter green",
          "Dynamic 'Back' link returns to the page the visitor came from rather than a fixed destination"
        ],
        technicalOverview: "InviteCommunityMemberPage.jsx, InviteOrganizerPage.jsx, and InviteSupporterPage.jsx are static template pages using mailto: and sms: protocols; no entity storage is involved.",
        technicalFeatures: [
          "Routes: /invite-community-member, /invite-organizer, /invite-supporter",
          "Copy to Clipboard uses navigator.clipboard.writeText() with a confirmation toast",
          "Create Email builds a mailto: link with encoded subject/body",
          "Create Text builds an sms: link with an encoded body (no subject, per SMS protocol limits)",
          "Back link uses navigate(-1) (React Router) to return to the actual previous page in browser history",
          "Organizers.jsx, Supporters.jsx, and About.jsx each render the same three-button row, styling the button for that page's primary audience with bg-mint-500 and the other two with bg-mint-200"
        ]
      },
      {
        id: "organizer-directory",
        title: "Organizer Directory",
        overview: "A public directory lets community members browse all registered Organizers, view their profile (logo, description, contact info), and follow/favorite them to keep track of their future activities.",
        features: [
          "Public directory of registered Organizers",
          "Profile view: logo, description, contact info",
          "Follow/favorite an organizer from the directory"
        ],
        technicalOverview: "Organizers.jsx queries the Organizer entity and displays cards with profile details and follow actions.",
        technicalFeatures: [
          "Organizers.jsx queries the Organizer entity, displaying org_logo, org_name, org_description, and links to org_website/org_email",
          "'Favorite' action writes to FavoriteOrganizer",
          "Sample Organizer records can't be created directly as Users via the SDK — only real registrations populate this list"
        ]
      },
      {
        id: "flagging-system",
        title: "Flagging Self-Moderation System",
        overview: "Any registered user can flag inappropriate or inaccurate content — activities, comments, or Supporter ads — using the same 4 reasons everywhere: Inaccurate, Inappropriate, Spam, or Other (choosing Other requires typing a short explanation). When something receives 3 flags from different users, it's automatically hidden (activities/comments) or marked flagged and pulled from rotation (ads), and queued for admin review.",
        features: [
          "Unified reasons: Inaccurate, Inappropriate, Spam, Other (Other requires a written explanation)",
          "Applies to: activities, comments, and Supporter ads",
          "Always-visible button: greyed out with a tooltip for signed-out visitors, who are prompted to sign in/register on click",
          "Auto-moderation threshold: 3 flags from different users triggers automatic hiding (activities/comments) or 'flagged' status (ads)"
        ],
        technicalOverview: "FlagReport entity stores every flag with its target type, reason, and reporter; each content entity tracks its own flag count.",
        technicalFeatures: [
          "FlagReport fields: target_type (event/comment/ad), target_id, reason (inaccurate/inappropriate/spam/other), details (required client-side for 'other'), reporter_id, reporter_name, target_contributor_name",
          "Event/Comment: flag_count and flagged_by track flags; status auto-sets to 'archived'/'deleted' at 3+ flags",
          "BannerAd: same flag_count/flagged_by pattern; status auto-sets to 'flagged' at 3+ flags via SupporterAdCard",
          "SupporterAdCard, and the activity/comment flag buttons in EventDetail.jsx, share the same always-visible, disabled-when-signed-out UI (AuthPromptModal on click)",
          "Admin's Flags tab (Admin.jsx) renders all three target_types: events/comments link to the activity via eventMap lookups; ad flags display the stored target_contributor_name directly",
          "'Admin Manual Delete' is hidden for ad flags (ad status changes happen in the Ads tab); 'Reviewed'/'Remove Flag' work the same for all three types"
        ]
      }
    ]
  },
  {
    id: "advertising",
    label: "Advertising (Supporter) System",
    sections: [
      {
        id: "advertising-overview",
        title: "General Overview",
        overview: "Supporters purchase ad slots in specific zip codes at $150/month or $1,260/year (30% discount). Ads appear in activity digest emails and on the homepage feed. Each zip code has a limited number of slots (default 3, configurable by admin), and each Supporter can only hold one slot per zip code. Ads go through automated AI moderation before going live.",
        features: [
          "Pricing: $150/month or $1,260/year (30% discount)",
          "Placement: activity digest emails and homepage feed",
          "Slot limits: default 3 per zip code, admin-configurable",
          "One slot per Supporter per zip code",
          "AI moderation before ads go live"
        ],
        technicalOverview: "AdZipConfig, BannerAd, AdPricingConfig, and moderateAdContent together manage slot capacity, ad records, pricing, and content review.",
        technicalFeatures: [
          "AdZipConfig entity: max_slots per zip_code (default 3, admin-editable overrides)",
          "BannerAd entity status workflow: pending_payment → pending_review → active (or rejected)",
          "createAdCheckout validates zip slot capacity and the one-slot-per-Supporter-per-zip rule before creating a Stripe session",
          "AdPricingConfig entity: monthly_rate, annual_discount_percent; AdPricingHistory tracks rate changes over time",
          "moderateAdContent: InvokeLLM reviews ad images/text for policy compliance, returning auto_approved or needs_review"
        ]
      },
      {
        id: "ad-library",
        title: "Ad Library & Asset Management",
        overview: "Supporters build a reusable library of approved ad creatives (images + links). When buying or renewing a zip code slot, they pick from their library instead of re-uploading and re-approving artwork every time. New or edited assets go through review before they can be used. Assets currently in use by a live ad campaign can't be deleted, and flagged assets can't be selected for a new ad until the associated issue is resolved.",
        features: [
          "Reusable library of approved ad creatives (image + link pairs)",
          "Pick from library during checkout/renewal instead of re-uploading",
          "New/edited assets go through review before use",
          "Deletion blocked for assets in use by a live campaign",
          "Flagged assets can't be selected until the issue is resolved"
        ],
        technicalOverview: "AdLibrary entity stores reusable creatives; AdLibraryManager component handles listing, selection, and moderation-aware restrictions.",
        technicalFeatures: [
          "AdLibrary fields: user_id, ad_name, image_url, link_url, moderation_status (pending/approved/declined/manual_review/manual_review_declined), moderation_notes",
          "AdLibraryManager: in 'selector mode' (passed an onSelectAsset callback), hides add/delete/edit/resubmit actions and decline notes",
          "Deletion blocked client-side when an asset's image_url/link_url matches any live BannerAd",
          "Selector mode blocks choosing an asset while its associated ad is flagged/unresolved",
          "updateAdCreative backend function swaps a live BannerAd's creative to a chosen approved library asset, and reactivates ads flagged/rejected/paused for a content reason",
          "AdLibraryManualRequest entity queues declined assets for human review when a Supporter contests an automated decline; ManualReviewPanel is the admin-side queue"
        ]
      },
      {
        id: "advertising-discounts",
        title: "Discount Codes",
        overview: "Admins can create discount codes with percentage discounts (e.g., 20% off) applicable to monthly or annual plans. Codes can have expiration dates, maximum uses, per-user limits, and can optionally be restricted to one specific person's email (a personal code). During checkout, the ad plan step previews the discount by showing the original price struck through next to the new discounted price. Discount usage is tracked with detailed logs.",
        features: [
          "Percentage-based discount codes for monthly or annual plans",
          "Optional limits: expiration date, max uses, per-user limit",
          "Optional personal-code restriction to a single email",
          "Live price preview: original price struck through next to the discounted price",
          "Detailed usage logs"
        ],
        technicalOverview: "DiscountCode entity stores rules and usage history; createAdCheckout validates and applies codes at checkout.",
        technicalFeatures: [
          "DiscountCode fields: code, discount_percent, plan_type (monthly/annual/both), renewals_applicable, expires_date, max_uses, max_uses_per_user, restricted_email, times_used, used_by_user_ids (array), used_by_records (array with user_id, user_name, ad_name, zip_code, used_date)",
          "createAdCheckout validates expiration, plan compatibility, prior usage, global max uses, and restricted_email match when set",
          "Applies the discount to the Stripe session and stamps discount_code_used/discount_amount on the resulting BannerAd",
          "The Ad Plan step computes and displays the pre/post-discount price live as codes are entered"
        ]
      },
      {
        id: "advertising-rules",
        title: "Rules & Terms",
        overview: "Supporter ads must meet community standards: no adult content, no personal solicitation, no misleading claims, appropriate for families. Ads are reviewed before going live. Supporters agree to Terms of Service during checkout. Ads can be flagged by users and removed if they violate policies.",
        features: [
          "Content standards: no adult content, no personal solicitation, no misleading claims, family-appropriate",
          "Pre-launch review required",
          "Terms of Service agreement required at checkout",
          "Community flagging can lead to removal"
        ],
        technicalOverview: "Terms are documented in-app and enforced via TOS agreement fields and flag-triggered status changes on BannerAd.",
        technicalFeatures: [
          "Supporter TOS embedded in AdManager.jsx (Rules & Terms tab, 13 sections) and as a standalone page at AdvertiserTerms.jsx",
          "BannerAd.tos_agreed (boolean) and tos_agreed_date stored on submission",
          "Flagged ads increment flag_count; at 3+ flags, status auto-sets to 'flagged' and the ad is hidden pending admin review",
          "A clear 'Flagged — Unavailable' notice is shown to the Supporter in Ad Manager"
        ]
      },
      {
        id: "advertising-moderation",
        title: "Automated Review & Approval",
        overview: "When a Supporter submits an ad, it's automatically reviewed by AI for policy compliance. Most ads are auto-approved within seconds. Ads that need human review are held in 'Pending Review' status until admin manually approves or rejects them. Any admin action that changes an ad's status (approve, reject, pause, flag) always emails the Supporter, and deactivation/flagging requires the admin to provide an explanation.",
        features: [
          "Automatic AI review on submission, most ads auto-approved within seconds",
          "'Pending Review' status for ads needing human judgment",
          "Admin actions (approve/reject/pause/flag) always email the Supporter",
          "Deactivation/flagging requires an admin-provided explanation"
        ],
        technicalOverview: "moderateAdContent runs an AI compliance check on submission; AdminAdsPanel and ManualReviewPanel handle human decisions and notifications.",
        technicalFeatures: [
          "moderateAdContent: InvokeLLM with a vision-capable model analyzes image content and text for adult content, violence, personal services, misleading claims, competitor references, and low quality",
          "Returns { status: 'auto_approved' | 'needs_review', reason }",
          "Auto-approved ads move to 'active' after payment; needs_review ads stay in 'pending_review' and surface in AdminAdsPanel/ManualReviewPanel",
          "AdminAdsPanel enforces an admin-provided explanation on any status change and fires an automated Core.SendEmail notification to the affected Supporter"
        ]
      },
      {
        id: "zip-reservation",
        title: "Zip Code Reservation & Checkout Flow",
        overview: "While a Supporter is choosing a zip code and completing checkout, that slot is temporarily held for them (a 10-minute countdown) so two people can't accidentally buy the same spot. If they don't finish in time, the hold is released.",
        features: [
          "Temporary 10-minute hold on a chosen zip code during checkout",
          "Live countdown shown throughout the checkout flow",
          "Hold released automatically if checkout isn't completed in time"
        ],
        technicalOverview: "ZipCodeReservation entity backs a client-side countdown across the checkout steps in AdManager.jsx.",
        technicalFeatures: [
          "ZipCodeReservation fields: user_id, zip_code, expires_at, status (active/completed/expired)",
          "Created when a user confirms a zip in the New Ad form (RESERVATION_MINUTES = 10)",
          "CountdownBanner displays the live countdown across the Creative/Plan/Review steps",
          "On successful Stripe checkout, the reservation is marked 'completed'; otherwise it expires client-side and the user must restart the zip check"
        ]
      },
      {
        id: "advertising-waitlist",
        title: "Waitlist",
        overview: "When a zip code's ad slots are full, Supporters can join a waitlist. When a slot opens (ad expires or cancels), the first person on the waitlist is notified via email and given time to claim it. If they decline or don't respond, the offer goes to the next person.",
        features: [
          "Join a waitlist when a zip code is full",
          "First-in-line notification by email when a slot opens",
          "Time-limited offer window to claim the slot",
          "Offer rolls to the next person if declined or unanswered"
        ],
        technicalOverview: "AdWaitlist entity tracks queue position and offer status; processWaitlist runs daily to manage offers.",
        technicalFeatures: [
          "AdWaitlist fields: user_id, business_name, email, zip_code, plan_type, position, status (waiting/offered/accepted/expired/declined/cancelled), offer_sent_date, offer_expires_date, offer_count",
          "processWaitlist backend function runs daily: checks for expired/cancelled ads, finds the next waitlisted user per zip, sets status='offered' with an expiry window, and sends an email",
          "If the user doesn't accept in time, status auto-sets to 'expired' and the offer rolls to the next position",
          "Admin can override queue order, reset offer counts, and re-add cancelled entries via AdminWaitlistPanel"
        ]
      },
      {
        id: "advertising-payments",
        title: "Payment Processing & Renewal",
        overview: "Payments are processed through Stripe. Supporters can pay monthly or annually. Subscriptions auto-renew unless cancelled. Payment failures put ads in 'Past Due' status with a 7-day grace period before suspension. Starting 14 days before a renewal date, Supporters see a cancellation warning banner on their ad, and the app explains exactly what happens if they choose not to renew: cancel immediately, or run until the end of the current paid term, depending on how close the renewal date is.",
        features: [
          "Payment via Stripe: monthly or annual billing",
          "Auto-renewal unless cancelled",
          "Failed payments: 'Past Due' status with a 7-day grace period before suspension",
          "14-day renewal warning banner with clear cancellation-outcome messaging",
          "All transactions tracked in the system"
        ],
        technicalOverview: "createAdCheckout and stripeAdWebhook manage the Stripe subscription lifecycle; adGracePeriodCleanup and cancelAdRenewal handle grace periods and non-renewal.",
        technicalFeatures: [
          "createAdCheckout creates a Stripe Checkout Session with metadata (base44_app_id, user_id, zip_code, plan_type, discount_code)",
          "stripeAdWebhook handles checkout.session.completed (creates/updates BannerAd with stripe_subscription_id, plan_start_date, plan_end_date, next_renewal_date, rate_at_purchase), invoice.paid (renewals), payment_intent.payment_failed (sets status='past_due', starts grace_period_start), and customer.subscription.updated (auto_renew changes)",
          "AdCard components render a 14-day renewal cancellation warning banner once next_renewal_date is within that window",
          "cancelAdRenewal uses Stripe's cancel_at_period_end and returns whether the ad terminates immediately or continues to the end of the current term based on the 14-day window",
          "adGracePeriodCleanup runs daily to remove ads past the 7-day grace period"
        ]
      },
      {
        id: "advertising-plan-changes",
        title: "Plan Upgrades & Downgrades (Monthly ↔ Annual)",
        overview: "A monthly Supporter can request to switch to the annual plan (locking in the discounted annual rate), and an annual Supporter can request to switch back to monthly. The change doesn't happen immediately — it takes effect at the Supporter's next renewal date, and the rate is locked in 21 days ahead of that renewal so there's no surprise about what will be charged.",
        features: [
          "Monthly → Annual upgrade request, locking in the discounted annual rate",
          "Annual → Monthly downgrade request",
          "Change takes effect at the next renewal date, not immediately",
          "Rate locked in 21 days ahead of renewal for predictability"
        ],
        technicalOverview: "BannerAd stores pending-change flags and locked rates; requestAdPlanUpgrade and processAdPlanUpgrades manage the request and scheduled switch.",
        technicalFeatures: [
          "BannerAd fields: upgrade_to_annual_pending / downgrade_to_monthly_pending, upgrade_requested_date / downgrade_requested_date, upgrade_locked_annual_rate / downgrade_locked_monthly_rate",
          "requestAdPlanUpgrade sets the pending flag and requested date when a Supporter opts in from Ad Manager",
          "processAdPlanUpgrades runs on a schedule, locks in the target plan's rate for BannerAds within 21 days of next_renewal_date",
          "At actual renewal (via the stripeAdWebhook invoice.paid handler), the plan_type switch applies, the Stripe subscription price updates, and pending fields clear"
        ]
      },
      {
        id: "advertising-default-ads",
        title: "Default/Filler Ads",
        overview: "When a zip code has empty ad slots, default/filler ads are displayed instead. These are generic ads managed by admin, often promoting the site itself or community partners. They ensure ad space is never blank.",
        features: [
          "Filler ads shown in empty zip-code slots",
          "Managed entirely by admin",
          "Often promotes the site or community partners",
          "No impressions/clicks tracked, no charges incurred"
        ],
        technicalOverview: "AdminDefaultAd entity stores filler ad content and slot assignment; the feed and email digests fall back to these when no paid ads exist for a zip.",
        technicalFeatures: [
          "AdminDefaultAd fields: ad_name, image_url, link_url, priority, is_slot_1/is_slot_2/is_slot_3, status (active/inactive)",
          "AdminDefaultAdsPanel lets admins upload images, set links, and assign to specific slots (reassigning a slot auto-unassigns the previous holder)",
          "In digest emails and the homepage feed, if no active BannerAds exist for a zip code, the system falls back to AdminDefaultAds filtered by is_slot_X flags",
          "Default ads don't track impressions/clicks or incur charges"
        ]
      }
    ]
  },
  {
    id: "emails",
    label: "Emails",
    sections: [
      {
        id: "email-notifications",
        title: "Activity Notifications",
        overview: "Users can opt in to receive email digests of new activities matching their interests. Frequency options: daily, weekly (Mondays), or monthly (1st of month). Users set preferences for categories, age ranges, zip code with radius (up to 100 miles), and favorite organizers. Emails include curated activity cards and Supporter ads for the user's zip code.",
        features: [
          "Opt-in digest emails matching user interests",
          "Frequency options: daily, weekly (Mondays), monthly (1st)",
          "Preferences: category, age range, zip/radius (up to 100 miles), favorite organizers",
          "Includes curated activity cards and Supporter ads for the user's zip code"
        ],
        technicalOverview: "sendNotificationEmails runs on a schedule, matching preferences to events and sending via Core.SendEmail.",
        technicalFeatures: [
          "Runs daily at 8am PT via scheduled automation",
          "Loads all NotificationPreference records matching today's frequencies",
          "Geocodes user and event zip codes; filters events by category, age, keywords, and distance (up to 100-mile radius) via eventMatchesPref",
          "Builds HTML with formatEventCard and formatAdsSection helpers, then sends via Core.SendEmail",
          "A preview_to parameter lets admin test the exact output before it goes out broadly"
        ]
      },
      {
        id: "email-supporter",
        title: "Supporter Follow-Up",
        overview: "Supporters receive automated emails for subscription renewals (21 days before), successful renewals, payment failures, waitlist spot availability, plan upgrade/downgrade confirmations, and any manual status change an admin makes (approve, reject, pause, flag) with the reason included. All advertiser-facing emails are branded consistently and include clear calls to action.",
        features: [
          "Renewal reminder: 21 days before renewal",
          "Renewal confirmation and payment failure notices",
          "Waitlist spot availability notice",
          "Plan upgrade/downgrade confirmation",
          "Admin status-change notice (approve/reject/pause/flag) with reason included"
        ],
        technicalOverview: "A set of email templates covers each Supporter lifecycle event, all sent via Core.SendEmail and previewable in the admin Email tab.",
        technicalFeatures: [
          "Templates: subscription_renewing_soon (21 days before next_renewal_date), subscription_renewed (invoice.paid webhook), subscription_payment_failed (payment_intent.payment_failed webhook), waitlist_spot_available (processWaitlist), ad_status_changed (any admin action in AdminAdsPanel, includes the admin explanation), plan_upgrade_downgrade_confirmed (requestAdPlanUpgrade/processAdPlanUpgrades)",
          "All sent via Core.SendEmail",
          "Admin can preview every template with realistic sample data in the Email tab's Site Emails Tester (toggle sample data on/off)"
        ]
      }
    ]
  },
  {
    id: "support",
    label: "Support & Resource Pages",
    sections: [
      {
        id: "contact-us",
        title: "Contact Us & Support Messages",
        overview: "Anyone — registered or not — can send a message to the site through the Contact Us page, choosing a topic (technical issue, suggestion, activity question, general question). Admin reviews and resolves these in the Messages tab.",
        features: [
          "Open to all visitors, registered or not",
          "Topic categories: technical issue, suggestion, activity question, general question",
          "Reviewed and resolved by admin in the Messages tab"
        ],
        technicalOverview: "ContactMessage entity stores each submission; ContactUs.jsx handles the form, and Admin's Messages tab manages the queue.",
        technicalFeatures: [
          "ContactMessage fields: sender_name, sender_email, sender_phone, subject (enum of topic categories), message, status (unread/read/resolved)",
          "ContactUs.jsx auto-fills sender fields for logged-in users but allows public/anonymous submission",
          "Admin's Messages tab lists, marks read/resolved, and deletes messages"
        ]
      },
      {
        id: "bot-protection",
        title: "Bot Protection (Contact Us & Registration)",
        overview: "The Contact Us form and the Registration flow are the two places on the site anyone can submit without already being a trusted, signed-in user, so they're the most exposed to automated bot spam. Both are protected with two invisible checks that don't affect real visitors at all: a 'honeypot' field that only bots fill in, and a minimum-time check that blocks submissions completed faster than a human could realistically type. If either check trips, the submission is silently blocked — the bot sees no error message or hint that it was detected.",
        features: [
          "Applies to: Contact Us form and account Registration",
          "Honeypot field: an invisible field real visitors never see or fill; bots that auto-fill every field get caught",
          "Time-trap: submissions completed faster than a human could type are blocked",
          "Silent blocking: no error or hint is shown to the bot, so it can't easily adapt",
          "No impact on real visitors — both checks run invisibly in the background"
        ],
        technicalOverview: "ContactUs.jsx and Register.jsx each track a hidden form field and a load timestamp, checked just before the real submission (ContactMessage.create or base44.auth.register) fires.",
        technicalFeatures: [
          "Honeypot: a visually hidden input (absolute positioning off-screen, tabIndex=-1, autoComplete='off') included in the form; any non-empty value marks the submission as a bot",
          "Time-trap: formLoadTime captured via useState(() => Date.now()) on mount; submission is blocked if Date.now() - formLoadTime is under the threshold (2s on Contact Us, 3s on Registration, matching each form's realistic minimum fill time)",
          "ContactUs.jsx: if either check trips, handleSubmit sets submitted=true without calling ContactMessage.create, so the bot sees the normal 'Message Sent!' confirmation",
          "Register.jsx: if either check trips in handleStep2, a generic error is shown and base44.auth.register() (which would trigger an OTP email) is never called",
          "No new entity fields or backend functions were needed — both checks are purely client-side gating before the existing write/auth calls"
        ]
      },
      {
        id: "tips-pages",
        title: "Tips & Resource Pages",
        overview: "Dedicated pages give each audience — Community Members, Organizers, and Supporters — tips on getting the most out of the site (e.g., how to find great activities, how to post an effective listing, how to make an ad perform well).",
        features: [
          "Tips for Community Members",
          "Tips for Organizers",
          "Tips for Supporters",
          "Searchable FAQ and Community Rules also live on the About page"
        ],
        technicalOverview: "Static content pages per audience, plus a searchable FAQ hosted on the About page.",
        technicalFeatures: [
          "Static pages: TipsCommunityMembers.jsx, TipsOrganizers.jsx, TipsSupporters.jsx, linked from navigation/footer based on relevance",
          "About.jsx hosts the searchable FAQ (FAQ entity: question, answer, category, sort_order, status) and the Community Rules section",
          "PostEvent.jsx links to the Community Rules via its mandatory agreement checkbox, shown to all visitors"
        ]
      }
    ]
  },
  {
    id: "admin-tools",
    label: "Admin Tools",
    sections: [
      {
        id: "admin-dashboard",
        title: "Admin Dashboard Overview",
        overview: "The Admin panel provides centralized management for all site content: activities (including photo review), users, ads (including rates, discounts, filler ads, waitlist), flags, messages, FAQs, email testing, beta rollout, and this manual. Admins can view stats, moderate content, manage ad inventory, send test emails, and review system health. Every tab follows a consistent visual style, with a titled header and content grouped in clean white bordered panels.",
        features: [
          "Activities: list/edit/delete plus photo review queue",
          "Ads: rates, discounts, filler ads, waitlist, and moderation queue",
          "Flags: flagged content, disabled items, flagging users, archived items",
          "Users: role management, disable/reactivate, Supporter grants, zip reports",
          "Messages, FAQs, Email testing, Beta rollout, and this Manual"
        ],
        technicalOverview: "Admin.jsx is the main dashboard with a tabbed interface, sharing consistent components across tabs.",
        technicalFeatures: [
          "Tabs: Activities (event list/edit/delete + AdminActivityPhotoReviewPanel), Ads (ManualReviewPanel, AdminAdsPanel, AdminWaitlistPanel, AdminAdRatesPanel, DiscountCodesPanel, AdminDefaultAdsPanel), Email (InviteOrganizer, SiteEmailsTester), FAQs (FAQManager), Flags, Manual, Messages (ContactMessage CRUD), Notifications (manual trigger via sendNotificationEmails), Users (role management + AdminUserZipReportsSection), Beta (AdminBetaPanel)",
          "All tabs share the AdminSectionHeader component for consistent title/icon styling and uniform white, bordered containers",
          "All operations use base44.entities.* SDK methods",
          "Stats computed from entity counts on load; long lists use the shared Paginator component"
        ]
      },
      {
        id: "admin-beta-mode",
        title: "Beta Mode & Zip Code Rollout",
        overview: "The site can be put into Beta Mode, where only an admin-approved list of zip codes is fully functional and a banner notifies visitors the site is in beta. This lets the team roll the product out gradually to new areas before opening it up everywhere.",
        features: [
          "Toggle beta mode on/off",
          "Admin-approved zip code whitelist",
          "Site-wide banner notice when beta mode is active"
        ],
        technicalOverview: "BetaConfig entity stores the global beta toggle and zip whitelist; useBetaConfig and BetaBanner apply it client-side.",
        technicalFeatures: [
          "BetaConfig entity (config_key='global'): enabled (boolean) and zip_codes (array of allowed zips)",
          "AdminBetaPanel toggles beta mode and manages the zip whitelist, auto-initializing the config record on first load if missing",
          "useBetaConfig hook reads this config client-side; BetaBanner renders the site-wide notice when enabled",
          "When beta mode is on, non-whitelisted zip codes see restricted functionality throughout the app"
        ]
      },
      {
        id: "admin-user-zip-reports",
        title: "User Zip Code Reports",
        overview: "Admins can see, at a glance, how many Community Members, unique Organizers, and active/waitlisted Supporters exist in each zip code — useful for spotting where the community is strong and where the ad waitlist demand is building.",
        features: [
          "Community Member counts per zip code",
          "Unique Organizer counts per zip code",
          "Active and waitlisted Supporter counts per zip code",
          "Top-zip ranking and per-zip search"
        ],
        technicalOverview: "AdminUserZipReportsSection aggregates User, Event, BannerAd, and AdWaitlist data by zip code.",
        technicalFeatures: [
          "Aggregates data from User, Event, BannerAd, and AdWaitlist entities, mapping records to zip codes",
          "Tallies community member counts, unique organizer counts, and active/waitlisted Supporter counts per zip",
          "Results render via ZipCodeRankingCard (top zips) and ZipCodeSearchCard (search any zip) inside the Users tab"
        ]
      }
    ]
  }
];

export default function AdminManual() {
  const [openSection, setOpenSection] = useState(null);

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
      <div className="bg-white rounded-2xl border border-border p-6">
        <p className="text-sm text-muted-foreground mb-5">
          This manual provides a comprehensive overview of LocalKidsCalendar's features, systems, and technical implementation.
          Each topic includes a short overview paragraph followed by a bulleted list of features, plus a "Review in more detail" technical breakdown in the same format.
          Update this manual as new features are built or existing ones change.
        </p>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => scrollToCategory(cat.id)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted hover:bg-mint-100 hover:text-mint-600 transition-colors"
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {categories.map((category) => (
        <div key={category.id} id={`manual-cat-${category.id}`} className="space-y-3 scroll-mt-4">
          <h2 className="font-heading font-bold text-lg text-foreground px-1">{category.label}</h2>
          {category.sections.map((section) => (
            <div key={section.id} className="bg-white rounded-2xl border border-border overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/40 transition-colors"
                onClick={() => setOpenSection(openSection === section.id ? null : section.id)}
              >
                <span className="font-heading font-semibold text-sm text-foreground">{section.title}</span>
                {openSection === section.id ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </button>
              {openSection === section.id && (
                <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                  <div>
                    <h4 className="font-medium text-sm text-foreground mb-2">Overview</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-2">{section.overview}</p>
                    <ul className="list-disc pl-5 space-y-1">
                      {section.features.map((f, i) => (
                        <li key={i} className="text-sm text-muted-foreground leading-relaxed">{f}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-4">
                    <h4 className="font-medium text-sm text-foreground mb-2 flex items-center gap-2">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Review in more detail — technical breakdown
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed font-mono mb-2">{section.technicalOverview}</p>
                    <ul className="list-disc pl-5 space-y-1">
                      {section.technicalFeatures.map((f, i) => (
                        <li key={i} className="text-xs text-muted-foreground leading-relaxed font-mono">{f}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}