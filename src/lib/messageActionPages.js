/**
 * Allowed destinations for optional action buttons on mass / system messages.
 * Admins pick from this list so links stay valid in-app paths.
 * Kept in alphabetical order by label.
 */
export const MESSAGE_ACTION_PAGES = [
  { href: "/about", label: "About", defaultButtonLabel: "About Local Kids Calendar" },
  { href: "/ad-manager", label: "Ad Manager", defaultButtonLabel: "Open Ad Manager" },
  { href: "/advertiser-terms", label: "Advertiser Terms", defaultButtonLabel: "View Terms" },
  { href: "/contact", label: "Contact Us", defaultButtonLabel: "Contact Us" },
  { href: "/", label: "Home", defaultButtonLabel: "Go to Home" },
  { href: "/account", label: "My Account", defaultButtonLabel: "Go to My Account" },
  { href: "/account?tab=posts", label: "My Activity Posts", defaultButtonLabel: "View My Activity Posts" },
  { href: "/account?tab=saved", label: "Saved Activities", defaultButtonLabel: "View Saved Activities" },
  { href: "/account?tab=messages", label: "Messages", defaultButtonLabel: "View Messages" },
  { href: "/organizers", label: "Organizers", defaultButtonLabel: "Browse Organizers" },
  { href: "/post-event", label: "Post an Activity", defaultButtonLabel: "Post an Activity" },
  { href: "/account?tab=profile", label: "Profile", defaultButtonLabel: "Open Profile" },
  { href: "/supporters", label: "Supporters", defaultButtonLabel: "Learn About Supporting" },
  { href: "/tips-community-members", label: "Tips for Community Members", defaultButtonLabel: "Read Tips" },
  { href: "/tips-organizers", label: "Tips for Organizers", defaultButtonLabel: "Read Tips" },
  { href: "/tips-supporters", label: "Tips for Supporters", defaultButtonLabel: "Tips For Supporters" },
];

export function messageActionPageByHref(href) {
  if (!href) return null;
  return MESSAGE_ACTION_PAGES.find((p) => p.href === href) || null;
}
