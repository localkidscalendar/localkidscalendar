import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, Megaphone, Star } from "lucide-react";
import BecomeASupporterModal from "@/components/ads/BecomeASupporterModal";

function buildGroups(onSupporterClick) {
  return [
    {
      icon: Users,
      title: "Community Members",
      subtitle: "including parents",
      description: "Anyone can post and share activities — you don't need to be a professional or the official organizer.",
      steps: [
        <>
          <Link to="/register" className="text-mint-500 hover:underline font-medium">Create an account</Link> as a Community Member to take advantage of all of the features of the site, including saving, favoriting, flagging, receiving email notifications, and posting activities.
        </>,
        <>
          Review the <Link to="/tips-community-members" className="text-mint-500 hover:underline font-medium">Tips for Community Members to help grow the community →</Link>
        </>,
        <>We challenge you to see how many others you can get involved!</>,
      ],
    },
    {
      icon: Megaphone,
      title: "Organizers",
      subtitle: "including local programs, teams, recreation centers, youth event promoters, etc.",
      description: "Organizers can more officially share and promote activities (with a photo and logo) beyond their already-established circles and the limited reach of newsletters and email blasts. A bigger audience means new, fresh faces to participate.",
      steps: [
        <>
          <Link to="/register" className="text-mint-500 hover:underline font-medium">Create an account</Link> as an Organizer. Organizer accounts have all of the capabilities as Community Members, but share activities in an official capacity with highlighted features (including photos).
        </>,
        <>
          Review the <Link to="/tips-organizers" className="text-mint-500 hover:underline font-medium">Tips for Organizers to help grow the community →</Link>
        </>,
        <>Post ALL of your activities that target local kids in your area and watch your audience grow!</>,
      ],
    },
    {
      icon: Star,
      title: "Supporters",
      subtitle: "aka advertisers",
      description: "Businesses can use their relationships in the community to connect different groups together to engage in the site (and, of course, strengthen their brand).",
      steps: [
        <>
          Upgrade (for free) to{" "}
          <button type="button" onClick={onSupporterClick} className="text-mint-500 hover:underline font-medium">add Supporter features</button>{" "}
          to an account. (Supporter accounts can be added to Community Member accounts, but adding to Organizer accounts is recommended.)
        </>,
        <>
          Review the <Link to="/tips-supporters" className="text-mint-500 hover:underline font-medium">Tips for Supporters to help grow the community →</Link>
        </>,
        <>Upload an image and URL to your Ad Library for pre-approval.</>,
        <>Search for an available zip code and start your plan to show your support in the community!</>,
      ],
    },
  ];
}

export default function GrowingCommunitySection({ user }) {
  const navigate = useNavigate();
  const [showSupporterModal, setShowSupporterModal] = useState(false);

  const handleSupporterClick = () => {
    if (user?.is_advertiser) {
      navigate("/ad-manager");
    } else {
      setShowSupporterModal(true);
    }
  };

  const groups = buildGroups(handleSupporterClick);

  return (
    <section>
      <h2 className="font-heading font-bold text-2xl sm:text-3xl text-foreground mb-4">Growing the Community</h2>
      <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed">
        <p>LocalKidsCalendar.com thrives when the community participates. Together, we're building a richer, more connected experience for local kids and families. Share the site with a friend, post an activity, or simply browse — every contribution makes the community more valuable for everyone.</p>
      </div>
      <p className="font-heading font-semibold text-foreground mt-6 mb-4">Getting started is simple and easy ...</p>

      <div className="space-y-5">
        {groups.map(({ icon: Icon, title, subtitle, description, steps }) => (
          <div key={title} className="bg-white border border-border rounded-2xl p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-mint-50 flex items-center justify-center shrink-0">
                <Icon className="w-4.5 h-4.5 text-mint-500" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-foreground leading-tight">{title}</h3>
                <p className="text-xs text-muted-foreground normal-case">{subtitle}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground normal-case mb-3">{description}</p>
            <ol className="space-y-2 list-decimal list-inside pl-2">
              {steps.map((step, i) => (
                <li key={i} className="text-sm text-muted-foreground normal-case pl-2 -indent-2 ml-2">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <BecomeASupporterModal
        open={showSupporterModal}
        onClose={() => setShowSupporterModal(false)}
        user={user}
      />
    </section>
  );
}