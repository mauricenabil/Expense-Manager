import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Save, RotateCcw, Calendar as CalendarIcon } from "lucide-react";
import { useDataStore } from "../store/DataStore";

const today = () => new Date().toISOString().slice(0, 10);

export default function AddExpense() {
  const navigate = useNavigate();
  const { categories, paymentMethods: methods, expenses, addExpense, deleteExpense } = useDataStore();
  const recent = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);

  const [name, setName] = useState("");
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [notes, setNotes] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedToast, setSavedToast] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  // تعيين أول فئة/طريقة دفع كقيمة افتراضية أول ما البيانات تتوفر من الـ Store
  useEffect(() => { if (!categoryId && categories.length) setCategoryId(categories[0].id); }, [categories, categoryId]);
  useEffect(() => { if (!paymentMethodId && methods.length) setPaymentMethodId(methods[0].id); }, [methods, paymentMethodId]);
  useEffect(() => { nameRef.current?.focus(); }, []);


  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Expense name is required.";
    if (!date) e.date = "Date is required.";
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) e.amount = "Enter a valid amount greater than 0.";
    if (!categoryId) e.category = "Please select a category.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const resetForm = () => {
    setName(""); setAmount(""); setNotes(""); setDate(today()); setErrors({});
    nameRef.current?.focus();
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const id = await addExpense({
        name: name.trim(),
        date,
        amount: parseFloat(amount),
        category_id: categoryId || null,
        payment_method_id: paymentMethodId || null,
        description: notes.trim() || null,
      });
      setLastAddedId(id);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = async () => {
    if (!lastAddedId) return;
    await deleteExpense(lastAddedId);
    setLastAddedId(null);
    setSavedToast(false);
  };

  // Keyboard shortcuts: Ctrl+S save, Ctrl+Z undo last add, Esc cancel/reset
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if (e.key === "Escape") {
        resetForm();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const fmt = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} EGP`;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24 }}>
      <div>
        <h1 style={{ marginTop: 0 }}>Add Expense</h1>

        <div className="card">
          <Field label="Expense Name *" error={errors.name}>
            <input
              ref={nameRef}
              style={inputStyle}
              placeholder="e.g. Lunch at restaurant"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Date *" error={errors.date}>
              <div style={{ position: "relative" }}>
                <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
                <CalendarIcon size={15} style={{ position: "absolute", right: 12, top: 12, pointerEvents: "none" }} color="var(--text-muted)" />
              </div>
            </Field>
            <Field label="Amount (EGP) *" error={errors.amount}>
              <input
                type="number"
                step="0.01"
                style={inputStyle}
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Category *" error={errors.category}>
              <select style={inputStyle} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {categories.length === 0 && <option value="">No categories — add one in Settings</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Payment Method">
              <select style={inputStyle} value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
              placeholder="Optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button onClick={handleSave} disabled={saving} style={primaryBtnStyle}>
              <Save size={16} /> {saving ? "Saving..." : "Add Expense"}
            </button>
            <button onClick={resetForm} style={secondaryBtnStyle}>Cancel</button>
          </div>

          <div className="text-muted" style={{ fontSize: 12, marginTop: 14 }}>
            Shortcuts: <strong>Ctrl+S</strong> Save · <strong>Ctrl+Z</strong> Undo last add · <strong>Esc</strong> Cancel
          </div>

          {savedToast && (
            <div
              className="card"
              style={{
                marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "rgba(74,222,128,0.12)", border: "1px solid var(--success)", padding: "10px 14px",
              }}
            >
              <span style={{ color: "var(--success)", fontSize: 13 }}>✓ Expense added successfully</span>
              <button onClick={handleUndo} style={{ ...secondaryBtnStyle, padding: "6px 10px", fontSize: 12 }}>
                <RotateCcw size={13} /> Undo
              </button>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Recent Expenses (Last 7)</h2>
        {recent.length === 0 && <p className="text-muted">No expenses yet.</p>}
        {recent.map((r) => (
          <div key={r.id} className="card" style={{ marginBottom: 8, padding: "10px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</span>
              <span style={{ fontSize: 13, color: "var(--accent)" }}>{fmt(r.amount)}</span>
            </div>
            <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
              {r.date} {r.category_name ? `· ${r.category_name}` : ""}
            </div>
          </div>
        ))}
        <button
          onClick={() => navigate("/expenses")}
          style={{ ...secondaryBtnStyle, width: "100%", marginTop: 8, justifyContent: "center" }}
        >
          View All Expenses
        </button>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{label}</label>
      {children}
      {error && <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--surface-hover)",
  color: "var(--text)", fontSize: 14, outline: "none", boxSizing: "border-box",
};

const primaryBtnStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "11px 20px",
  borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff",
  fontWeight: 600, fontSize: 14, cursor: "pointer",
};

const secondaryBtnStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "11px 20px",
  borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-hover)",
  color: "var(--text)", fontWeight: 600, fontSize: 14, cursor: "pointer",
};
