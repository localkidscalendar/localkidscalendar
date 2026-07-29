import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import UserNoticeCard from "@/components/account/UserNoticeCard";
import Paginator, { PAGE_SIZE } from "@/components/admin/Paginator";
import {
  fetchUserMessages,
  markMessageRead,
  softDeleteMessage,
  publishUnreadMessagesCount,
} from "@/lib/userMessages";

export default function MyMessagesTab({ user, onUnreadChange }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const syncUnread = (list) => {
    const count = list.filter((m) => !m.read_at).length;
    onUnreadChange?.(count);
    publishUnreadMessagesCount(count);
  };

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await fetchUserMessages(user.id);
    if (error) {
      toast({ title: "Could not load messages", description: error.message, variant: "destructive" });
      setMessages([]);
      syncUnread([]);
      setLoading(false);
      return;
    }
    const list = data || [];
    setMessages(list);
    syncUnread(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(
      (m) =>
        (m.subject || "").toLowerCase().includes(q) ||
        (m.body || "").toLowerCase().includes(q)
    );
  }, [messages, search]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleOpen = async (msg) => {
    if (msg.read_at) return;
    const readAt = new Date().toISOString();
    setMessages((prev) => {
      const next = prev.map((m) => (m.id === msg.id ? { ...m, read_at: readAt } : m));
      syncUnread(next);
      return next;
    });
    const { error } = await markMessageRead(msg.id);
    if (error) {
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === msg.id ? { ...m, read_at: null } : m));
        syncUnread(next);
        return next;
      });
    }
  };

  const handleDelete = async (msg) => {
    if (!window.confirm("Remove this message from your inbox?")) return;
    const { error } = await softDeleteMessage(msg.id);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
      return;
    }
    setMessages((prev) => {
      const next = prev.filter((m) => m.id !== msg.id);
      syncUnread(next);
      return next;
    });
    toast({ title: "Message removed" });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-mint-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search messages…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="rounded-lg h-8 text-sm sm:max-w-xs"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          {search.trim() ? "No messages match your search." : "No messages yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {paginated.map((msg) => (
            <UserNoticeCard
              key={msg.id}
              subject={msg.subject}
              body={msg.body}
              createdAt={msg.created_at}
              unread={!msg.read_at}
              actionLabel={msg.action_label || undefined}
              actionHref={msg.action_href || undefined}
              onOpen={() => handleOpen(msg)}
              onDelete={() => handleDelete(msg)}
            />
          ))}
          <Paginator total={filtered.length} page={page} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
