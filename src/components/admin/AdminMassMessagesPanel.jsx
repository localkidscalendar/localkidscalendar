import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Archive, ChevronDown, ChevronUp, Loader2, Send, Trash2 } from "lucide-react";
import moment from "moment";
import { sendMassMessage, retractMassMessage } from "@/lib/userMessages";
import { MESSAGE_ACTION_PAGES, messageActionPageByHref } from "@/lib/messageActionPages";
import { toTitleCaseLabel } from "@/lib/titleCase";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import AdminPanelShell from "@/components/admin/AdminPanelShell";
import Paginator, { PAGE_SIZE } from "@/components/admin/Paginator";

const AUDIENCE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "community_member", label: "Community Members" },
  { value: "organizer", label: "Organizers" },
  { value: "advertiser", label: "Advertisers" },
];

const SPECIFIC_AUDIENCES = ["community_member", "organizer", "advertiser"];

const FILTER_ROLE_OPTIONS = [
  { value: "all", label: "All" },
  ...AUDIENCE_OPTIONS.filter((o) => o.value !== "all"),
];

const chipClass = (active) =>
  `text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
    active
      ? "border-mint-300 bg-mint-50 text-mint-700"
      : "border-border bg-white hover:bg-mint-50 hover:border-mint-200 hover:text-mint-700 text-muted-foreground"
  }`;

function normalizeAudienceSelection(nextSet) {
  const specifics = SPECIFIC_AUDIENCES.filter((v) => nextSet.has(v));
  if (nextSet.has("all") || specifics.length === 0 || specifics.length === 3) {
    return ["all"];
  }
  return specifics;
}

function audienceRolesFromRow(m) {
  if (Array.isArray(m.audience_roles) && m.audience_roles.length) return m.audience_roles;
  if (m.audience_role) {
    if (m.audience_role.includes(",")) return m.audience_role.split(",").map((s) => s.trim()).filter(Boolean);
    return [m.audience_role];
  }
  return ["all"];
}

function audienceLabel(roles) {
  const list = Array.isArray(roles) ? roles : [roles];
  if (!list.length || list.includes("all")) return "All";
  return list
    .map((r) => AUDIENCE_OPTIONS.find((o) => o.value === r)?.label || r)
    .join(", ");
}

