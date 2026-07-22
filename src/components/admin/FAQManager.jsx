import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Pencil, Trash2, X, Check, ChevronUp, ChevronDown, HelpCircle } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { AdminButton } from "@/components/admin/AdminButton";

function EditForm({ form, setForm, onSave, onCancel, saving, isNew }) {
  return (
    <div className="space-y-3">
      <h3 className="font-heading font-semibold text-sm">{isNew ? "New FAQ" : "Edit FAQ"}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Label className="text-xs">Question *</Label>
          <Input
            value={form.question}
            onChange={(e) => setForm(p => ({ ...p, question: e.target.value }))}
            className="rounded-lg mt-1"
            placeholder="e.g. How do I post an activity?"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Answer *</Label>
          <textarea
            value={form.answer}
            onChange={(e) => setForm(p => ({ ...p, answer: e.target.value }))}
            rows={3}
            className="w-full mt-1 rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Provide a clear, helpful answer..."
          />
        </div>
        <div>
          <Label className="text-xs">Category *</Label>
          <Input
            value={form.category}
            onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))}
            className="rounded-lg mt-1"
            placeholder="e.g. Posting Activities"
          />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <select
            value={form.status}
            onChange={(e) => setForm(p => ({ ...p, status: e.target.value }))}
            className="w-full mt-1 rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="active">Active (visible)</option>
            <option value="hidden">Hidden</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={onSave} disabled={saving}>
          <Check className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save"}
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={onCancel} disabled={saving}>
          <X className="w-4 h-4 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

const EMPTY_FORM = { question: "", answer: "", category: "", status: "active" };

const COLOR_PALETTE = [
  { bg: "#E0F7F2", text: "#1F5C2E" },
  { bg: "#FCEBDD", text: "#B36D25" },
  { bg: "#FFF3E0", text: "#E65100" },
  { bg: "#FCE4EC", text: "#C2185B" },
  { bg: "#FFEBEE", text: "#D32F2F" },
  { bg: "#E3F2FD", text: "#1565C0" },
  { bg: "#F3E5F5", text: "#6A1B9A" },
  { bg: "#E8F5E9", text: "#2D7A3E" },
];

const categoryColorCache = {};
let categoryColorIndex = 0;

const getCategoryColor = (category) => {
  if (!categoryColorCache[category]) {
    categoryColorCache[category] = COLOR_PALETTE[categoryColorIndex % COLOR_PALETTE.length];
    categoryColorIndex++;
  }
  return categoryColorCache[category];
};

