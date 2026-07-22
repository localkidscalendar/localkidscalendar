import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Users, Share2, MessageSquare, Star, Zap, Heart, Globe, Bell, Sparkles } from "lucide-react";

const tips = [
  {
    icon: Heart,
    title: "Start With Your Inner Circle",
    body: "Think about the parents you already text with — your kids' teammates, classmates, playdate friends, and neighborhood families. These people already trust you. A personal recommendation from you carries far more weight than any flyer or social post. Send them a direct message with a link to an activity you found here and say 'thought of your kids!' That personal touch is how communities grow.",
  },
  {
    icon: Users,
    title: "Expand to Your Groups",
    body: "You're probably in a handful of parent group chats, school apps, or neighborhood forums. Share LocalKidsCalendar.com there! A quick 'Hey, found this great site for local kids' activities — way easier than searching Facebook groups' is all it takes. One message to a group of 30 parents reaches far more people than individual posts ever could.",
  },
  {
    icon: Share2,
    title: "Share Activities, Not Just the Site",
    body: "When you find a great camp or class, share the specific activity listing — not just the homepage. A direct link to something relevant and timely ('Soccer tryouts start next week!') gives people an immediate reason to click and return. Use the Share button on any activity to grab a link instantly.",
  },
  {
    icon: Zap,
    title: "Why This Beats the Alternatives",
    body: "Group texts get buried. Facebook groups are noisy and hard to search. School newsletters arrive too late and reach only one school. LocalKidsCalendar.com is always on, searchable by age, category, and location, and updated by the whole community — not just one admin. When you post here, the right families find it on their own timeline, not yours.",
  },
  {
    icon: MessageSquare,
    title: "Post Activities You Already Know About",
    body: "You don't need to be the official organizer to post. If your kid's soccer league hasn't posted their season schedule, post it yourself! If a great summer camp from last year is open for registration, add it. Community members are the backbone of this platform — your local knowledge is exactly what other parents need.",
  },
  {
    icon: Bell,
    title: "Save Activities and Set Notifications",
    body: "Save activities you're interested in and set up notification preferences so you never miss registration openings. When you're on top of local happenings, you naturally become the go-to resource in your friend group — which brings even more families to the platform.",
  },
  {
    icon: Globe,
    title: "Think Beyond Your Own Kids",
    body: "Your neighbor's kids are a different age. Your coworker has a kid who loves theater. Post and share activities even when they're not for your own children. The more generous and broad your contributions, the more valuable the community becomes for everyone — including you.",
  },
  {
    icon: Star,
    title: "Encourage Organizers to Join",
    body: "Know a great coach, studio, or program that isn't on here yet? Tell them about LocalKidsCalendar.com. Organizers can post with their logo and full details, which helps families find them more easily. You're doing them a favor — and making the platform better for everyone.",
  },
  {
    icon: Sparkles,
    title: "Find Your Community's Key Connectors",
    body: "Every neighborhood has a few parents everyone turns to for recommendations — the ones running the group chats, coaching the teams, or organizing the playdates. Point them toward LocalKidsCalendar.com. When a trusted connector starts using and sharing the site, it naturally reaches dozens of families who trust their word — spreading the benefit far beyond what one person could do alone.",
  },
];

export default function TipsCommunityMembers() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link to="/about" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-mint-500 mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to About
      </Link>

      <div className="mb-10">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-mint-100 text-mint-600 mb-3">Community Members</span>
        <h1 className="font-heading font-bold text-3xl sm:text-4xl text-foreground mb-4">Tips for Community Members to Help Grow the Community</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          You don't need a title or a budget to make a big difference here. As a parent or community member, your voice and your network are the most powerful tools on this platform. Here's how to use them.
        </p>
      </div>

      <div className="space-y-8">
        {tips.map((tip, i) => {
          const Icon = tip.icon;
          return (
            <div key={i} className="flex gap-4 p-5 bg-white border border-border rounded-2xl">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-mint-50 flex items-center justify-center">
                <Icon className="w-5 h-5 text-mint-500" />
              </div>
              <div>
                <h2 className="font-heading font-semibold text-base text-foreground mb-2">{tip.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{tip.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 p-6 bg-mint-50 rounded-2xl border border-mint-100 text-center">
        <p className="font-heading font-semibold text-foreground mb-2">Every contribution counts.</p>
        <p className="text-sm text-muted-foreground">The more parents who share and post, the richer this calendar becomes for every family in your community. Thank you for being part of it.</p>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 text-sm">
        <Link to="/tips-organizers" className="text-mint-500 hover:underline">Tips for Organizers →</Link>
        <Link to="/tips-supporters" className="text-mint-500 hover:underline">Tips for Supporters →</Link>
      </div>
    </div>
  );
}