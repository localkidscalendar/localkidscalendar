import React from "react";
import { Button } from "@/components/ui/button";
import { Check, MessageSquare, Trash2, Undo2 } from "lucide-react";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import AdminPanelShell from "@/components/admin/AdminPanelShell";
import AdminSubNav from "@/components/admin/AdminSubNav";
import Paginator, { PAGE_SIZE } from "@/components/admin/Paginator";
import { formatPhoneDisplay } from "@/lib/phone";
import { MESSAGE_TYPE_BOXES } from "@/components/admin/adminPageConstants";
import {
  formatMessageSubmittedAt,
  isMessageAddressed,
  isMessageDeleted,
  messagesForTypeBox,
} from "@/components/admin/adminPageHelpers";

export default function AdminContactTab({ ctx }) {
  const { contactSectionNav, contactSection, setContactSection, contactPage, setContactPage, messages, toggleMessageAddressed, softDeleteMessage, restoreMessage } = ctx;
  return (
    <>
      <AdminSubNav
        sections={contactSectionNav}
        value={contactSection}
        onChange={setContactSection}
        label="Contact Us sections"
      />

      {MESSAGE_TYPE_BOXES.filter((box) => box.id === contactSection).map((box) => {
        const boxMessages = messagesForTypeBox(messages, box);
        const paginatedMessages = boxMessages.slice(
          (contactPage - 1) * PAGE_SIZE,
          contactPage * PAGE_SIZE
        );
        return (
          <React.Fragment key={box.id}>
            <AdminSectionHeader title={box.title} icon={MessageSquare} />
            <AdminPanelShell>
              {boxMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">No messages</p>
              ) : (
                <div className="space-y-3">
                  {paginatedMessages.map((m) => {
                    const addressed = isMessageAddressed(m);
                    return (
                      <div
                        key={m.id}
                        className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-start gap-3 shadow-sm ${
                          addressed ? "border-border bg-white" : "border-mint-200 bg-mint-50/50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-sm">{m.sender_name}</span>
                            <span className="text-xs text-muted-foreground">{m.sender_email}</span>
                            {m.sender_phone && (
                              <span className="text-xs text-muted-foreground">· {formatPhoneDisplay(m.sender_phone)}</span>
                            )}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatMessageSubmittedAt(m.created_date)}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${addressed ? "text-mint-500" : "text-muted-foreground"}`}
                            title={addressed ? "Mark as not addressed" : "Mark as addressed"}
                            onClick={() => toggleMessageAddressed(m)}
                          >
                            <Check className="w-4 h-4" strokeWidth={addressed ? 3 : 2} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            title="Delete message"
                            onClick={() => softDeleteMessage(m)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <Paginator total={boxMessages.length} page={contactPage} onPage={setContactPage} />
                </div>
              )}
            </AdminPanelShell>
          </React.Fragment>
        );
      })}

      {contactSection === "messages-deleted" && (() => {
        const deletedMessages = messages.filter(isMessageDeleted);
        const paginatedDeleted = deletedMessages.slice(
          (contactPage - 1) * PAGE_SIZE,
          contactPage * PAGE_SIZE
        );
        return (
          <>
            <AdminSectionHeader title="Deleted Messages" icon={Trash2} />
            <AdminPanelShell>
              {deletedMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">No deleted messages</p>
              ) : (
                <div className="space-y-3">
                  {paginatedDeleted.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-border bg-white p-4 flex flex-col sm:flex-row sm:items-start gap-3 shadow-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm">{m.sender_name}</span>
                          <span className="text-xs text-muted-foreground">{m.sender_email}</span>
                          {m.sender_phone && (
                            <span className="text-xs text-muted-foreground">· {formatPhoneDisplay(m.sender_phone)}</span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">{m.subject}</p>
                        <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatMessageSubmittedAt(m.created_date)}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          title="Restore message"
                          onClick={() => restoreMessage(m)}
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Paginator total={deletedMessages.length} page={contactPage} onPage={setContactPage} />
                </div>
              )}
            </AdminPanelShell>
          </>
        );
      })()}
    </>
  );
}
