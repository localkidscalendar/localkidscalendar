import React from "react";
import { Shield, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { TOS_INTRO, TOS_SECTIONS, TOS_FOOTER, TOS_EFFECTIVE_DATE } from "@/lib/supporterContent";

const EFFECTIVE_DATE = TOS_EFFECTIVE_DATE;

export default function AdvertiserTerms() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/supporters" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Supporters
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-peach-100 flex items-center justify-center">
          <Shield className="w-5 h-5 text-peach-500" />
        </div>
        <div>
          <h1 className="font-heading font-bold text-2xl">Supporter Terms of Service</h1>
          <p className="text-xs text-muted-foreground">Effective Date: {EFFECTIVE_DATE}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 prose prose-sm max-w-none space-y-6">

        <p className="text-sm text-muted-foreground leading-relaxed">
          {TOS_INTRO}
        </p>

        {TOS_SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="font-heading font-bold text-lg mb-2">{section.title}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={i} className={`text-sm text-muted-foreground leading-relaxed ${section.emphasis ? "font-medium border-l-4 border-peach-300 pl-4" : ""} ${i > 0 ? "mt-2" : ""}`}>
                {p}
              </p>
            ))}
            {section.list && (
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 mt-2">
                {section.list.map((item, i) => (
                  <li key={i}><strong>{item.label}:</strong> {item.text}</li>
                ))}
              </ul>
            )}
            {section.afterListParagraphs?.map((p, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed mt-2">{p}</p>
            ))}
          </section>
        ))}

        <p className="text-xs text-muted-foreground pt-4 border-t border-border">
          {TOS_FOOTER}
        </p>
      </div>
    </div>
  );
}