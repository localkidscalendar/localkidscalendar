import React, { useState, useEffect } from "react";
import { useOutletContext, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown, ChevronUp, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import GrowingCommunitySection from "@/components/about/GrowingCommunitySection";

export default function About() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadFaqs();
  }, []);

  const loadFaqs = async () => {
    try {
      const { data, error } = await supabase
        .from("faqs")
        .select("*")
        .eq("status", "active")
        .order("sort_order", { ascending: true })
        .limit(200);
      if (error) throw error;
      setFaqs(data || []);
    } catch {
      setFaqs([]);
    }
  };

  const categories = ["All", ...Array.from(new Set(faqs.map((f) => f.category).filter(Boolean)))];
  const filtered = faqs
    .filter((f) => activeCategory === "All" || f.category === activeCategory)
    .filter((f) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
    });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-16">

      {/* About Section */}
      <section>
        <h1 className="font-heading font-bold text-3xl sm:text-4xl text-foreground mb-4">About LocalKidsCalendar.com</h1>
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-4 leading-relaxed">
          <img
            src="/logo.png"
            alt="LocalKidsCalendar logo"
            className="w-36 h-36 object-contain float-left mr-4 mb-2 border border-gray-300 rounded-xl"
          />
          <p>LocalKidsCalendar.com is a free, community-powered hub, built by parents, for parents. We believe that every child deserves access to enriching local experiences — from summer camps and after-school classes to sports leagues and weekend events — and that finding those opportunities should be easy, fast, and free.</p>
          <p>Our platform brings together local families and activity organizers in one central place. Whether you're a parent searching for the perfect soccer camp or a dance studio looking to reach more local families, LocalKidsCalendar.com is your community's home base.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={() => navigate("/invite-community-member")}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite a Community Member
          </Button>
          <Button className="rounded-xl bg-mint-200 hover:bg-mint-300 text-mint-600" onClick={() => navigate("/invite-organizer")}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite an Organizer
          </Button>
          <Button className="rounded-xl bg-mint-200 hover:bg-mint-300 text-mint-600" onClick={() => navigate("/invite-supporter")}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite a Supporter
          </Button>
        </div>
      </section>

      {/* Growing the Community Section */}
      <GrowingCommunitySection user={user} />

      {/* Community Rules Section */}
      <section id="community-rules">
        <h2 className="font-heading font-bold text-2xl sm:text-3xl text-foreground mb-4">Our Community Rules</h2>
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-4 leading-relaxed">
          <p>To keep LocalKidsCalendar.com a safe, welcoming, and valuable resource for all families and organizers, we ask everyone to follow these guidelines and policies (Terms of Service and Privacy):</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Support Local:</strong> Help us grow by sharing activities you love, inviting friends, and being an active part of our community.</li>
            <li><strong>Respect the Community:</strong> Keep comments and interactions friendly and constructive. We don't tolerate harassment, discrimination, or hate speech of any kind.</li>
            <li><strong>Be Honest and Accurate:</strong> Post truthful information about activities, prices, ages, and schedules. Misleading or false listings hurt families and damage trust in our community.</li>
            <li><strong>Protect Privacy:</strong> Never share personal information about children or families without permission. Be mindful of what you post in photos and comments. We value your privacy and do not sell your personal data; we only use information to facilitate local community connections.</li>
            <li><strong>No Personal Solicitation:</strong> Activities should not be used for soliciting individual services, offers, discounts, etc. Don't post babysitting services, private lessons, one-on-one tutoring, etc. (These types of solicitations may be appropriate as paid-for <Link to="/supporters" className="text-mint-500 hover:underline">Supporter</Link> advertisements though.)</li>
            <li><strong>No Spam or Inappropriate Content:</strong> Don't post spam, adult content, or unrelated ads. Keep all posts relevant to kids' activities and family interests.</li>
            <li><strong>Geographic Scope:</strong> LocalKidsCalendar.com is intended exclusively for use within the United States. By using this site, you confirm that you are located within the U.S.</li>
            <li><strong>Disclaimer:</strong> This platform is a community-powered hub. LocalKidsCalendar.com does not verify, endorse, or guarantee the safety or quality of any third-party activities posted. Users participate in listed activities at their own discretion and risk.</li>
            <li><strong>Report Issues:</strong> If you see something inappropriate or harmful, use the flag feature to let our moderation team know. We review all reports seriously.</li>
          </ul>
          <p>Accounts that violate these rules may be suspended or removed. We're all here to create a better experience for local kids and families!</p>
        </div>
      </section>

      {/* FAQ Section */}
      <section>
        <h2 className="font-heading font-bold text-2xl sm:text-3xl text-foreground mb-6">Frequently Asked Questions</h2>

        {faqs.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  activeCategory === cat
                    ? "bg-mint-500 text-white border-mint-500"
                    : "bg-white text-muted-foreground border-border hover:border-mint-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {faqs.length > 0 && (
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search FAQs..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-input bg-white text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No FAQs available yet. Check back soon!</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((faq) => (
              <div key={faq.id} className="border border-border rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/40 transition-colors"
                  onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                >
                  <span className="font-medium text-sm text-foreground pr-4">{faq.question}</span>
                  {openId === faq.id ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                {openId === faq.id && (
                  <div
                    className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3 [&_a]:text-mint-500 [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: faq.answer }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}