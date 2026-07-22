import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ContactProtected from "@/components/shared/ContactProtected";
import { Globe, Heart, CalendarDays } from "lucide-react";

export default function OrganizerCard({ org, isFavorite, onToggleFavorite }) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-2xl border border-border p-5 animate-settle">
      <div className="flex items-center gap-3 mb-3">
        {org.org_logo ? (
          <img src={org.org_logo} alt={org.org_name} className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-mint-100 flex items-center justify-center font-heading font-bold text-mint-500 text-lg">
            {(org.org_name || "O")[0]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-heading font-semibold text-sm truncate">{org.org_name}</p>
          {org.org_description && <p className="text-xs text-muted-foreground line-clamp-1">{org.org_description}</p>}
        </div>
        <button
          onClick={() => onToggleFavorite(org.id, org.user_id)}
          className="shrink-0 p-1.5 rounded-full hover:bg-red-50 transition-colors"
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
        </button>
      </div>
      <div className="space-y-1.5 text-sm">
        {org.org_email && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-muted-foreground text-xs shrink-0">Email:</span>
            <ContactProtected value={org.org_email} type="email" />
          </div>
        )}
        {org.org_phone && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-muted-foreground text-xs shrink-0">Phone:</span>
            <ContactProtected value={org.org_phone} type="phone" />
          </div>
        )}
        {org.org_website && (
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <a href={org.org_website.startsWith("http") ? org.org_website : `https://${org.org_website}`} target="_blank" rel="noopener" className="text-xs text-mint-500 hover:underline truncate">
              {org.org_website}
            </a>
          </div>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="w-full rounded-xl text-xs h-8 text-mint-600 border-mint-200 hover:bg-mint-50"
          onClick={() => navigate(`/?org=${encodeURIComponent(org.org_name)}`)}
        >
          <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
          View Activities
        </Button>
      </div>
    </div>
  );
}