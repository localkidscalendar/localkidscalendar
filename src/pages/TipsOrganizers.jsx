import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, Share2, Star, Zap, Bell, Globe, Users, TrendingUp, Sparkles } from "lucide-react";

const tips = [
  {
    icon: Building2,
    title: "Claim Your Presence — It's Free",
    body: "Unlike paid directory sites or boosted social media posts, listing your activities here costs nothing. Create an Organizer account to post with your logo, contact info, photos, and full program details. Families searching for exactly what you offer will find you — without you having to constantly re-post to stay visible.",
  },
  {
    icon: Users,
    title: "Start With Families Who Already Know You",
    body: "Email your current roster and ask them to save your organization as a favorite on LocalKidsCalendar.com. When families favorite you, they automatically receive notifications when you post new activities. This turns your existing community into a loyal, self-refreshing audience — no email list management required.",
  },
  {
    icon: Bell,
    title: "Why This Beats Your Newsletter",
    body: "Newsletters go to the same people every time, arrive on your schedule (not theirs), and get lost in crowded inboxes. LocalKidsCalendar.com lets families subscribe to you and get notified on their terms. New families discover you through search and category browsing — something a newsletter can never do. Your reach extends far beyond your existing list.",
  },
  {
    icon: Globe,
    title: "Why This Beats Social Media",
    body: "Social media algorithms decide who sees your posts — and organic reach keeps shrinking. Paid boosts are expensive and temporary. Here, your listing stays visible as long as your activity is active, it's searchable by age range and category, and it reaches parents who are already looking for what you offer. No algorithm. No ad budget needed.",
  },
  {
    icon: Share2,
    title: "Embed Sharing Into Your Workflow",
    body: "Every time you post a new program, share the LocalKidsCalendar.com link in your existing channels — email, text, Instagram bio, Facebook page. You don't have to choose one over the other. Use social media to drive traffic here, where families get all the details in one clean place and can save, share, and return easily.",
  },
  {
    icon: Zap,
    title: "Post Early, Post Often",
    body: "Families plan ahead. Post your summer camps in January, your fall season in June. Parents who set notification preferences will see your listing right when they're making decisions. Early visibility leads to early registrations — giving you better planning data and reducing last-minute scrambles.",
  },
  {
    icon: TrendingUp,
    title: "Reach Families Outside Your Circle",
    body: "Your newsletter reaches families who already know you. Text groups reach people already in your orbit. LocalKidsCalendar.com reaches families in your zip code and surrounding areas who have never heard of you — people who moved here recently, whose kids just aged into your program, or who have simply never come across your marketing. This is genuinely new audience reach.",
  },
  {
    icon: Star,
    title: "Encourage Parents to Post on Your Behalf",
    body: "Can't find the time to post? Ask a parent volunteer or enthusiastic family to do it for you. Community members can post activities without being the official organizer. Any visibility is good visibility, and you can always follow up with a more detailed official listing later.",
  },
  {
    icon: Sparkles,
    title: "Identify the Connectors in Your Network",
    body: "Every program has a few parents, coaches, or staff members who other families naturally listen to — team captains' parents, front-desk staff, veteran volunteers. Make sure they know about LocalKidsCalendar.com and encourage them to favorite and share your listing. When a trusted connector spreads the word, it carries further and faster than any post from your official account alone.",
  },
];

export default function TipsOrganizers() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link to="/about" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-mint-500 mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to About
      </Link>

      <div className="mb-10">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-peach-100 text-peach-500 mb-3">Organizers</span>
        <h1 className="font-heading font-bold text-3xl sm:text-4xl text-foreground mb-4">Tips for Organizers to Help Grow the Community</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          You run the programs that make this community thrive. Here's how to get more families through the door — and why LocalKidsCalendar.com works harder for you than the tools you're probably already using.
        </p>
      </div>

      <div className="space-y-8">
        {tips.map((tip, i) => {
          const Icon = tip.icon;
          return (
            <div key={i} className="flex gap-4 p-5 bg-white border border-border rounded-2xl">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-peach-50 flex items-center justify-center">
                <Icon className="w-5 h-5 text-peach-500" />
              </div>
              <div>
                <h2 className="font-heading font-semibold text-base text-foreground mb-2">{tip.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{tip.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 p-6 bg-peach-50 rounded-2xl border border-peach-100 text-center">
        <p className="font-heading font-semibold text-foreground mb-2">Your programs deserve to be found.</p>
        <p className="text-sm text-muted-foreground">Every listing you post helps families discover you — and helps build a richer, more connected local community for everyone.</p>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 text-sm">
        <Link to="/tips-community-members" className="text-mint-500 hover:underline">Tips for Community Members →</Link>
        <Link to="/tips-supporters" className="text-mint-500 hover:underline">Tips for Supporters →</Link>
      </div>
    </div>
  );
}