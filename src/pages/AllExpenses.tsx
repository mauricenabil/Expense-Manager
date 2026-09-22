import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Download, Filter, Trash, RotateCcw, XCircle, X, Columns3 } from "lucide-react";
import { useDropdown } from "../lib/useDropdown";
import type { ExpenseWithDetails } from "../types";
import EditExpenseModal from "../components/EditExpenseModal";
import { useDataStore } from "../store/DataStore";
import DropdownPortal from "../components/DropdownPortal";
import { useConfirm } from "../components/ConfirmDialog";
import { deriveExpenseIdFromUuid, isValidExpenseId } from "../lib/expenseId";

const PAGE_SIZE_STORAGE_KEY = "expense-manager-page-size";

type QuickFilter = "all" | "today" | "week" | "month" | "year" | "custom";
type SortKey = "date" | "amount" | "name";
type ColumnKey = "id" | "name" | "date" | "category" | "payment" | "amount";

const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "id", label: "Expense ID" },
  { key: "name", label: "Name" },
  { key: "date", label: "Date" },
  { key: "category", label: "Category" },
  { key: "payment", label: "Payment" },
  { key: "amount", label: "Amount" },
];

/** يعرض الـ Expense ID: لو الـ id الحقيقي مستورد بالفعل بصيغة EXP- الصحيحة نعرضه كما هو،
 *  وإلا (سجلات قديمة بـ UUID داخلي) نشتق صيغة عرض ثابتة من نفس الـ UUID بدون تغييره فعلياً */
function shortExpenseId(expense: ExpenseWithDetails): string {
  if (isValidExpenseId(expense.id)) return expense.id;
  return deriveExpenseIdFromUuid(expense.id, expense.date);
}

