import React from "react";
import { Link, useLocation } from "react-router-dom";
import { MapPin, Clock, Users, CalendarDays, AlertCircle, DollarSign, Bookmark } from "lucide-react";
import CategoryBadge from "@/components/shared/CategoryBadge";
import moment from "moment";

function defaultBackLabel(pathname) {
  if (pathname === "/" || pathname === "") return "Back to Activities";
  if (pathname.startsWith("/account")) return "Back to My Account";
  if (pathname.startsWith("/admin")) return "Back to Admin";
  if (pathname.startsWith("/organizers")) return "Back to Organizers";
  return "Back";
}

export default function EventCard({ event, isSaved, onToggleSave, backLabel, variant = "card" }) {
  const location = useLocation();
  const isRegistrationFull = event.registration_full;
  const startDate = moment(event.start_date);
  const hasImage = event.event_image && event.posted_by_role === "organizer" && (!event.image_moderation_status || event.image_moderation_status === "approved");
  const isOrganizerPost = event.posted_by_role === "organizer";
  const linkState = {
    fromApp: true,
    backLabel: backLabel || defaultBackLabel(location.pathname),
  };

  const categories = Array.isArray(event.category) ? event.category : event.category ? [event.category] : [];
  const timeLabel = event.time_start
    ? (() => {
        const [h, m] = event.time_start.split(":");
        let hour = parseInt(h, 10);
        const period = hour >= 12 ? "PM" : "AM";
        if (hour > 12) hour -= 12;
        if (hour === 0) hour = 12;
        return `${hour}:${m} ${period}`;
      })()
    : null;

  const saveButton = onToggleSave ? (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(event.id); }}
      className="p-1.5 rounded-full hover:bg-mint-50 transition-colors"
      title={isSaved ? "Remove from saved" : "Save activity"}
    >
      <Bookmark className={`w-4 h-4 ${isSaved ? "fill-mint-500 text-mint-500" : "text-muted-foreground"}`} />
    </button>
  ) : null;

  if (variant === "list") {
    return (
      <Link to={`/event/${event.id}`} state={linkState} className="block group">
        <div className={`bg-white rounded-2xl border-2 p-3 flex gap-3 items-start transition-all duration-300 hover:shadow-md hover:-translate-y-px animate-settle ${isOrganizerPost ? "border-mint-500 shadow-mint-100/30" : "border-border"}`}>
          {hasImage ? (
            <img
              src={event.event_image}
              alt=""
              className="w-28 h-[4.5rem] object-cover rounded-xl shrink-0"
            />
          ) : null}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                {categories.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {categories.map((c) => (
                      <CategoryBadge key={c} category={c} />
                    ))}
                  </div>
                ) : null}
                <h3 className="font-heading font-semibold text-sm leading-snug line-clamp-1 group-hover:text-mint-500 transition-colors">
                  {event.title}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isRegistrationFull ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-peach-50 text-peach-500 whitespace-nowrap">
                    <AlertCircle className="w-3 h-3" /> Full
                  </span>
                ) : null}
                {saveButton}
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="w-3 h-3 shrink-0" />
                {startDate.format("MMM D, YYYY")}
                {timeLabel ? ` · ${timeLabel}` : ""}
              </span>
              <span className="inline-flex items-center gap-1 min-w-0">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{event.location_name || event.city}{event.state ? `, ${event.state}` : ""}</span>
              </span>
              {(event.age_min != null || event.age_max != null) ? (
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3 h-3 shrink-0" />
                  Ages {event.age_min || 0}–{event.age_max || "18+"}
                </span>
              ) : null}
              {event.cost ? (
                <span className="inline-flex items-center gap-1">
                  <DollarSign className="w-3 h-3 shrink-0" />
                  {event.cost}
                </span>
              ) : null}
              {event.org_name && event.posted_by_role === "organizer" ? (
                <span className="inline-flex items-center gap-1 min-w-0">
                  {event.org_logo ? (
                    <img src={event.org_logo} alt="" className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-mint-100 flex items-center justify-center text-[9px] font-bold text-mint-500">
                      {event.org_name[0]}
                    </span>
                  )}
                  <span className="truncate">{event.org_name}</span>
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/event/${event.id}`} state={linkState} className="block group">
      <div className={`bg-white rounded-2xl border-2 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 animate-settle ${isOrganizerPost ? "border-mint-500 shadow-mint-100/30" : "border-border"}`}>
        {hasImage && (
          <div className="aspect-video bg-muted/30 overflow-hidden">
            <img src={event.event_image} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start gap-2 mb-2">
            <div className="flex flex-wrap gap-1 min-w-0 flex-1">
              {(Array.isArray(event.category) ? event.category : event.category ? [event.category] : []).map((c) => (
                <CategoryBadge key={c} category={c} />
              ))}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isRegistrationFull && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-peach-50 text-peach-500 whitespace-nowrap">
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