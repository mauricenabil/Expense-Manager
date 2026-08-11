import { useEffect, useState, type CSSProperties } from "react";
import { X, Zap } from "lucide-react";
import { useDataStore } from "../store/DataStore";

export default function QuickAddModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const { categories, paymentMethods: methods, addExpense } = useDataStore();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (categories.length) setCategoryId(categories[0].id);
      if (methods.length) setPaymentMethodId(methods[0].id);
      setName(""); setAmount("");
    }
  }, [open, categories, methods]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!name.trim() || !amt || amt <= 0) return;
    setSaving(true);
    try {
      await addExpense({
        name: name.trim(), date: new Date().toISOString().slice(0, 10),
        amount: amt, category_id: categoryId || null, payment_method_id: paymentMethodId || null,
      });
      onAdded();
      onClose();
    } finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div className="card modal-in" style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}><Zap size={18} color="var(--accent)" /> Quick Add Expense</h3>
          <button onClick={onClose} style={iconBtnStyle}><X size={16} /></button>
        </div>

        <input
          autoFocus style={inputStyle} placeholder="Expense name" value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <input
            type="number" style={inputStyle} placeholder="Amount (EGP)" value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <select style={inputStyle} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <select style={{ ...inputStyle, marginTop: 10 }} value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
          {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        <button onClick={handleSave} disabled={saving} style={primaryBtnStyle}>
          {saving ? "Saving..." : "Add Expense"}
        </button>
        <p className="text-muted" style={{ fontSize: 11, textAlign: "center", marginTop: 10, marginBottom: 0 }}>
          Press Enter to save quickly · For full options use the Add Expense page
        </p>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: "var(--z-modal)" as unknown as number,
};

const modalStyle: CSSProperties = { width: 380, maxWidth: "90vw" };

const inputStyle: CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface-hover)", color: "var(--text)", fontSize: 14, outline: "none", boxSizing: "border-box",
};

const primaryBtnStyle: CSSProperties = {
  width: "100%", marginTop: 14, padding: "11px", borderRadius: 8, border: "none",
  background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer",
};

const iconBtnStyle: CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface-hover)", color: "var(--text)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};
