import { createPortal } from "react-dom";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { X, Trash2, Save } from "lucide-react";
import type { ExpenseWithDetails } from "../types";
import { useDataStore } from "../store/DataStore";
import { useConfirm } from "./ConfirmDialog";
import TagPicker from "./TagPicker";
import ExpenseNameAutocomplete from "./ExpenseNameAutocomplete";
import { Z } from "../lib/zLayers";

/**
 * Modal تعديل المصروف — مبني بـ React Portal ويُعرض في document.body مباشرة.
 * هذا يضمن ظهوره دائماً فوق كل شيء بغض النظر عن أي stacking context في الصفحة الأم
 * (مثل transform أو filter أو overflow في Search/AllExpenses/Dashboard).
 * هذا هو نفس السبب الذي يُستخدم فيه DropdownPortal لقوائم الـ Dropdown.
 */
export default function EditExpenseModal({
  expense,
  onClose,
  onSaved,
  onDeleted,
}: {
  expense: ExpenseWithDetails;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { categories, paymentMethods: methods, updateExpense, deleteExpense } = useDataStore();
  const confirmDialog = useConfirm();
  const [name, setName] = useState(expense.name);
  const [date, setDate] = useState(expense.date);
  const [amount, setAmount] = useState(String(expense.amount));
  const [categoryId, setCategoryId] = useState(expense.category_id || "");
  const [paymentMethodId, setPaymentMethodId] = useState(expense.payment_method_id || "");
  const [notes, setNotes] = useState(expense.description || "");
  const [tagIds, setTagIds] = useState<string[]>(expense.tag_ids ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateExpense({
        id: expense.id,
        name: name.trim(),
        date,
        amount: parseFloat(amount),
        category_id: categoryId || null,
        payment_method_id: paymentMethodId || null,
        description: notes.trim() || null,
        tag_ids: tagIds,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirmDialog({ message: "Move this expense to Recycle Bin?", danger: true, confirmLabel: "Move to Recycle Bin" }))) return;
    await deleteExpense(expense.id);
    onDeleted();
  };

  // المحتوى يُعرض عبر Portal في document.body مباشرة
  return createPortal(
    <div style={overlayStyle} onClick={onClose}>
      <div className="card modal-in" style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: "calc(18px * var(--app-font-scale, 1))" }}>Edit Expense</h2>
          <button onClick={onClose} style={iconBtnStyle}><X size={16} /></button>
        </div>

        <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: 4 }}>
          <Field label="Name">
            <ExpenseNameAutocomplete style={inputStyle} value={name} onChange={setName} menuZIndex={Z.modalPopover} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Date">
              <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Amount (EGP)">
              <input type="number" step="0.01" style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Category">
              <select style={inputStyle} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">No Category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Payment Method">
              <select style={inputStyle} value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
                <option value="">No Payment Method</option>
                {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Tags">
            <TagPicker value={tagIds} onChange={setTagIds} />
          </Field>
          <Field label="Notes">
            <textarea dir="auto" style={{ ...inputStyle, minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          <button onClick={handleDelete} style={dangerBtnStyle}>
            <Trash2 size={15} /> Delete
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={primaryBtnStyle}>
              <Save size={15} /> {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: "calc(13px * var(--app-font-scale, 1))", fontWeight: 600, display: "block", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: "var(--z-modal)" as unknown as number,
};

const modalStyle: CSSProperties = {
  width: 480, maxWidth: "90vw", maxHeight: "85vh",
};

const inputStyle: CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--surface-hover)",
  color: "var(--text)", fontSize: "calc(14px * var(--app-font-scale, 1))", outline: "none", boxSizing: "border-box",
};

const iconBtnStyle: CSSProperties = {
  background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: 8,
  width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", color: "var(--text)",
};

const primaryBtnStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "10px 18px",
  borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--on-accent)",
  fontWeight: 600, fontSize: "calc(14px * var(--app-font-scale, 1))", cursor: "pointer",
};

const secondaryBtnStyle: CSSProperties = {
  padding: "10px 18px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface-hover)", color: "var(--text)", fontWeight: 600,
  fontSize: "calc(14px * var(--app-font-scale, 1))", cursor: "pointer",
};

const dangerBtnStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "10px 18px",
  borderRadius: 8, border: "1px solid var(--danger)", background: "transparent",
  color: "var(--danger)", fontWeight: 600, fontSize: "calc(14px * var(--app-font-scale, 1))", cursor: "pointer",
};