export default function FAQManagerV2() {
  const { toast } = useToast();
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null); // faq id or "new"
  const [form, setForm] = useState(EMPTY_FORM);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.FAQ.list("sort_order", 200);
      setFaqs(data);
    } catch {
      setFaqs([]);
    }
    setLoading(false);
  };

  const sortedFaqs = [...faqs].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const categories = ["All", ...Array.from(new Set(sortedFaqs.map((f) => f.category).filter(Boolean)))];
  const filtered = categoryFilter === "All" ? sortedFaqs : sortedFaqs.filter((f) => f.category === categoryFilter);

  const startNew = () => {
    setForm(EMPTY_FORM);
    setEditingId("new");
  };

  const startEdit = (faq) => {
    setForm({
      question: faq.question || "",
      answer: faq.answer || "",
      category: faq.category || "",
      status: faq.status || "active",
    });
    setEditingId(faq.id);
  };

  const cancel = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const save = async () => {
    if (!form.question.trim() || !form.answer.trim() || !form.category.trim()) {
      toast({ title: "Question, answer, and category are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingId === "new") {
        const maxOrder = faqs.length > 0 ? Math.max(...faqs.map(f => f.sort_order || 0)) + 1 : 0;
        await base44.entities.FAQ.create({ ...form, sort_order: maxOrder });
        toast({ title: "FAQ added!" });
      } else {
        await base44.entities.FAQ.update(editingId, {
          question: form.question,
          answer: form.answer,
          category: form.category,
          status: form.status,
        });
        toast({ title: "FAQ updated!" });
      }
      setEditingId(null);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      toast({ title: "Failed to save FAQ.", description: err?.message || "Unknown error", variant: "destructive" });
    }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this FAQ?")) return;
    try {
      await base44.entities.FAQ.delete(id);
      toast({ title: "FAQ deleted." });
      if (editingId === id) { setEditingId(null); setForm(EMPTY_FORM); }
      await load();
    } catch {
      toast({ title: "Failed to delete.", variant: "destructive" });
    }
  };

  const toggleStatus = async (faq) => {
    try {
      const newStatus = faq.status === "active" ? "hidden" : "active";
      await base44.entities.FAQ.update(faq.id, { status: newStatus });
      setFaqs(prev => prev.map(f => f.id === faq.id ? { ...f, status: newStatus } : f));
    } catch {
      toast({ title: "Failed to update status.", variant: "destructive" });
    }
  };

  const moveItem = async (faqA, idxA, faqB, idxB) => {
    // Use positional indices as the new sort_orders to avoid duplicate value issues
    setFaqs(prev => prev.map(f => {
      if (f.id === faqA.id) return { ...f, sort_order: idxB };
      if (f.id === faqB.id) return { ...f, sort_order: idxA };
      return f;
    }));
    try {
      await Promise.all([
        base44.entities.FAQ.update(faqA.id, { sort_order: idxB }),
        base44.entities.FAQ.update(faqB.id, { sort_order: idxA }),
      ]);
    } catch {
      toast({ title: "Failed to reorder.", variant: "destructive" });
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-semibold text-lg">FAQ Manager</h2>
        {editingId !== "new" && (
          <Button size="sm" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={startNew}>
            <Plus className="w-4 h-4 mr-1" /> Add FAQ
          </Button>
        )}
      </div>

      {/* Add New Form (only shown when editingId === "new") */}
      {editingId === "new" && (
        <EditForm form={form} setForm={setForm} onSave={save} onCancel={cancel} saving={saving} isNew={true} />
      )}

      {/* Category Filter */}
      {faqs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                categoryFilter === cat
                  ? "bg-mint-500 text-white border-mint-500"
                  : "bg-white text-muted-foreground border-border hover:border-mint-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* FAQ List */}
      {loading ? (
        <LoadingState text="Loading FAQs..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="No FAQs Yet"
          description="Create your first FAQ to help answer common questions."
          actionLabel="Add FAQ"
          onAction={startNew}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((faq, idx) => (
            <div
              key={faq.id}
              className={`border rounded-xl overflow-hidden bg-white transition-all ${faq.status === "hidden" ? "opacity-50" : ""} ${editingId === faq.id ? "border-mint-300 ring-1 ring-mint-300" : "border-border"}`}
            >
              {/* Inline edit form */}
              {editingId === faq.id && (
                <div className="p-4 bg-muted/30 border-b border-border">
                  <EditForm form={form} setForm={setForm} onSave={save} onCancel={cancel} saving={saving} isNew={false} />
                </div>
              )}
              {/* Row content */}
              <div className="p-4 flex items-start gap-3">
                <div className="flex flex-col gap-0.5 pt-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => idx > 0 && moveItem(faq, idx, filtered[idx - 1], idx - 1)}
                    disabled={idx === 0}
                    className="w-5 h-5 rounded flex items-center justify-center hover:bg-accent disabled:opacity-20 transition-colors"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => idx < filtered.length - 1 && moveItem(faq, idx, filtered[idx + 1], idx + 1)}
                    disabled={idx === filtered.length - 1}
                    className="w-5 h-5 rounded flex items-center justify-center hover:bg-accent disabled:opacity-20 transition-colors"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: getCategoryColor(faq.category).bg, color: getCategoryColor(faq.category).text }}
                    >
                      {faq.category}
                    </span>
                    {faq.status === "hidden" && <span className="text-xs text-muted-foreground italic">hidden</span>}
                  </div>
                  <p className="text-sm font-medium text-foreground">{faq.question}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{faq.answer}</p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-accent transition-colors text-xs"
                    onClick={() => toggleStatus(faq)}
                    title={faq.status === "active" ? "Hide" : "Show"}
                  >
                    {faq.status === "active" ? "👁" : "🙈"}
                  </button>
                  <button
                    type="button"
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
                    onClick={() => startEdit(faq)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-accent transition-colors text-destructive"
                    onClick={() => remove(faq.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}