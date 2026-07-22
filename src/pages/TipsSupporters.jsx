import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Handshake, Share2, Star, Zap, Globe, Users, TrendingUp, MessageSquare, Sparkles } from "lucide-react";

const tips = [
  {
    icon: Handshake,
    title: "You're a Connector — Use That Superpower",
    body: "Supporters (advertisers and sponsors) have something most people don't: relationships across multiple groups. You know the soccer league AND the dance studio AND the school PTA. You're uniquely positioned to introduce these groups to each other and to LocalKidsCalendar.com. Every introduction you make grows the network — and your brand grows with it.",
  },
  {
    icon: Users,
    title: "Start With Your Business Relationships",
    body: "Think about the local organizations, coaches, and program directors you already know. Tell them about the platform. Encourage them to list their activities. When more organizers post, more families visit — and more families see your ad. Your support of the platform is an investment that pays dividends as the community grows.",
  },
  {
    icon: Globe,
    title: "Why This Is Better Than a Boosted Post",
    body: "A boosted Facebook or Instagram post disappears in days, reaches an algorithm-filtered audience, and has no lasting presence. Your ad on LocalKidsCalendar.com is seen by parents who are already in 'find activities for my kids' mode — highly motivated, local, and relevant. That's a better audience than almost any social feed can deliver.",
  },
  {
    icon: TrendingUp,
    title: "Your Brand Grows As the Community Grows",
    body: "Unlike a one-time ad buy, your presence here builds equity. As more families and organizers join the platform, your brand becomes associated with the community hub that made it possible. Being an early supporter positions you as a pillar of the local family community — not just an advertiser.",
  },
  {
    icon: Share2,
    title: "Share the Platform Through Your Own Channels",
    body: "Mention LocalKidsCalendar.com in your own newsletter, social media, or storefront. 'We support local kids and families — check out this community calendar' is a genuine, goodwill message that resonates with parents. It also drives traffic to the platform, which increases exposure for everyone — including you.",
  },
  {
    icon: MessageSquare,
    title: "Encourage Organizers You Sponsor to Post",
    body: "If you already sponsor a local team, league, or program, encourage them to list their activities here. Their listing brings families to the platform. Your ad is on the platform. The connection is natural — and your sponsorship investment reaches further than just the team's existing circle.",
  },
  {
    icon: Zap,
    title: "Why This Beats Generic Local Advertising",
    body: "Mailers, local newspaper ads, and generic digital banners reach everyone — most of whom aren't your audience. LocalKidsCalendar.com reaches parents with kids, actively engaged in finding local activities. There's no better-targeted local audience for family-oriented businesses, services, and organizations.",
  },
  {
    icon: Star,
    title: "Be Visible at the Moment That Matters",
    body: "Parents are most receptive to local business messages when they're already in a community mindset — planning their kids' activities, connecting with other families, organizing their schedules. That's exactly when they're on this platform. Your ad appears at precisely the right moment, in the right context.",
  },
  {
    icon: Sparkles,
    title: "Seek Out the Community's Key Influencers",
    body: "As a Supporter, you likely already know the coaches, PTA leaders, and well-connected parents who shape opinion across multiple groups. Introduce them to LocalKidsCalendar.com directly. When a respected connector adopts and shares the platform, the families around them follow — growing the audience your ad reaches, at no extra cost to you.",
  },
];

export default function TipsSupporters() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link to="/about" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-mint-500 mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to About
      </Link>

      <div className="mb-10">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-600 mb-3">Supporters</span>
        <h1 className="font-heading font-bold text-3xl sm:text-4xl text-foreground mb-4">Tips for Supporters to Help Grow the Community</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Supporters are the fuel that keeps this platform free for families and organizers. Here's how to make the most of your role — and why your reach goes further here than anywhere else.
        </p>
      </div>

      <div className="space-y-8">
        {tips.map((tip, i) => {
          const Icon = tip.icon;
          return (
            <div key={i} className="flex gap-4 p-5 bg-white border border-border rounded-2xl">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Icon className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h2 className="font-heading font-semibold text-base text-foreground mb-2">{tip.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{tip.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 p-6 bg-blue-50 rounded-2xl border border-blue-100 text-center">
        <p className="font-heading font-semibold text-foreground mb-2">Ready to reach local families?</p>
        <p className="text-sm text-muted-foreground mb-4">Advertising on LocalKidsCalendar.com puts your brand in front of engaged, local parents at exactly the right moment.</p>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 text-sm">
        <Link to="/tips-community-members" className="text-mint-500 hover:underline">Tips for Community Members →</Link>
        <Link to="/tips-organizers" className="text-mint-500 hover:underline">Tips for Organizers →</Link>
      </div>
    </div>
  );
}