export default function AllExpenses() {
  const { expenses, deletedExpenses, categories, paymentMethods: methods, tags, restoreExpense, permanentlyDeleteExpense } = useDataStore();
  const confirmDialog = useConfirm();
  const [showRecycleBin, setShowRecycleBin] = useState(false);

  const [searchBox, setSearchBox] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = Number(localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
    return [10, 25, 50, 100].includes(saved) ? saved : 10;
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<ExpenseWithDetails | null>(null);

  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set<ColumnKey>(["name", "date", "category", "payment", "amount"])
  );
  const columnPicker = useDropdown<HTMLButtonElement>();

  const handleRestore = async (id: string) => { await restoreExpense(id); };
  const handlePermanentDelete = async (id: string) => {
    if (!(await confirmDialog({ message: "Permanently delete this expense? This cannot be undone.", danger: true, confirmLabel: "Delete Forever" }))) return;
    await permanentlyDeleteExpense(id);
  };


  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
  }, [pageSize]);

  const inQuickRange = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    if (quickFilter === "today") return date === now.toISOString().slice(0, 10);
    if (quickFilter === "week") { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w; }
    if (quickFilter === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (quickFilter === "year") return d.getFullYear() === now.getFullYear();
    if (quickFilter === "custom") {
      if (customFrom && date < customFrom) return false;
      if (customTo && date > customTo) return false;
      return true;
    }
    return true;
  };

  const filtered = useMemo(() => {
    let result = expenses.filter((e) => inQuickRange(e.date));
    if (categoryFilter) result = result.filter((e) => e.category_id === categoryFilter);
    if (methodFilter) result = result.filter((e) => e.payment_method_id === methodFilter);
    if (searchBox.trim()) {
      const kw = searchBox.trim().toLowerCase();
      result = result.filter((e) => `${e.name} ${e.description ?? ""}`.toLowerCase().includes(kw));
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.date.localeCompare(b.date);
      else if (sortKey === "amount") cmp = a.amount - b.amount;
      else cmp = a.name.localeCompare(b.name);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [expenses, quickFilter, customFrom, customTo, categoryFilter, methodFilter, searchBox, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalAmount = filtered.reduce((s, e) => s + e.amount, 0);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const toggleSelect = (id: string) => {
    setSelected((s) => { const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((cols) => {
      const next = new Set(cols);
      if (next.has(key)) { if (next.size > 1) next.delete(key); } else next.add(key);
      return next;
    });
  };

  const clearAllFilters = () => {
    setSearchBox(""); setQuickFilter("all"); setCustomFrom(""); setCustomTo("");
    setCategoryFilter(""); setMethodFilter(""); setPage(1);
  };
  const hasActiveFilters = searchBox || quickFilter !== "all" || categoryFilter || methodFilter;

  const exportSelected = () => {
    const rows = filtered.filter((e) => selected.size === 0 || selected.has(e.id));
    const header = "Expense ID,Name,Date,Amount (EGP),Category,Payment Method,Notes";
    const csv = [
      header,
      ...rows.map((r) =>
        [shortExpenseId(r), r.name, r.date, r.amount, r.category_name ?? "", r.payment_method_name ?? "", (r.description ?? "").replace(/,/g, ";")]
          .map((v) => `"${v}"`).join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `expenses_export_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} EGP`;


  if (showRecycleBin) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ marginTop: 0 }}>Recycle Bin</h1>
          <button onClick={() => setShowRecycleBin(false)} style={secondaryBtnStyle}>Back to All Expenses</button>
        </div>
        <p className="text-muted" style={{ marginBottom: 16 }}>Deleted expenses stay here until you restore or permanently delete them.</p>
        {deletedExpenses.length === 0 && <p className="text-muted">Recycle Bin is empty.</p>}
        {deletedExpenses.map((e) => (
          <div key={e.id} className="card" style={{ marginBottom: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div dir="auto" className="bidi-auto" style={{ fontWeight: 600 }}>{e.name}</div>
              <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))" }}><span className="num">{e.date} · {fmt(e.amount)}</span> {e.category_name ? `· ${e.category_name}` : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => handleRestore(e.id)} style={secondaryBtnStyle}><RotateCcw size={14} /> Restore</button>
              <button onClick={() => handlePermanentDelete(e.id)} style={{ ...secondaryBtnStyle, color: "var(--danger)", borderColor: "var(--danger)" }}>
                <XCircle size={14} /> Delete Forever
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ marginTop: 0 }}>All Expenses</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowRecycleBin(true)} style={secondaryBtnStyle}>
            <Trash size={15} /> Recycle Bin {deletedExpenses.length > 0 ? `(${deletedExpenses.length})` : ""}
          </button>
          <button onClick={exportSelected} style={primaryBtnStyle}>
            <Download size={15} /> Export {selected.size > 0 ? `(${selected.size})` : "CSV"}
          </button>
        </div>
      </div>

      {/* Quick Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {(["all", "today", "week", "month", "year", "custom"] as QuickFilter[]).map((f) => (
          <button key={f} onClick={() => { setQuickFilter(f); setPage(1); }} style={{ ...chipStyle, ...(quickFilter === f ? chipActiveStyle : {}) }}>
            {f === "all" ? "All Time" : f === "today" ? "Today" : f === "week" ? "This Week" : f === "month" ? "This Month" : f === "year" ? "This Year" : "Custom Range"}
          </button>
        ))}
        {quickFilter === "custom" && (
          <>
            <input type="date" style={smallInputStyle} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span className="text-muted" style={{ fontSize: "calc(13px * var(--app-font-scale, 1))", alignSelf: "center" }}>to</span>
            <input type="date" style={smallInputStyle} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </>
        )}
      </div>

      {/* Search box + Category / Payment Filters + Clear + Columns */}
      <div className="card" style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Filter size={16} color="var(--text-muted)" />
        <input dir="auto"
          placeholder="Quick search..." style={{ ...smallInputStyle, flex: "1 1 160px" }}
          value={searchBox} onChange={(e) => { setSearchBox(e.target.value); setPage(1); }}
        />
        <select style={smallInputStyle} value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select style={smallInputStyle} value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}>
          <option value="">All Payment Methods</option>
          {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        {hasActiveFilters && (
          <button onClick={clearAllFilters} style={secondaryBtnStyle}><X size={14} /> Clear Filters</button>
        )}

        <div>
          <button ref={columnPicker.triggerRef} onClick={columnPicker.toggle} style={secondaryBtnStyle}>
            <Columns3 size={14} /> Columns
          </button>
          <DropdownPortal anchorRef={columnPicker.triggerRef} menuRef={columnPicker.menuRef} open={columnPicker.open} width={180}>
            <div className="card" style={{ padding: 12 }}>
              {ALL_COLUMNS.map((c) => (
                <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: "calc(13px * var(--app-font-scale, 1))", cursor: "pointer" }}>
                  <input type="checkbox" checked={visibleColumns.has(c.key)} onChange={() => toggleColumn(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          </DropdownPortal>
        </div>

        <span className="text-muted" style={{ marginLeft: "auto", fontSize: "calc(13px * var(--app-font-scale, 1))", whiteSpace: "nowrap" }}>
          <span className="num">{filtered.length}</span> results · Total: <strong className="num" style={{ color: "var(--text)" }}>{fmt(totalAmount)}</strong>
        </span>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={thStyle}><input type="checkbox" onChange={(e) => setSelected(e.target.checked ? new Set(pageData.map((d) => d.id)) : new Set())} /></th>
              {visibleColumns.has("id") && <th style={thStyle}>Expense ID</th>}
              {visibleColumns.has("name") && <th style={thStyle} onClick={() => toggleSort("name")}>Name {sortKey === "name" && (sortDir === "asc" ? "↑" : "↓")}</th>}
              {visibleColumns.has("date") && <th style={thStyle} onClick={() => toggleSort("date")}>Date {sortKey === "date" && (sortDir === "asc" ? "↑" : "↓")}</th>}
              {visibleColumns.has("category") && <th style={thStyle}>Category</th>}
              {visibleColumns.has("payment") && <th style={thStyle}>Payment</th>}
              {visibleColumns.has("amount") && <th style={thStyle} onClick={() => toggleSort("amount")}>Amount {sortKey === "amount" && (sortDir === "asc" ? "↑" : "↓")}</th>}
            </tr>
          </thead>
          <tbody>
            {pageData.map((e) => (
              <tr key={e.id} onDoubleClick={() => setEditing(e)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                <td style={tdStyle}><input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)} /></td>
                {visibleColumns.has("id") && <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "calc(11px * var(--app-font-scale, 1))" }} className="text-muted">{shortExpenseId(e)}</td>}
                {visibleColumns.has("name") && (
                  <td dir="auto" className="bidi-auto" style={tdStyle}>
                    <span>{e.name}</span>
                    {(e.tag_ids?.length ?? 0) > 0 && (
                      <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4, marginInlineStart: 8 }}>
                        {e.tag_ids!.map((tid) => {
                          const tag = tags.find((t) => t.id === tid);
                          return tag ? (
                            <span key={tid} dir="auto" className="bidi-auto" style={tagChipStyle}>{tag.name}</span>
                          ) : null;
                        })}
                      </span>
                    )}
                  </td>
                )}
                {visibleColumns.has("date") && <td style={tdStyle} className="text-muted">{e.date}</td>}
                {visibleColumns.has("category") && (
                  <td style={tdStyle}>
                    {e.category_name && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.category_color || "var(--accent)" }} />
                        {e.category_name}
                      </span>
                    )}
                  </td>
                )}
                {visibleColumns.has("payment") && <td style={tdStyle} className="text-muted">{e.payment_method_name}</td>}
                {visibleColumns.has("amount") && <td style={{ ...tdStyle, fontWeight: 600 }}><span className="num">{fmt(e.amount)}</span></td>}
              </tr>
            ))}
            {pageData.length === 0 && (
              <tr><td colSpan={visibleColumns.size + 1} style={{ ...tdStyle, textAlign: "center" }} className="text-muted">No expenses found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", margin: "10px 0" }}>Double-click a row to edit.</div>

      {/* Pagination + Rows per page */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16 }}>
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={secondaryBtnStyle}>Previous</button>
        <span style={{ padding: "8px 14px", fontSize: "calc(13px * var(--app-font-scale, 1))" }} className="text-muted">Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={secondaryBtnStyle}>Next</button>
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          style={{ ...smallInputStyle, marginLeft: 12 }}
        >
          {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
      </div>

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

const tagChipStyle: CSSProperties = {
  display: "inline-block", padding: "1px 8px", borderRadius: 99,
  background: "var(--accent-soft)", color: "var(--accent)",
  fontSize: "calc(10.5px * var(--app-font-scale, 1))", fontWeight: 700, lineHeight: 1.7, whiteSpace: "nowrap",
};

const thStyle: CSSProperties = { textAlign: "left", padding: "12px 14px", fontSize: "calc(12px * var(--app-font-scale, 1))", color: "var(--text-muted)", cursor: "pointer", userSelect: "none" };
const tdStyle: CSSProperties = { padding: "12px 14px", fontSize: "calc(13px * var(--app-font-scale, 1))" };
const smallInputStyle: CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-hover)", color: "var(--text)", fontSize: "calc(13px * var(--app-font-scale, 1))" };
const chipStyle: CSSProperties = { padding: "7px 14px", borderRadius: 20, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", fontSize: "calc(13px * var(--app-font-scale, 1))", cursor: "pointer" };
const chipActiveStyle: CSSProperties = { background: "var(--accent)", color: "var(--on-accent)", borderColor: "var(--accent)" };
const primaryBtnStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "var(--on-accent)", fontWeight: 600, fontSize: "calc(14px * var(--app-font-scale, 1))", cursor: "pointer" };
const secondaryBtnStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-hover)", color: "var(--text)", fontSize: "calc(13px * var(--app-font-scale, 1))", cursor: "pointer" };
