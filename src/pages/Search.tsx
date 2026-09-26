import { useMemo, useState, type CSSProperties } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import type { ExpenseWithDetails } from "../types";
import EditExpenseModal from "../components/EditExpenseModal";
import { useDataStore } from "../store/DataStore";

type DateMode = "exact" | "range";

export default function Search() {
  const { expenses, categories, paymentMethods: methods } = useDataStore();
  const [editing, setEditing] = useState<ExpenseWithDetails | null>(null);

  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [methodId, setMethodId] = useState("");

  const [dateMode, setDateMode] = useState<DateMode>("range");
  const [exactDate, setExactDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const results = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return expenses.filter((e) => {
      if (kw) {
        const haystack = `${e.name} ${e.description ?? ""} ${e.category_name ?? ""} ${e.payment_method_name ?? ""}`.toLowerCase();
        if (!haystack.includes(kw)) return false;
      }
      if (categoryId && e.category_id !== categoryId) return false;
      if (methodId && e.payment_method_id !== methodId) return false;

      if (dateMode === "exact") {
        if (exactDate && e.date !== exactDate) return false;
      } else {
        if (dateFrom && e.date < dateFrom) return false;
        if (dateTo && e.date > dateTo) return false;
      }
      return true;
    });
  }, [expenses, keyword, categoryId, methodId, dateMode, exactDate, dateFrom, dateTo]);

  const totalAmount = results.reduce((s, e) => s + e.amount, 0);
  const fmt = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} EGP`;

  const clearFilters = () => {
    setKeyword(""); setCategoryId(""); setMethodId(""); setExactDate(""); setDateFrom(""); setDateTo("");
  };

  const hasActiveFilters = keyword || categoryId || methodId || exactDate || dateFrom || dateTo;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Search</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <SearchIcon size={18} color="var(--text-muted)" />
          <input dir="auto"
            autoFocus
            placeholder="Search by name, notes, category, or payment method..."
            style={inputStyle}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <select style={inputStyle} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select style={inputStyle} value={methodId} onChange={(e) => setMethodId(e.target.value)}>
            <option value="">All Payment Methods</option>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        {/* Date Mode Switch: Exact Date vs Date Range */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={dateModeSwitchStyle}>
            <button
              onClick={() => setDateMode("exact")}
              style={{ ...dateModeBtnStyle, ...(dateMode === "exact" ? dateModeBtnActiveStyle : {}) }}
            >
              Exact Date
            </button>
            <button
              onClick={() => setDateMode("range")}
              style={{ ...dateModeBtnStyle, ...(dateMode === "range" ? dateModeBtnActiveStyle : {}) }}
            >
              Date Range
            </button>
          </div>

          {dateMode === "exact" ? (
            <input type="date" style={{ ...inputStyle, flex: "0 0 200px" }} value={exactDate} onChange={(e) => setExactDate(e.target.value)} />
          ) : (
            <>
              <input type="date" style={{ ...inputStyle, flex: "0 0 180px" }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="From" />
              <span className="text-muted" style={{ fontSize: "calc(13px * var(--app-font-scale, 1))" }}>to</span>
              <input type="date" style={{ ...inputStyle, flex: "0 0 180px" }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="To" />
            </>
          )}
        </div>

        {hasActiveFilters && (
          <button onClick={clearFilters} style={{ ...clearBtnStyle, marginTop: 12 }}>
            <X size={13} /> Clear Filters
          </button>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span className="text-muted" style={{ fontSize: "calc(14px * var(--app-font-scale, 1))" }}>
          <strong className="num" style={{ color: "var(--text)" }}>{results.length}</strong> results
        </span>
        <span className="text-muted" style={{ fontSize: "calc(14px * var(--app-font-scale, 1))" }}>
          Total: <strong className="num" style={{ color: "var(--accent)" }}>{fmt(totalAmount)}</strong>
        </span>
      </div>

      {results.map((e) => (
        <div
          key={e.id}
          className="card"
          onDoubleClick={() => setEditing(e)}
          style={{ marginBottom: 8, padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between" }}
        >
          <div>
            <div dir="auto" className="bidi-auto" style={{ fontWeight: 600 }}>{e.name}</div>
            <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", marginTop: 3 }}>
              {e.date} {e.category_name ? `· ${e.category_name}` : ""} {e.payment_method_name ? `· ${e.payment_method_name}` : ""}
            </div>
          </div>
          <div className="num" style={{ fontWeight: 700, color: "var(--accent)" }}>{fmt(e.amount)}</div>
        </div>
      ))}
      {results.length === 0 && <p className="text-muted">No results found. Try adjusting your filters.</p>}

      <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", marginTop: 10 }}>Double-click a result to edit.</div>

      {editing && (
        <EditExpenseModal
          expense={editing}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
          onDeleted={() => setEditing(null)}
        />
      )}
    </div>
  );
}

const inputStyle: CSSProperties = {
  flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface-hover)", color: "var(--text)", fontSize: "calc(14px * var(--app-font-scale, 1))", outline: "none",
};

const clearBtnStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
  border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)",
  fontSize: "calc(12px * var(--app-font-scale, 1))", cursor: "pointer",
};

const dateModeSwitchStyle: CSSProperties = {
  display: "flex", padding: 3, borderRadius: 8, background: "var(--surface-hover)", border: "1px solid var(--border)",
};

const dateModeBtnStyle: CSSProperties = {
  padding: "6px 12px", borderRadius: 6, border: "none", background: "transparent",
  color: "var(--text-muted)", fontSize: "calc(12px * var(--app-font-scale, 1))", cursor: "pointer", fontWeight: 600,
};

const dateModeBtnActiveStyle: CSSProperties = { background: "var(--accent)", color: "var(--on-accent)" };
