import React from "react";
import { Shield } from "lucide-react";
import {
  LEGAL_EFFECTIVE_DATE,
  PRIVACY_INTRO,
  PRIVACY_SECTIONS,
  PRIVACY_FOOTER,
} from "@/lib/legalContent";
import HistoryBackLink from "@/components/shared/HistoryBackLink";
import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <HistoryBackLink className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors" />

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-peach-100 flex items-center justify-center">
          <Shield className="w-5 h-5 text-peach-500" />
        </div>
        <div>
          <h1 className="font-heading font-bold text-2xl">Privacy Policy</h1>
          <p className="text-xs text-muted-foreground">Effective Date: {LEGAL_EFFECTIVE_DATE}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 prose prose-sm max-w-none space-y-6">
        <p className="text-sm text-muted-foreground leading-relaxed">{PRIVACY_INTRO}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Also see our{" "}
          <Link to="/terms" className="text-mint-600 underline underline-offset-2 hover:text-mint-700">Terms of Service</Link>
          {" "}and{" "}
          <Link to="/about#community-rules" className="text-mint-600 underline underline-offset-2 hover:text-mint-700">Our Community Rules</Link>.
        </p>

        {PRIVACY_SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="font-heading font-bold text-lg mb-2">{section.title}</h2>
            {section.paragraphs.map((p, i) => (
              <p
                key={i}
                className={`text-sm text-muted-foreground leading-relaxed ${section.emphasis ? "font-medium border-l-4 border-peach-300 pl-4" : ""} ${i > 0 ? "mt-2" : ""}`}
              >
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

        <p className="text-xs text-muted-foreground pt-4 border-t border-border">{PRIVACY_FOOTER}</p>
      </div>
    </div>
  );
}