function ArchiveMessageBody({ body }) {
  const bodyRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [body]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || expanded) return;
    setNeedsExpand(el.scrollHeight > el.clientHeight + 2);
  }, [body, expanded]);

  if (!body) return null;

  return (
    <div className="mt-1.5">
      <p
        ref={bodyRef}
        className={`text-xs text-muted-foreground whitespace-pre-wrap ${
          expanded ? "" : "line-clamp-3 max-h-[4.5rem] overflow-hidden"
        }`}
      >
        {body}
      </p>
      {(needsExpand || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-medium text-mint-600 hover:text-mint-700"
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              Show more <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default function AdminMassMessagesPanel({ toast, activeSection = "mass-compose" }) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [archivePage, setArchivePage] = useState(1);
  const [retractingId, setRetractingId] = useState(null);
  const [confirmSend, setConfirmSend] = useState(null);
  const [form, setForm] = useState({
    subject: "",
    body: "",
    audienceRoles: ["all"],
    zipMode: "all",
    zipsRaw: "",
    includeAction: false,
    actionLabel: "",
    actionHref: "",
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("mass_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      toast?.({ title: "Could not load mass messages", description: error.message, variant: "destructive" });
      setItems([]);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setArchivePage(1);
  }, [search, roleFilter, activeSection]);

  const filtered = useMemo(() => {
    let list = [...items];
    if (roleFilter !== "all") {
      list = list.filter((m) => audienceRolesFromRow(m).includes(roleFilter));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          (m.subject || "").toLowerCase().includes(q) ||
          (m.body || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, search, roleFilter]);

  const toggleAudience = (value) => {
    setForm((f) => {
      const current = new Set(f.audienceRoles);
      if (value === "all") {
        return { ...f, audienceRoles: ["all"] };
      }
      current.delete("all");
      if (current.has(value)) current.delete(value);
      else current.add(value);
      return { ...f, audienceRoles: normalizeAudienceSelection(current) };
    });
  };

  const handleActionPageChange = (href) => {
    const page = messageActionPageByHref(href);
    setForm((f) => ({
      ...f,
      actionHref: href,
      actionLabel: f.actionLabel.trim()
        ? toTitleCaseLabel(f.actionLabel)
        : toTitleCaseLabel(page?.defaultButtonLabel || ""),
    }));
  };

  const handleSendClick = () => {
    if (!form.subject.trim() || !form.body.trim()) {
      toast?.({ title: "Subject and message are required", variant: "destructive" });
      return;
    }
    const zips =
      form.zipMode === "custom"
        ? [...new Set(
            form.zipsRaw
              .split(/[\s,]+/)
              .map((z) => z.trim())
              .filter(Boolean)
          )]
        : [];
    if (form.zipMode === "custom" && zips.length === 0) {
      toast?.({ title: "Enter at least one zip code", variant: "destructive" });
      return;
    }
    const actionLabel = form.includeAction ? toTitleCaseLabel(form.actionLabel.trim()) : "";
    const actionHref = form.includeAction ? form.actionHref.trim() : "";
    if (form.includeAction) {
      if (!actionHref || !messageActionPageByHref(actionHref)) {
        toast?.({ title: "Choose a valid page for the action button", variant: "destructive" });
        return;
      }
      if (!actionLabel) {
        toast?.({ title: "Action button needs a label", variant: "destructive" });
        return;
      }
    }
    const roles = normalizeAudienceSelection(new Set(form.audienceRoles));
    setConfirmSend({
      subject: form.subject.trim(),
      body: form.body.trim(),
      audienceRoles: roles,
      audienceZips: zips,
      actionLabel: actionLabel || null,
      actionHref: actionHref || null,
      audienceText: audienceLabel(roles),
      zipText: zips.length ? zips.join(", ") : "All zip codes",
    });
  };

  const handleConfirmSend = async () => {
    if (!confirmSend) return;
    const payload = confirmSend;
    setSending(true);
    const { data, error } = await sendMassMessage({
      subject: payload.subject,
      body: payload.body,
      audienceRoles: payload.audienceRoles,
      audienceZips: payload.audienceZips,
      actionLabel: payload.actionLabel,
      actionHref: payload.actionHref,
    });
    setSending(false);
    if (error) {
      toast?.({ title: "Send failed", description: error.message, variant: "destructive" });
      return;
    }
    setConfirmSend(null);
    toast?.({
      title: "Message sent",
      description: `Delivered to ${data?.recipient_count ?? 0} user(s).`,
    });
    setForm({
      subject: "",
      body: "",
      audienceRoles: ["all"],
      zipMode: "all",
      zipsRaw: "",
      includeAction: false,
      actionLabel: "",
      actionHref: "",
    });
    load();
  };

  const handleRetract = async (m) => {
    const recipients = Number(m.recipient_count || 0);
    if (
      !window.confirm(
        `Retract this mass message?\n\n"${m.subject}"\n\nThis removes it from all ${recipients} recipient inbox(es) and deletes it from the archive.`
      )
    ) {
      return;
    }
    setRetractingId(m.id);
    const { data, error } = await retractMassMessage(m.id);
    setRetractingId(null);
    if (error) {
      toast?.({ title: "Could not retract", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.filter((row) => row.id !== m.id));
    toast?.({
      title: "Message retracted",
      description: `Removed from ${data ?? recipients} inbox(es).`,
    });
  };

  const paginatedArchive = filtered.slice((archivePage - 1) * PAGE_SIZE, archivePage * PAGE_SIZE);

  return (
    <>
      {activeSection === "mass-compose" && (
        <>
        <AdminSectionHeader title="Compose Mass Message" icon={Send} />
        <AdminPanelShell>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Subject *</Label>
              <Input
                className="mt-1 rounded-xl"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Site update title"
              />
            </div>
            <div>
              <Label className="text-xs">Message *</Label>
              <Textarea
                className="mt-1 rounded-xl min-h-[120px]"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Write your notice…"
              />
              <p className="text-[11px] text-muted-foreground mt-1">No character limit.</p>
            </div>

            <div>
              <Label className="text-xs">Audience *</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {AUDIENCE_OPTIONS.map((opt) => {
                  const active = form.audienceRoles.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleAudience(opt.value)}
                      className={chipClass(active)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Default is All. You can pick one or two of Community Members, Organizers, or Advertisers. Selecting all three returns to All.
              </p>
            </div>

            <div>
              <Label className="text-xs">Zip codes *</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <button
                  type="button"
                  className={chipClass(form.zipMode === "all")}
                  onClick={() => setForm((f) => ({ ...f, zipMode: "all" }))}
                >
                  All zip codes
                </button>
                <button
                  type="button"
                  className={chipClass(form.zipMode === "custom")}
                  onClick={() => setForm((f) => ({ ...f, zipMode: "custom" }))}
                >
                  Custom zip codes
                </button>
              </div>
              {form.zipMode === "custom" && (
                <div className="mt-2">
                  <Input
                    className="rounded-xl"
                    value={form.zipsRaw}
                    onChange={(e) => setForm((f) => ({ ...f, zipsRaw: e.target.value }))}
                    placeholder="89448, 89449"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Matches profile zip; for Advertisers also matches ad placement zips.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={form.includeAction}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      includeAction: e.target.checked,
                      ...(e.target.checked
                        ? {}
                        : { actionLabel: "", actionHref: "" }),
                    }))
                  }
                />
                Add optional action button
              </label>
              {form.includeAction && (
                <div className="mt-2 grid sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Page *</Label>
                    <Select value={form.actionHref || undefined} onValueChange={handleActionPageChange}>
                      <SelectTrigger className="mt-1 rounded-xl">
                        <SelectValue placeholder="Choose a page…" />
                      </SelectTrigger>
                      <SelectContent>
                        {MESSAGE_ACTION_PAGES.map((p) => (
                          <SelectItem key={p.href} value={p.href}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Button label *</Label>
                    <Input
                      className="mt-1 rounded-xl"
                      value={form.actionLabel}
                      onChange={(e) => setForm((f) => ({ ...f, actionLabel: e.target.value }))}
                      placeholder="Open Ad Manager"
                    />
                  </div>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Leave off for news/announcements. Pick a site page when users need to go somewhere specific.
              </p>
            </div>

            <Button
              type="button"
              className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
              disabled={sending}
              onClick={handleSendClick}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
              Send message
            </Button>
          </div>
        </AdminPanelShell>
        </>
      )}

      {activeSection === "mass-archive" && (
        <>
        <AdminSectionHeader title="Archived Mass Messages" icon={Archive} />
        <AdminPanelShell>
          <div className="space-y-3">
            <div className="space-y-2">
              <Input
                placeholder="Search sent messages…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-lg h-8 text-sm sm:max-w-xs"
              />
              <div className="flex flex-wrap gap-1.5">
                {FILTER_ROLE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setRoleFilter(o.value)}
                    className={chipClass(roleFilter === o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-mint-500" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No mass messages yet.</p>
            ) : (
              <div className="space-y-2">
                {paginatedArchive.map((m) => {
                  const zips = m.audience_zips || [];
                  const roles = audienceRolesFromRow(m);
                  const page = messageActionPageByHref(m.action_href);
                  const busy = retractingId === m.id;
                  return (
                    <div key={m.id} className="rounded-xl border border-border bg-white p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mb-0.5">
                            <span>{moment(m.created_at).format("MMM D, YYYY h:mm A")}</span>
                            <span>· {audienceLabel(roles)}</span>
                            <span>· {zips.length ? `Zips: ${zips.join(", ")}` : "All zips"}</span>
                            <span>· {Number(m.recipient_count || 0)} recipients</span>
                          </div>
                          <p className="text-sm font-medium">{m.subject}</p>
                          <ArchiveMessageBody body={m.body} />
                          {m.action_label && m.action_href ? (
                            <p className="text-[11px] text-muted-foreground mt-1.5">
                              Button: {m.action_label}
                              {page ? ` → ${page.label}` : ` → ${m.action_href}`}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-xl h-7 px-2 text-xs text-destructive shrink-0"
                          disabled={busy}
                          title="Retract message"
                          onClick={() => handleRetract(m)}
                        >
                          {busy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          <span className="ml-1 hidden sm:inline">Retract</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <Paginator total={filtered.length} page={archivePage} onPage={setArchivePage} />
              </div>
            )}
          </div>
        </AdminPanelShell>
        </>
      )}

      <AlertDialog
        open={Boolean(confirmSend)}
        onOpenChange={(open) => {
          if (!open && !sending) setConfirmSend(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Send this mass message?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Please confirm the audience before sending. This cannot be undone without retracting later.</p>
                <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2 text-foreground">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Subject</p>
                    <p className="font-medium">{confirmSend?.subject}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Audience</p>
                    <p>{confirmSend?.audienceText}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Zip codes</p>
                    <p>{confirmSend?.zipText}</p>
                  </div>
                  {confirmSend?.actionLabel ? (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Action button</p>
                      <p>{confirmSend.actionLabel}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={sending}>Cancel</AlertDialogCancel>
            <Button
              className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
              disabled={sending}
              onClick={handleConfirmSend}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Confirm & send
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
