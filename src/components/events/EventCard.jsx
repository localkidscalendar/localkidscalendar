import React from "react";
import { Link } from "react-router-dom";
import { MapPin, Clock, Users, CalendarDays, AlertCircle, DollarSign, Bookmark } from "lucide-react";
import CategoryBadge from "@/components/shared/CategoryBadge";
import moment from "moment";

export default function EventCard({ event, isSaved, onToggleSave }) {
  const isRegistrationFull = event.registration_full;
  const startDate = moment(event.start_date);
  const hasImage = event.event_image && event.posted_by_role === "organizer" && (!event.image_moderation_status || event.image_moderation_status === "approved");
  const isOrganizerPost = event.posted_by_role === "organizer";

  return (
    <Link to={`/event/${event.id}`} className="block group">
      <div className={`bg-white rounded-2xl border-2 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 animate-settle ${isOrganizerPost ? "border-mint-500 shadow-mint-100/30" : "border-border"}`}>
        {hasImage && (
          <div className="aspect-video bg-muted/30 overflow-hidden flex items-center justify-center">
            <img src={event.event_image} alt={event.title} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex flex-wrap gap-1">
              {(Array.isArray(event.category) ? event.category : event.category ? [event.category] : []).map((c) => <CategoryBadge key={c} category={c} />)}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isRegistrationFull && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-peach-50 text-peach-500">
                  <AlertCircle className="w-3 h-3" /> Full
                </span>
              )}
              {onToggleSave && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(event.id); }}
                  className="p-1.5 rounded-full hover:bg-mint-50 transition-colors"
                  title={isSaved ? "Remove from saved" : "Save activity"}
                >
                  <Bookmark className={`w-4 h-4 ${isSaved ? "fill-mint-500 text-mint-500" : "text-muted-foreground"}`} />
                </button>
              )}
            </div>
          </div>

          <h3 className="font-heading font-semibold text-base mb-1.5 line-clamp-2 group-hover:text-mint-500 transition-colors">
            {event.title}
          </h3>

          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                <span>{startDate.format("MMM D, YYYY")}</span>
                {event.time_start && (
                  <span className="text-xs">
                    · {(() => {
                      const [h, m] = event.time_start.split(":");
                      let hour = parseInt(h);
                      const period = hour >= 12 ? "PM" : "AM";
                      if (hour > 12) hour -= 12;
                      if (hour === 0) hour = 12;
                      return `${hour}:${m} ${period}`;
                    })()}
                  </span>
                )}
              </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{event.location_name || event.city}{event.state ? `, ${event.state}` : ""}</span>
            </div>
            {(event.age_min != null || event.age_max != null) && (
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>Ages {event.age_min || 0}–{event.age_max || "18+"}</span>
              </div>
            )}
            {event.cost && (
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 shrink-0" />
                <span>{event.cost}</span>
              </div>
            )}
          </div>

          {event.org_name && event.posted_by_role === "organizer" && (
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
              {event.org_logo ? (
                <img src={event.org_logo} alt={event.org_name} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-mint-100 flex items-center justify-center text-xs font-bold text-mint-500">
                  {event.org_name[0]}
                </div>
              )}
              <span className="text-xs text-muted-foreground truncate">{event.org_name}</span>
            </div>
          )}


        </div>
      </div>
    </Link>
  );
}