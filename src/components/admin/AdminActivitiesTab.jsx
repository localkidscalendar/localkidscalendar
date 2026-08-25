import React from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronDown, ChevronUp, Eye, Flag, RotateCcw, Trash2 } from "lucide-react";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import AdminPanelShell from "@/components/admin/AdminPanelShell";
import SearchClearField from "@/components/shared/SearchClearField";
import Paginator, { PAGE_SIZE } from "@/components/admin/Paginator";
import { getActivityStatusMeta } from "@/components/admin/adminPageHelpers";

export default function AdminActivitiesTab({ ctx }) {
  const { eventSearch, setEventSearch, eventStatusFilter, setEventStatusFilter, eventSortBy, setEventSortBy, eventSortOrder, setEventSortOrder, eventsPage, setEventsPage, expandedEventNotes, filteredAndSortedEvents, toggleEventNotes, navigate, handleDeleteEvent, handleReactivateItem, openFlagsForActivity } = ctx;
  return (
    <>
      <AdminSectionHeader title="All Activities" icon={CalendarDays} />
      <AdminPanelShell>
        <div className="pb-4 mb-4 border-b border-border flex flex-col sm:flex-row gap-2 sm:items-center">
          <SearchClearField
            placeholder="Search by title or zip code…"
            value={eventSearch}
            onValueChange={(v) => { setEventSearch(v); setEventsPage(1); }}
          />
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "all", label: "All" },
              { id: "active", label: "Active" },
              { id: "inactive", label: "Inactive" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => { setEventStatusFilter(opt.id); setEventsPage(1); }}
                className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                  eventStatusFilter === opt.id
                    ? "border-mint-300 bg-mint-50 text-mint-700"
                    : "border-border bg-white text-muted-foreground hover:bg-mint-50 hover:border-mint-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th
                  className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 select-none"
                  onClick={() => {
                    if (eventSortBy === "title") { setEventSortOrder(eventSortOrder === "asc" ? "desc" : "asc"); }
                    else { setEventSortBy("title"); setEventSortOrder("asc"); }
                    setEventsPage(1);
                  }}
                >
                  Activity {eventSortBy === "title" && (eventSortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 select-none"
                  onClick={() => {
                    if (eventSortBy === "date") { setEventSortOrder(eventSortOrder === "asc" ? "desc" : "asc"); }
                    else { setEventSortBy("date"); setEventSortOrder("desc"); }
                    setEventsPage(1);
                  }}
                >
                  Date {eventSortBy === "date" && (eventSortOrder === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Flags</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAndSortedEvents.slice((eventsPage - 1) * PAGE_SIZE, eventsPage * PAGE_SIZE).map((e) => {
                const meta = getActivityStatusMeta(e);
                const notesOpen = expandedEventNotes.has(e.id);
                return (
                  <tr key={e.id} className="hover:bg-muted/30 align-top">
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="truncate font-medium">{e.title}</p>
                      {meta.adminNotes && (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => toggleEventNotes(e.id)}
                            className="inline-flex items-center gap-0.5 text-[11px] text-mint-600 hover:underline"
                          >
                            {notesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {notesOpen ? "Hide admin note" : "Show admin note"}
                          </button>
                          {notesOpen && (
                            <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap rounded-lg bg-muted/40 border border-border px-2 py-1.5">
                              {meta.adminNotes}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{moment(e.start_date).format("MMM D, YY")}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className={`inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-medium ${meta.chipClass}`}>
                          {meta.label}
                        </span>
                        {meta.reason && (
                          <span className="text-[11px] text-muted-foreground">{meta.reason}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{e.flag_count || 0}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1 min-w-[4.25rem]">
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => navigate(`/event/${e.id}`)} title="View activity">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        {e.status === "active" ? (
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDeleteEvent(e)} title="Delete activity">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        ) : meta.canAdminRestore ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => handleReactivateItem(e.id, "event", { adminNotes: meta.adminNotes, title: e.title })}
                            title="Restore admin-removed activity"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        ) : meta.isCommunityFlagged ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-peach-600"
                            onClick={() => openFlagsForActivity(e)}
                            title="Open in Flags (search by title)"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </Button>
                        ) : (
                          <span className="inline-block h-7 w-7 shrink-0" aria-hidden />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Paginator total={filteredAndSortedEvents.length} page={eventsPage} onPage={setEventsPage} />
      </AdminPanelShell>
    </>
  );
}
