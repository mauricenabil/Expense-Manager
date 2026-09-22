import { useEffect, useRef, useState, type CSSProperties, type ChangeEvent } from "react";
import {
  Plus, Trash2, Pencil, Check, X, Tag as TagIcon, Download, Upload, Lock, Unlock, AlertTriangle,
  SlidersHorizontal, FolderTree, Layers, CreditCard, Target, Repeat, ShieldCheck, DatabaseBackup, Skull, FileSpreadsheet, Pin, RefreshCw, ArrowUpCircle,
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
} from "lucide-react";
import { api } from "../lib/api";
import { useDropdown } from "../lib/useDropdown";
import DropdownPortal from "../components/DropdownPortal";
import { weekdayLabels } from "../lib/dateRanges";
import { type BackupSchedule, calcNextBackupDate } from "../lib/backupSchedule";
import { useAutoBackup, type BackupFormat, type BackupHistory } from "../lib/useAutoBackup";
import FontSizeSettings from "../components/FontSizeSettings";
import UpdatePanel from "../components/UpdatePanel";
import { useWeekStart } from "../context/WeekStartContext";
import { useAuth } from "../context/AuthContext";
import { useDataStore } from "../store/DataStore";
import { useConfirm } from "../components/ConfirmDialog";
import * as XLSX from "xlsx";
import { generateExpenseId, isValidExpenseId, deriveExpenseIdFromUuid } from "../lib/expenseId";
import type { Category } from "../types";

type SettingsTab = "general" | "categories" | "subcategories" | "payments" | "tags" | "budgets" | "savings" | "recurring" | "security" | "backup" | "update" | "danger";

const TABS: { id: SettingsTab; label: string; icon: any }[] = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "categories", label: "Categories", icon: FolderTree },
  { id: "subcategories", label: "Sub Categories", icon: Layers },
  { id: "payments", label: "Payment Methods", icon: CreditCard },
  { id: "tags", label: "Tags", icon: TagIcon },
  { id: "budgets", label: "Budgets", icon: SlidersHorizontal },
  { id: "savings", label: "Goals", icon: Target },
  { id: "recurring", label: "Recurring", icon: Repeat },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "backup", label: "Backup", icon: DatabaseBackup },
  { id: "update", label: "Update", icon: ArrowUpCircle },
  { id: "danger", label: "Danger Zone", icon: Skull },
];

export default function Settings() {
  const [tab, setTab] = useState<SettingsTab>("general");
  const panelRef = useRef<HTMLDivElement>(null);

  // اللوحة بقت حاوية تمرير مستقلة، فلازم ترجع لأولها عند تبديل التبويب —
  // وإلا التبويب الجديد بيفتح على نص المحتوى.
  useEffect(() => { panelRef.current?.scrollTo({ top: 0 }); }, [tab]);

  return (
    <div className="settings-shell">
      <h1 style={{ marginTop: 0, flexShrink: 0 }}>Settings</h1>

      {/* عمودان داخل ارتفاع منطقة التمرير: التبويبات ثابتة تماماً واللوحة
          وحدها هي اللي بتتمرّر. التفاصيل في .settings-* داخل
          enhancements-2026.css. */}
      <div className="settings-body">
        <nav className="settings-nav">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  borderRadius: 8, border: "none", textAlign: "left", cursor: "pointer",
                  fontSize: "calc(13px * var(--app-font-scale, 1))", fontWeight: 600,
                  color: active ? "var(--on-accent)" : t.id === "danger" ? "var(--danger)" : "var(--text-muted)",
                  background: active ? "var(--accent)" : "transparent",
                  flexShrink: 0,
                }}
              >
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </nav>

        <div className="settings-panel" ref={panelRef}>
          {tab === "general" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <GeneralPanel />
              <FontSizeSettings />
            </div>
          )}
          {tab === "categories" && <CategoriesPanel />}
          {tab === "subcategories" && <SubCategoriesPanel />}
          {tab === "payments" && <PaymentMethodsPanel />}
          {tab === "tags" && <TagsPanel />}
          {tab === "budgets" && <BudgetsPanel />}
          {tab === "savings" && <SavingsGoalsPanel />}
          {tab === "recurring" && <RecurringExpensesPanel />}
          {tab === "security" && <SecurityPanel />}
          {tab === "backup" && <DataToolsPanel />}
          {tab === "update" && <UpdatePanel />}
          {tab === "danger" && <DangerZonePanel />}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   General Panel
   ========================================================= */
function GeneralPanel() {
  const { weekStart, setWeekStart } = useWeekStart();

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>General</h3>
      <p className="text-muted" style={{ fontSize: "calc(13px * var(--app-font-scale, 1))" }}>
        Expense Manager — Personal Edition. Currency: EGP. All data is stored 100% locally on this device,
        no internet connection or cloud account is required.
      </p>
      <p className="text-muted" style={{ fontSize: "calc(13px * var(--app-font-scale, 1))" }}>
        Use the navigation on the left to manage categories, payment methods, budgets, savings goals,
        recurring expenses, security, and backups.
      </p>

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <strong style={{ fontSize: "calc(13px * var(--app-font-scale, 1))" }}>First Day of the Week</strong>
        <p className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", marginTop: 4 }}>
          Affects the Calendar layout and all "This Week" / "Last Week" filters across the app.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {[{ v: 0, label: "Sunday" }, { v: 1, label: "Monday" }, { v: 6, label: "Saturday" }].map((opt) => (
            <button
              key={opt.v}
              onClick={() => setWeekStart(opt.v as 0 | 1 | 6)}
              style={{ ...chipStyle, ...(weekStart === opt.v ? chipActiveStyle : {}) }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Shared row component
   ========================================================= */
function ListRow({
  label,
  sublabel,
  color,
  onEdit,
  onDelete,
  pinned,
  onTogglePin,
}: {
  label: string;
  sublabel?: string;
  color?: string | null;
  onEdit: () => void;
  onDelete: () => void;
  pinned?: boolean;
  onTogglePin?: () => void;
}) {
  return (
    <div
      className="card"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {color && (
          <span style={{ width: 12, height: 12, borderRadius: 4, background: color, display: "inline-block" }} />
        )}
        <div>
          <div style={{ fontWeight: 600 }}>{label}</div>
          {sublabel && <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))" }}>{sublabel}</div>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {onTogglePin && (
          <button
            onClick={onTogglePin}
            style={{ ...iconBtnStyle, color: pinned ? "var(--accent)" : "var(--text-muted)", borderColor: pinned ? "var(--accent)" : "var(--border)" }}
            title={pinned ? "Unpin from Sidebar" : "Pin to Sidebar"}
          >
            <Pin size={15} fill={pinned ? "var(--accent)" : "none"} />
          </button>
        )}
        <button onClick={onEdit} style={iconBtnStyle}>
          <Pencil size={15} />
        </button>
        <button onClick={onDelete} style={{ ...iconBtnStyle, color: "var(--danger)" }}>
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

const iconBtnStyle: CSSProperties = {
  background: "var(--surface-hover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "var(--text)",
};

const inputStyle: CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-hover)",
  color: "var(--text)",
  fontSize: "calc(14px * var(--app-font-scale, 1))",
  outline: "none",
};

/* لوحة ألوان الفئات — من هوية 2026 (تُحفظ في قاعدة البيانات كـ hex حقيقي) */
const COLOR_PALETTE = [
  "#2E8B74", "#ED6F50", "#D6A032", "#5B8FD9",
  "#A46FB0", "#D4564A", "#3FA9A0", "#8A93A6",
];

/* =========================================================
   Categories Panel
   ========================================================= */
function CategoriesPanel() {
  const { categories, createCategory, updateCategory, deleteCategory } = useDataStore();
  const confirmDialog = useConfirm();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reset = () => { setName(""); setColor(COLOR_PALETTE[0]); setEditingId(null); };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (editingId) {
      await updateCategory(editingId, name.trim(), undefined, color);
    } else {
      await createCategory(name.trim(), undefined, color);
    }
    reset();
  };

  const handleEdit = (c: Category) => {
    setEditingId(c.id);
    setName(c.name);
    setColor(c.color || COLOR_PALETTE[0]);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ message: "Delete this category? Existing expenses will keep their historical reference.", danger: true, confirmLabel: "Delete Category" }))) return;
    await deleteCategory(id);
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input dir="auto"
            style={inputStyle}
            placeholder="Category name (e.g. Groceries)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <button onClick={handleSubmit} style={primaryBtnStyle}>
            {editingId ? <Check size={16} /> : <Plus size={16} />}
            {editingId ? "Save" : "Add"}
          </button>
          {editingId && (
            <button onClick={reset} style={iconBtnStyle}>
              <X size={15} />
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {COLOR_PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer",
                border: color === c ? "2px solid var(--text)" : "2px solid transparent",
              }}
            />
          ))}
        </div>
      </div>

      {categories.length === 0 && <p className="text-muted">No categories yet.</p>}
      {categories.map((c) => (
        <ListRow
          key={c.id}
          label={c.name}
          color={c.color}
          onEdit={() => handleEdit(c)}
          onDelete={() => handleDelete(c.id)}
        />
      ))}
    </div>
  );
}

const primaryBtnStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  padding: "10px 16px", borderRadius: 8, border: "none",
  background: "var(--accent)", color: "var(--on-accent)", fontWeight: 600,
  fontSize: "calc(14px * var(--app-font-scale, 1))", cursor: "pointer", whiteSpace: "nowrap",
};

/* =========================================================
   Sub Categories Panel
   ========================================================= */
function SubCategoriesPanel() {
  const { subCategories, categories, createSubCategory, updateSubCategory, deleteSubCategory } = useDataStore();
  const confirmDialog = useConfirm();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { if (!categoryId && categories.length) setCategoryId(categories[0].id); }, [categories, categoryId]);

  const reset = () => { setName(""); setEditingId(null); };

  const handleSubmit = async () => {
    if (!name.trim() || !categoryId) return;
    if (editingId) {
      await updateSubCategory(editingId, name.trim());
    } else {
      await createSubCategory(categoryId, name.trim());
    }
    reset();
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ message: "Delete this sub-category?", danger: true, confirmLabel: "Delete" }))) return;
    await deleteSubCategory(id);
  };

  if (categories.length === 0) {
    return <p className="text-muted">Create at least one category first.</p>;
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          style={{ ...inputStyle, flex: "0 0 180px" }}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input dir="auto"
          style={inputStyle}
          placeholder="Sub-category name (e.g. Coffee Shops)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <button onClick={handleSubmit} style={primaryBtnStyle}>
          {editingId ? <Check size={16} /> : <Plus size={16} />}
          {editingId ? "Save" : "Add"}
        </button>
        {editingId && (
          <button onClick={reset} style={iconBtnStyle}><X size={15} /></button>
        )}
      </div>

      {subCategories.length === 0 && <p className="text-muted">No sub-categories yet.</p>}
      {subCategories.map((sc) => (
        <ListRow
          key={sc.id}
          label={sc.name}
          sublabel={categories.find((c) => c.id === sc.category_id)?.name}
          onEdit={() => { setEditingId(sc.id); setName(sc.name); setCategoryId(sc.category_id); }}
          onDelete={() => handleDelete(sc.id)}
        />
      ))}
    </div>
  );
}

/* =========================================================
   Payment Methods Panel
   ========================================================= */
function PaymentMethodsPanel() {
  const { paymentMethods: methods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod } = useDataStore();
  const confirmDialog = useConfirm();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const reset = () => { setName(""); setEditingId(null); };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (editingId) {
      await updatePaymentMethod(editingId, name.trim());
    } else {
      await createPaymentMethod(name.trim());
    }
    reset();
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ message: "Delete this payment method?", danger: true, confirmLabel: "Delete" }))) return;
    await deletePaymentMethod(id);
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <input dir="auto"
          style={inputStyle}
          placeholder="Payment method (e.g. Instapay)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <button onClick={handleSubmit} style={primaryBtnStyle}>
          {editingId ? <Check size={16} /> : <Plus size={16} />}
          {editingId ? "Save" : "Add"}
        </button>
        {editingId && <button onClick={reset} style={iconBtnStyle}><X size={15} /></button>}
      </div>

      {methods.length === 0 && <p className="text-muted">No payment methods yet.</p>}
      {methods.map((m) => (
        <ListRow
          key={m.id}
          label={m.name}
          onEdit={() => { setEditingId(m.id); setName(m.name); }}
          onDelete={() => handleDelete(m.id)}
        />
      ))}
    </div>
  );
}

/* =========================================================
   Tags Panel
   ========================================================= */
function TagsPanel() {
  const { tags, createTag, deleteTag } = useDataStore();
  const [name, setName] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await createTag(name.trim());
    setName("");
  };

  const handleDelete = async (id: string) => { await deleteTag(id); };

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <input dir="auto"
          style={inputStyle}
          placeholder="New tag (e.g. Subscription)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <button onClick={handleSubmit} style={primaryBtnStyle}>
          <Plus size={16} /> Add
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {tags.length === 0 && <p className="text-muted">No tags yet.</p>}
        {tags.map((t) => (
          <div
            key={t.id}
            className="card"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}
          >
            <TagIcon size={14} color="var(--accent)" />
            <span style={{ fontSize: "calc(13px * var(--app-font-scale, 1))" }}>{t.name}</span>
            <button onClick={() => handleDelete(t.id)} style={{ ...iconBtnStyle, width: 22, height: 22 }}>
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   Budgets Panel
   ========================================================= */
function BudgetsPanel() {
  const { budgetsEnabled: enabled, budgets, categories, setBudgetsEnabled, setBudget, deleteBudget, toggleBudgetPin } = useDataStore();
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(""); // empty = General

  const toggleEnabled = async () => { await setBudgetsEnabled(!enabled); };

  const handleAdd = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    await setBudget(categoryId || null, amt, "monthly");
    setAmount("");
  };

  const handleDelete = async (id: string) => { await deleteBudget(id); };

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 600 }}>Enable Budget System</div>
          <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))" }}>When disabled, all budget UI is hidden across the app.</div>
        </div>
        <ToggleSwitch checked={enabled} onChange={toggleEnabled} />
      </div>

      {enabled && (
        <>
          <div className="card" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
            <select style={inputStyle} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">General Monthly Budget</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name} (Category Budget)</option>)}
            </select>
            <input
              type="number" style={inputStyle} placeholder="Amount (EGP)"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <button onClick={handleAdd} style={primaryBtnStyle}><Plus size={16} /> Add</button>
          </div>

          <p className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", marginBottom: 10 }}>
            Click the pin icon to show a budget in the Sidebar for quick access.
          </p>

          {budgets.length === 0 && <p className="text-muted">No budgets set yet.</p>}
          {budgets.map((b) => (
            <ListRow
              key={b.id}
              label={b.category_name || "General Monthly Budget"}
              sublabel={`${b.amount} EGP / ${b.period}`}
              pinned={b.pinned}
              onTogglePin={() => toggleBudgetPin(b.id, !b.pinned)}
              onEdit={() => {}}
              onDelete={() => handleDelete(b.id)}
            />
          ))}
        </>
      )}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
        background: checked ? "var(--accent)" : "var(--border)", position: "relative", transition: "background 0.2s",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: checked ? 23 : 3, width: 18, height: 18,
        borderRadius: "50%", background: "#fff", transition: "left 0.2s",
      }} />
    </button>
  );
}

/* =========================================================
   Savings Goals Panel
   ========================================================= */
function SavingsGoalsPanel() {
  const { savingsGoals: goals, createSavingsGoal, updateSavingsGoalProgress, deleteSavingsGoal, toggleSavingsGoalPin } = useDataStore();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");

  const handleAdd = async () => {
    const amt = parseFloat(target);
    if (!name.trim() || !amt) return;
    await createSavingsGoal(name.trim(), amt, date || undefined);
    setName(""); setTarget(""); setDate("");
  };

  const handleProgress = async (id: string, current: number) => { await updateSavingsGoalProgress(id, current); };
  const handleDelete = async (id: string) => { await deleteSavingsGoal(id); };

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <input dir="auto" style={inputStyle} placeholder="Goal name (e.g. New Laptop)" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="number" style={inputStyle} placeholder="Target (EGP)" value={target} onChange={(e) => setTarget(e.target.value)} />
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
        <button onClick={handleAdd} style={primaryBtnStyle}><Plus size={16} /> Add</button>
      </div>

      <p className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", marginBottom: 10 }}>
        Click the pin icon to show a goal in the Sidebar for quick access.
      </p>

      {goals.length === 0 && <p className="text-muted">No savings goals yet.</p>}
      {goals.map((g) => {
        const percent = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
        return (
          <div key={g.id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{g.name}</div>
                {g.target_date && <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))" }}>Target date: {g.target_date}</div>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => toggleSavingsGoalPin(g.id, !g.pinned)}
                  style={{ ...iconBtnStyle, color: g.pinned ? "var(--accent)" : "var(--text-muted)", borderColor: g.pinned ? "var(--accent)" : "var(--border)" }}
                  title={g.pinned ? "Unpin from Sidebar" : "Pin to Sidebar"}
                >
                  <Pin size={15} fill={g.pinned ? "var(--accent)" : "none"} />
                </button>
                <button onClick={() => handleDelete(g.id)} style={iconBtnStyle}><Trash2 size={15} /></button>
              </div>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "var(--surface-hover)", overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: `${percent}%`, background: "var(--success)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="text-muted num" style={{ fontSize: "calc(12px * var(--app-font-scale, 1) * var(--num-font-scale, 1))" }}>{g.current_amount} / {g.target_amount} EGP ({Math.round(percent)}%)</span>
              <input
                type="number" placeholder="Update saved amount" style={{ ...inputStyle, width: 160 }}
                defaultValue={g.current_amount}
                onBlur={(e) => handleProgress(g.id, parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   Recurring Expenses Panel
   ========================================================= */
function RecurringExpensesPanel() {
  const { recurringExpenses: items, categories, createRecurringExpense, confirmRecurringExpense, deleteRecurringExpense } = useDataStore();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [confirmMsg, setConfirmMsg] = useState("");

  const handleAdd = async () => {
    const amt = parseFloat(amount);
    if (!name.trim() || !amt) return;
    await createRecurringExpense(name.trim(), amt, categoryId || null, null, frequency, startDate);
    setName(""); setAmount("");
  };

  const handleConfirm = async (id: string) => {
    await confirmRecurringExpense(id, new Date().toISOString().slice(0, 10));
    setConfirmMsg("✅ Expense recorded and added to your expenses list.");
    setTimeout(() => setConfirmMsg(""), 3000);
  };

  const handleDelete = async (id: string) => { await deleteRecurringExpense(id); };

  return (
    <div>
      <p className="text-muted" style={{ fontSize: "calc(13px * var(--app-font-scale, 1))", marginBottom: 12 }}>
        Recurring expenses require manual confirmation — nothing is added automatically.
      </p>
      {confirmMsg && (
        <div className="fade-in-item" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "var(--success)18", color: "var(--success)" }}>
          {confirmMsg}
        </div>
      )}
      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input dir="auto" style={{ ...inputStyle, flex: 2 }} placeholder="Name (e.g. Internet Bill)" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="number" style={{ ...inputStyle, flex: 1 }} placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <select style={{ ...inputStyle, flex: 1 }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">No Category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select style={{ ...inputStyle, flex: 1 }} value={frequency} onChange={(e) => setFrequency(e.target.value as any)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <input type="date" style={{ ...inputStyle, flex: 1 }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <button onClick={handleAdd} style={primaryBtnStyle}><Plus size={16} /> Add</button>
      </div>

      {items.length === 0 && <p className="text-muted">No recurring expenses yet.</p>}
      {items.map((r) => (
        <div key={r.id} className="card" style={{ marginBottom: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{r.name} — <span className="num">{r.amount} EGP</span></div>
            <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))" }}>{r.frequency} · Next due: {r.next_due_date}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => handleConfirm(r.id)} style={primaryBtnStyle}>Confirm Now</button>
            <button onClick={() => handleDelete(r.id)} style={iconBtnStyle}><Trash2 size={15} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   Security Panel (Password + Auto Lock)
   ========================================================= */
function SecurityPanel() {
  const { refreshPasswordStatus } = useAuth();
  const confirmDialog = useConfirm();
  const [enabled, setEnabled] = useState(false);
  const [autoLock, setAutoLock] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  const [showRecoveryReset, setShowRecoveryReset] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryNewPassword, setRecoveryNewPassword] = useState("");

  const load = () => {
    api.isPasswordEnabled().then(setEnabled);
    api.getAutoLockMinutes().then(setAutoLock);
  };
  useEffect(() => { load(); }, []);

  const handleSetPassword = async () => {
    if (newPassword.length < 4) { setMessage("Password must be at least 4 characters."); return; }
    if (newPassword !== confirmPassword) { setMessage("Passwords do not match."); return; }
    const code = await api.setPassword(newPassword);
    setRecoveryCode(code);
    setMessage("Password set successfully.");
    setNewPassword(""); setConfirmPassword("");
    load();
    await refreshPasswordStatus(); // يحدّث زر القفل في الـ Top Header فوراً بدون إعادة فتح التطبيق
  };

  const handleDisable = async () => {
    if (!(await confirmDialog({ message: "Disable password protection?", danger: true, confirmLabel: "Disable" }))) return;
    await api.disablePassword();
    setRecoveryCode(null);
    load();
    await refreshPasswordStatus();
  };

  const handleAutoLockChange = async (minutes: number | null) => {
    setAutoLock(minutes);
    await api.setAutoLockMinutes(minutes);
    await refreshPasswordStatus();
  };

  const handleResetWithRecovery = async () => {
    if (recoveryNewPassword.length < 4) { setMessage("New password must be at least 4 characters."); return; }
    try {
      const newCode = await api.resetPasswordWithRecoveryCode(recoveryInput, recoveryNewPassword);
      setRecoveryCode(newCode);
      setMessage("Password reset successfully using your recovery code. A new recovery code was generated below.");
      setShowRecoveryReset(false); setRecoveryInput(""); setRecoveryNewPassword("");
      load();
      await refreshPasswordStatus();
    } catch {
      setMessage("Invalid recovery code. Please check and try again.");
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          {enabled ? <Lock size={16} color="var(--success)" /> : <Unlock size={16} color="var(--text-muted)" />}
          <strong>{enabled ? "Password protection is ON" : "Password protection is OFF"}</strong>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input type="password" style={inputStyle} placeholder={enabled ? "New password" : "Set a password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <input type="password" style={inputStyle} placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSetPassword} style={primaryBtnStyle}>{enabled ? "Change Password" : "Enable Password"}</button>
          {enabled && <button onClick={handleDisable} style={{ ...primaryBtnStyle, background: "var(--danger)" }}>Disable</button>}
        </div>
        {message && <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", marginTop: 8 }}>{message}</div>}

        {recoveryCode && (
          <div className="card" style={{ marginTop: 14, background: "var(--accent-soft)", border: "1px solid var(--accent)" }}>
            <strong style={{ fontSize: "calc(13px * var(--app-font-scale, 1))" }}>Your Recovery Code (save it somewhere safe — shown only once):</strong>
            <div style={{ fontFamily: "monospace", fontSize: "calc(20px * var(--app-font-scale, 1))", fontWeight: 700, letterSpacing: 2, marginTop: 8, color: "var(--accent)" }}>
              {recoveryCode}
            </div>
            <p className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", marginTop: 8, marginBottom: 0 }}>
              If you forget your password, use this code on the lock screen (or here in Settings) to set a new one.
              Generating a new password automatically replaces this code with a fresh one.
            </p>
          </div>
        )}
      </div>

      {enabled && (
        <div className="card" style={{ marginBottom: 16 }}>
          <strong>Forgot Your Password?</strong>
          <p className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", marginTop: 4 }}>
            Use the Recovery Code you saved when you first set your password.
          </p>
          {!showRecoveryReset ? (
            <button onClick={() => setShowRecoveryReset(true)} style={secondaryBtnStyle}>Reset Password with Recovery Code</button>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input dir="auto" style={inputStyle} placeholder="Recovery Code (XXXXXX-XXXXXX)" value={recoveryInput} onChange={(e) => setRecoveryInput(e.target.value)} />
              <input type="password" style={inputStyle} placeholder="New password" value={recoveryNewPassword} onChange={(e) => setRecoveryNewPassword(e.target.value)} />
              <button onClick={handleResetWithRecovery} style={primaryBtnStyle}>Reset Password</button>
              <button onClick={() => setShowRecoveryReset(false)} style={secondaryBtnStyle}>Cancel</button>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <strong>Auto Lock</strong>
        <p className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", marginTop: 4 }}>Automatically lock the app after a period of inactivity (requires password enabled).</p>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {[null, 5, 10, 15].map((m) => (
            <button
              key={String(m)}
              onClick={() => handleAutoLockChange(m)}
              style={{ ...chipStyle, ...(autoLock === m ? chipActiveStyle : {}) }}
            >
              {m === null ? "Off" : `${m} min`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const chipStyle: CSSProperties = { padding: "8px 14px", borderRadius: 20, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", fontSize: "calc(13px * var(--app-font-scale, 1))", cursor: "pointer" };
const chipActiveStyle: CSSProperties = { background: "var(--accent)", color: "var(--on-accent)", borderColor: "var(--accent)" };
const dayCellStyle: CSSProperties = { height: 30, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-hover)", color: "var(--text)", fontSize: "calc(12px * var(--app-font-scale, 1))", fontWeight: 600, cursor: "pointer", padding: 0 };
const miniIconBtnStyle: CSSProperties = { background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: 6, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text)", padding: 0 };
const secondaryBtnStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-hover)", color: "var(--text)", fontWeight: 600, fontSize: "calc(14px * var(--app-font-scale, 1))", cursor: "pointer" };

const BACKUP_CAL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function AutoBackupSection() {
  const dayPicker = useDropdown<HTMLButtonElement>();
  const { weekStart } = useWeekStart();
  // شهر المعاينة في تقويم اختيار يوم النسخ الاحتياطي — يبدأ بالشهر الحالي،
  // وينفصل عن أي تنقّل شهري تاني في الصفحة عشان المستخدم يقدر يتصفح فبراير
  // (٢٨ يوم) أو أبريل (٣٠ يوم) ويشوف الفرق قبل ما يختار.
  const [calCursor, setCalCursor] = useState(new Date());

  // كل الحالة والمنطق (تحميل/حفظ الإعدادات، تنفيذ النسخة، والفحص التلقائي عند بدء التشغيل)
  // في هوك مشترك — بيشتغل بنفس الطريقة هنا وفي AutoBackupRunner عند إقلاع التطبيق.
  const {
    settings, save, doBackup, backingUp, msg,
    backupFolder, folderStatus, handleChangeLocation, handleOpenFolder,
  } = useAutoBackup();

  const SCHEDULE_LABELS: Record<BackupSchedule, string> = {
    weekly: "Every Week", monthly: "Every Month",
    quarterly: "Every 3 Months", biannual: "Every 6 Months", yearly: "Every Year",
  };

  const HISTORY_LABELS: Record<string, string> = { 5: "Last 5", 10: "Last 10", 20: "Last 20", unlimited: "Unlimited" };

  return (
    <div className="card" style={{ marginBottom: 16, border: settings.enabled ? "1px solid var(--accent)" : "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0 }}>Automatic Backup</h3>
          <p className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", marginTop: 4, marginBottom: 0 }}>
            Set it and forget it — the app backs up your data automatically on a schedule.
          </p>
        </div>
        <ToggleSwitch checked={settings.enabled} onChange={() => {
          const enabled = !settings.enabled;
          save({ enabled, nextBackupDate: enabled ? calcNextBackupDate(settings.schedule, settings.backupDay) : null });
        }} />
      </div>

      {/* Status Card */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Status", value: settings.enabled ? "Active" : "Disabled", color: settings.enabled ? "var(--success)" : "var(--text-muted)" },
          { label: "Last Backup", value: settings.lastBackupDate || "Never" },
          { label: "Next Backup", value: settings.enabled ? (settings.nextBackupDate || "—") : "—" },
          { label: "Format", value: settings.format.toUpperCase() },
          { label: "Frequency", value: settings.schedule === "weekly" ? SCHEDULE_LABELS.weekly : `${SCHEDULE_LABELS[settings.schedule]} · Day ${settings.backupDay}` },
          { label: "Stored Backups", value: `${settings.storedBackups.length} ${settings.maxHistory !== "unlimited" ? `/ ${settings.maxHistory}` : ""}` },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: "10px 12px", background: "var(--surface-hover)", borderRadius: 8 }}>
            <div className="text-muted" style={{ fontSize: "calc(11px * var(--app-font-scale, 1))" }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: "calc(13px * var(--app-font-scale, 1))", marginTop: 2, color: color || "var(--text)" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Backup Location */}
      <div style={{ marginBottom: 16, padding: "12px 14px", background: "var(--surface-hover)", borderRadius: 8 }}>
        <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", marginBottom: 6, fontWeight: 600 }}>Backup Location</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: "calc(13px * var(--app-font-scale, 1))", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {backupFolder || "Not set — using browser default downloads"}
          </span>
          {backupFolder && (
            <span style={{
              fontSize: "calc(10px * var(--app-font-scale, 1))", padding: "2px 8px", borderRadius: 20, fontWeight: 700,
              background: folderStatus === "ok" ? "var(--success)22" : "var(--danger)22",
              color: folderStatus === "ok" ? "var(--success)" : "var(--danger)",
            }}>
              {folderStatus === "ok" ? "Available" : "Unavailable"}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleChangeLocation} style={secondaryBtnStyle}>Change Location</button>
          {backupFolder && <button onClick={handleOpenFolder} style={secondaryBtnStyle}>Open Backup Folder</button>}
        </div>
      </div>

      {/* Format */}
      <div style={{ marginBottom: 12 }}>
        <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", marginBottom: 6, fontWeight: 600 }}>Backup Format</div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["json", "excel", "csv"] as BackupFormat[]).map((f) => (
            <button key={f} onClick={() => save({ format: f })} style={{ ...chipStyle, ...(settings.format === f ? chipActiveStyle : {}) }}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule */}
      <div style={{ marginBottom: 12 }}>
        <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", marginBottom: 6, fontWeight: 600 }}>Schedule</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(Object.keys(SCHEDULE_LABELS) as BackupSchedule[]).map((s) => (
            <button key={s} onClick={() => save({ schedule: s })} style={{ ...chipStyle, fontSize: "calc(12px * var(--app-font-scale, 1))", ...(settings.schedule === s ? chipActiveStyle : {}) }}>
              {SCHEDULE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Backup day of month — يظهر مع كل التكرارات ما عدا الأسبوعي */}
      <div style={{ marginBottom: 12 }}>
        <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", marginBottom: 6, fontWeight: 600 }}>Backup Day</div>
        {settings.schedule === "weekly" ? (
          <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))" }}>
            Weekly backups run every 7 days. Choose Monthly, Every 3/6 Months or Yearly to pick a specific day of the month.
          </div>
        ) : (
          <>
            <button
              ref={dayPicker.triggerRef}
              onClick={dayPicker.toggle}
              style={{ ...chipStyle, display: "inline-flex", alignItems: "center", gap: 8, fontSize: "calc(13px * var(--app-font-scale, 1))" }}
            >
              <CalendarIcon size={14} /> Day {settings.backupDay} of the month
            </button>
            <DropdownPortal anchorRef={dayPicker.triggerRef} menuRef={dayPicker.menuRef} open={dayPicker.open} width={280} align="left">
              <div className="card" style={{ padding: 12 }}>
                <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", fontWeight: 600, marginBottom: 8 }}>
                  Run the automatic backup on day:
                </div>

                {(() => {
                  const calYear = calCursor.getFullYear();
                  const calMonth = calCursor.getMonth();
                  const calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                  const calFirstDayOfWeek = (new Date(calYear, calMonth, 1).getDay() - weekStart + 7) % 7;
                  const calCells: (number | null)[] = [
                    ...Array(calFirstDayOfWeek).fill(null),
                    ...Array.from({ length: calDaysInMonth }, (_, i) => i + 1),
                  ];
                  return (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <button type="button" aria-label="Previous month" onClick={() => setCalCursor(new Date(calYear, calMonth - 1, 1))} style={miniIconBtnStyle}>
                          <ChevronLeft size={14} />
                        </button>
                        <div style={{ fontSize: "calc(12.5px * var(--app-font-scale, 1))", fontWeight: 600 }}>
                          {BACKUP_CAL_MONTHS[calMonth]} {calYear}
                        </div>
                        <button type="button" aria-label="Next month" onClick={() => setCalCursor(new Date(calYear, calMonth + 1, 1))} style={miniIconBtnStyle}>
                          <ChevronRight size={14} />
                        </button>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
                        {weekdayLabels(weekStart).map((d) => (
                          <div key={d} className="text-muted" style={{ textAlign: "center", fontSize: "calc(10px * var(--app-font-scale, 1))", fontWeight: 600 }}>
                            {d[0]}
                          </div>
                        ))}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                        {calCells.map((d, i) =>
                          d === null ? (
                            <div key={i} />
                          ) : (
                            <button
                              key={i}
                              onClick={() => { save({ backupDay: d }); dayPicker.setOpen(false); }}
                              style={{ ...dayCellStyle, ...(settings.backupDay === d ? chipActiveStyle : {}) }}
                            >
                              {d}
                            </button>
                          )
                        )}
                      </div>

                      {settings.backupDay > calDaysInMonth && (
                        <div style={{ marginTop: 8, padding: "6px 8px", borderRadius: 6, background: "var(--warning)22", color: "var(--warning)", fontSize: "calc(11px * var(--app-font-scale, 1))" }}>
                          Day {settings.backupDay} doesn't exist in {BACKUP_CAL_MONTHS[calMonth]} — the backup will run on day {calDaysInMonth} (the last day) instead.
                        </div>
                      )}
                    </>
                  );
                })()}

                <div className="text-muted" style={{ fontSize: "calc(11px * var(--app-font-scale, 1))", marginTop: 8 }}>
                  Browse months with the arrows above to see how each length maps — February has 28 or 29 days, April/June/September/November have 30.
                  In shorter months the backup runs on the last day instead.
                </div>
              </div>
            </DropdownPortal>
          </>
        )}
      </div>

      {/* History limit */}
      <div style={{ marginBottom: 16 }}>
        <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", marginBottom: 6, fontWeight: 600 }}>Keep Maximum</div>
        <div style={{ display: "flex", gap: 8 }}>
          {([5, 10, 20, "unlimited"] as BackupHistory[]).map((h) => (
            <button key={String(h)} onClick={() => save({ maxHistory: h })} style={{ ...chipStyle, fontSize: "calc(12px * var(--app-font-scale, 1))", ...(settings.maxHistory === h ? chipActiveStyle : {}) }}>
              {HISTORY_LABELS[String(h)]}
            </button>
          ))}
        </div>
      </div>

      {/* Backup Now */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={() => doBackup("manual")} disabled={backingUp} style={primaryBtnStyle}>
          <Download size={16} /> {backingUp ? "Backing up..." : "Backup Now"}
        </button>
        {msg && <span style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", color: msg.startsWith("✅") ? "var(--success)" : "var(--danger)" }}>{msg}</span>}
      </div>

      {/* Stored Backups History */}
      {settings.storedBackups.length > 0 && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", fontWeight: 600, marginBottom: 8 }}>Backup History</div>
          {settings.storedBackups.map((b) => (
            <div key={b.name} style={{ display: "flex", justifyContent: "space-between", fontSize: "calc(12px * var(--app-font-scale, 1))", padding: "5px 0", borderTop: "1px solid var(--border)" }}>
              <span style={{ fontFamily: "monospace", color: "var(--accent)" }}>{b.name}</span>
              <span className="text-muted">{b.date} · {b.size}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   Import Helpers — خارج الـ Component لتفادي إعادة الإنشاء
   ========================================================= */

const MONTH_NAMES_MAP: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

export type AmbiguousDateFormat = "DMY" | "MDY";

/**
 * يطبّع تاريخ مكتوب بأي صيغة شائعة لصيغة YYYY-MM-DD.
 * - الصيغ غير الغامضة (ISO، أسماء شهور، أو أرقام واضحة مثل يوم > 12) تُحلّ بشكل حتمي دائماً.
 * - الصيغة الغامضة فقط (مثل 02/07/2026 حيث كلا الرقمين ≤ 12) تعتمد على `ambiguousFormat`
 *   الذي يختاره المستخدم صراحة قبل الاستيراد، بدل تخمين عشوائي.
 */
function normalizeDate(raw: string, ambiguousFormat: AmbiguousDateFormat = "DMY"): string | null {
  const s = raw.trim();
  if (!s) return null;

  // ISO: YYYY-MM-DD (غير غامض)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T00:00:00Z");
    return isNaN(d.getTime()) ? null : s;
  }

  // "Jul 2, 2026" / "July 2 2026" (غير غامض)
  let m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mon = MONTH_NAMES_MAP[m[1].toLowerCase()];
    if (mon !== undefined) {
      const d = new Date(Date.UTC(parseInt(m[3], 10), mon, parseInt(m[2], 10)));
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }

  // "2 Jul 2026" / "2 July 2026" (غير غامض)
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
  if (m) {
    const mon = MONTH_NAMES_MAP[m[2].toLowerCase()];
    if (mon !== undefined) {
      const d = new Date(Date.UTC(parseInt(m[3], 10), mon, parseInt(m[1], 10)));
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }

  // أرقام بفواصل: قد تكون YYYY/MM/DD أو DD/MM/YYYY أو MM/DD/YYYY أو DD.MM.YYYY
  const parts = s.split(/[/\-.]/).map((p) => p.trim());
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
    const [p1, p2, p3] = parts.map(Number);

    // YYYY/MM/DD — السنة أولاً، غير غامض
    if (String(parts[0]).length === 4) {
      const d = new Date(Date.UTC(p1, p2 - 1, p3));
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    // *_/*_/YYYY — السنة أخيراً
    else if (String(parts[2]).length === 4) {
      if (p1 > 12 && p2 <= 12) {
        // p1 لازم يكون يوم (أكبر من 12 مينفعش يكون شهر) → DD/MM/YYYY غير غامض
        const d = new Date(Date.UTC(p3, p2 - 1, p1));
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      } else if (p2 > 12 && p1 <= 12) {
        // p2 لازم يكون يوم → MM/DD/YYYY غير غامض
        const d = new Date(Date.UTC(p3, p1 - 1, p2));
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      } else {
        // غامض فعلاً (كلاهما ≤ 12): نستخدم إعداد المستخدم الصريح بدل التخمين
        const d = ambiguousFormat === "DMY"
          ? new Date(Date.UTC(p3, p2 - 1, p1))
          : new Date(Date.UTC(p3, p1 - 1, p2));
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      }
    }
  }

  // محاولة أخيرة عبر Date.parse لأي صيغة إنجليزية أخرى
  const fallback = new Date(s);
  if (!isNaN(fallback.getTime())) return fallback.toISOString().slice(0, 10);

  return null;
}

/**
 * Smart Column Detector — يكتشف الأعمدة بطريقتين:
 * 1. مطابقة اسم الـ header (مرنة، case-insensitive، عربي/إنجليزي)
 * 2. إذا فشلت المطابقة، يحلّل القيم ليعرف أي عمود هو التاريخ وأيهم الرقم وأيهم النص
 *    → هذا يحل مشكلة ترتيب الأعمدة المختلف بين ملفات المستخدمين المختلفة
 */
/**
 * يقرأ ورقة Excel بذكاء بدل افتراض أن الصف الأول هو دائماً صف الأعمدة (headers).
 * السبب: ملفات كثيرة (خصوصاً المُنشأة يدوياً من المستخدم) تحتوي على صف عنوان
 * ("تقرير المصروفات 2026" مثلاً) أو صف فارغ قبل الأعمدة الحقيقية. لو افترضنا
 * الصف الأول دائماً هو الـ headers، ستتحول أسماء الأعمدة الحقيقية (Date, Amount...)
 * لقيم بيانات عادية بدل أسماء أعمدة، فيفشل اكتشاف كل الأعمدة بالكامل لكل الصفوف.
 *
 * الحل: نقرأ أول 5 صفوف كمصفوفات خام، ونحسب "درجة تشابه" كل صف مع كونه Headers
 * حقيقية (عدد خلايا نصية مختلفة غير فارغة، مع تفضيل الصفوف غير الرقمية بالكامل)،
 * ونختار الصف الأعلى درجة كـ headers فعلية بغض النظر عن موضعه.
 */
function parseSheetSmartly(ws: XLSX.WorkSheet): { rows: Record<string, string>[]; headerRowIndex: number; detectedHeaders: string[] } {
  const rawArrays = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, raw: false, defval: "" });
  if (rawArrays.length === 0) return { rows: [], headerRowIndex: -1, detectedHeaders: [] };

  const scoreAsHeaderRow = (row: (string | number)[]): number => {
    const nonEmpty = row.map((c) => String(c ?? "").trim()).filter((c) => c !== "");
    if (nonEmpty.length < 2) return -1; // صف بخلية واحدة أو أقل: غالباً عنوان، مش صف أعمدة
    const distinctCells = new Set(nonEmpty.map((c) => c.toLowerCase()));
    const allNonNumeric = nonEmpty.every((c) => isNaN(parseFloat(c)));
    return distinctCells.size * (allNonNumeric ? 2 : 1);
  };

  let bestIdx = 0, bestScore = -Infinity;
  const scanLimit = Math.min(5, rawArrays.length);
  for (let i = 0; i < scanLimit; i++) {
    const score = scoreAsHeaderRow(rawArrays[i]);
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }

  const headerRow = rawArrays[bestIdx].map((h) => String(h ?? "").trim());
  const dataArrays = rawArrays.slice(bestIdx + 1);

  const rows: Record<string, string>[] = dataArrays.map((r) => {
    const obj: Record<string, string> = {};
    headerRow.forEach((h, i) => { if (h) obj[h] = String(r[i] ?? "").trim(); });
    return obj;
  }).filter((r) => Object.values(r).some((v) => v !== ""));

  return { rows, headerRowIndex: bestIdx, detectedHeaders: headerRow.filter(Boolean) };
}

function detectColumns(headers: string[], sampleRows: Record<string, string>[]): {
  idCol: string | null; nameCol: string | null; dateCol: string | null;
  amountCol: string | null; categoryCol: string | null;
  paymentCol: string | null; notesCol: string | null;
} {
  const result = { idCol: null as string | null, nameCol: null as string | null,
    dateCol: null as string | null, amountCol: null as string | null,
    categoryCol: null as string | null, paymentCol: null as string | null,
    notesCol: null as string | null };

  const aliases: Record<keyof typeof result, string[]> = {
    idCol:       ["expense id", "id", "expense_id", "#", "رقم"],
    nameCol:     ["name", "expense name", "item", "title", "expense", "merchant", "vendor", "payee",
                  "اسم", "الاسم", "البيان", "بيان"],
    dateCol:     ["date", "expense date", "transaction date", "تاريخ", "التاريخ"],
    amountCol:   ["amount (egp)", "amount", "egp", "price", "cost", "value", "total",
                  "مبلغ", "المبلغ", "القيمة", "السعر"],
    categoryCol: ["category", "cat", "type", "فئة", "الفئة", "تصنيف", "التصنيف", "النوع"],
    paymentCol:  ["payment method", "payment", "method", "طريقة الدفع", "طريقة", "الدفع"],
    notesCol:    ["notes", "note", "comment", "remarks", "description", "وصف", "الوصف", "ملاحظات", "ملاحظة"],
  };

  const used = new Set<string>();

  // المرحلة 1: مطابقة بالاسم
  for (const [field, aliasList] of Object.entries(aliases) as [keyof typeof result, string[]][]) {
    for (const h of headers) {
      if (used.has(h)) continue;
      if (aliasList.some((a) => h.toLowerCase().trim() === a.toLowerCase())) {
        result[field] = h;
        used.add(h);
        break;
      }
    }
  }

  // المرحلة 2: إذا فاتت أعمدة أساسية، اكتشفها من القيم
  const critical = [!result.nameCol, !result.dateCol, !result.amountCol].some(Boolean);
  if (critical) {
    const unmatched = headers.filter((h) => !used.has(h));
    const colStats = unmatched.map((h) => {
      const values = sampleRows.slice(0, 15).map((r) => (r[h] || "").trim()).filter(Boolean);
      const total = values.length || 1;
      const dateScore  = values.filter((v) => normalizeDate(v) !== null).length / total;
      const numScore   = values.filter((v) => !isNaN(parseFloat(v.replace(/[^\d.-]/g, "")))).length / total;
      // النص الحقيقي: أحرف عربية أو لاتينية (مش أرقام أو تواريخ فقط)
      const textScore  = values.filter((v) => /[A-Za-z\u0600-\u06FF]/.test(v)).length / total;
      return { h, dateScore, numScore, textScore };
    });

    if (!result.dateCol) {
      const best = colStats.sort((a, b) => b.dateScore - a.dateScore)[0];
      if (best && best.dateScore > 0.4) { result.dateCol = best.h; used.add(best.h); }
    }
    if (!result.amountCol) {
      const best = colStats.filter((c) => !used.has(c.h)).sort((a, b) => b.numScore - a.numScore)[0];
      if (best && best.numScore > 0.5) { result.amountCol = best.h; used.add(best.h); }
    }
    if (!result.nameCol) {
      const best = colStats.filter((c) => !used.has(c.h)).sort((a, b) => b.textScore - a.textScore)[0];
      if (best && best.textScore > 0.3) { result.nameCol = best.h; used.add(best.h); }
    }
    if (!result.categoryCol) {
      const best = colStats.filter((c) => !used.has(c.h) && c.textScore > 0.3).sort((a, b) => b.textScore - a.textScore)[0];
      if (best) { result.categoryCol = best.h; used.add(best.h); }
    }
  }

  return result;
}

/* =========================================================
   Data Tools Panel (Backup / Restore / Delete All)
   ========================================================= */
function DataToolsPanel() {
  const { expenses, importBackupJson, importExpensesBulk } = useDataStore();
  const confirmDialog = useConfirm();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dateFormat, setDateFormat] = useState<AmbiguousDateFormat>("DMY");

  const handleExportJson = async () => {
    setBusy(true);
    try {
      const json = await api.exportBackupJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `expense-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("JSON backup exported successfully.");
    } finally { setBusy(false); }
  };

  /** يولّد ملف Excel متوافق (SpreadsheetML XML) بدون أي مكتبة خارجية أو اتصال إنترنت */
  /** Export Excel حقيقي (.xlsx) باستخدام SheetJS — بدون أي تحذيرات "format mismatch" */
  const handleExportExcel = async () => {
    setBusy(true);
    try {
      const wsData = expenses.map((e) => ({
        "Expense ID":     isValidExpenseId(e.id) ? e.id : deriveExpenseIdFromUuid(e.id, e.date),
        "Name":           e.name,
        "Date":           e.date,
        "Amount (EGP)":   e.amount,
        "Category":       e.category_name    ?? "",
        "Payment Method": e.payment_method_name ?? "",
        "Notes":          e.description      ?? "",
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(wsData);
      ws["!cols"] = [
        { wch: 22 }, { wch: 28 }, { wch: 13 },
        { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Expenses");

      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `expense-manager-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("✅ Excel file exported as .xlsx — opens in Microsoft Excel without any warnings.");
    } finally { setBusy(false); }
  };

  const handleImportJson = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (!(await confirmDialog({ message: "This will replace your current data with the backup file. Continue?", danger: true, confirmLabel: "Restore Backup" }))) return;
      setBusy(true);
      try {
        await importBackupJson(String(reader.result));
        setMessage("Backup restored successfully — all pages are now up to date.");
      } finally { setBusy(false); }
    };
    reader.readAsText(file);
  };

  /**
   * Import Excel/CSV باستخدام SheetJS:
   * - يقرأ الملف كـ ArrayBuffer فيدعم XLS و XLSX و CSV و SpreadsheetML بشكل صحيح
   * - defval: "" يضمن عدم انزياح الأعمدة عند وجود خلايا فارغة
   * - detectColumns يكتشف الأعمدة بالاسم أولاً ثم بتحليل القيم كخطة بديلة
   */
  const handleImportExcel = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setBusy(true);
    setMessage("");
    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      let wb: XLSX.WorkBook;
      try {
        wb = XLSX.read(data, { type: "array", raw: false, cellDates: false });
      } catch {
        setMessage("❌ Could not read the file. Make sure it is a valid Excel (.xlsx, .xls) or CSV file.");
        return;
      }

      if (!wb.SheetNames.length) {
        setMessage("❌ The file appears to be empty.");
        return;
      }

      const ws = wb.Sheets[wb.SheetNames[0]];
      const { rows: rawRows, headerRowIndex } = parseSheetSmartly(ws);

      if (rawRows.length === 0) {
        setMessage("❌ No data found in the file.\nMake sure the file has a header row and at least one data row.");
        return;
      }

      const headers = Object.keys(rawRows[0]);
      const colMap = detectColumns(headers, rawRows);

      const debugCols = [
        `ID→${colMap.idCol || "auto"}`,   `Name→${colMap.nameCol || "auto-fallback"}`,
        `Date→${colMap.dateCol || "?"}`,   `Amount→${colMap.amountCol || "?"}`,
        `Cat→${colMap.categoryCol || "none"}`,
      ].join(", ");

      // Name عمود اختياري الآن — لو مش موجود نستخدم الفئة أو الملاحظات كاسم بديل لكل صف
      if (!colMap.dateCol || !colMap.amountCol) {
        setMessage(`❌ Could not detect required columns.\nHeader row detected at row ${headerRowIndex + 1}: ${headers.join(", ")}\nDetected: ${debugCols}\nMake sure your file has at least Date and Amount columns.`);
        return;
      }

      const existingCategories = await api.getCategories();
      const existingCatNames = new Set(existingCategories.map((c) => c.name.toLowerCase()));
      const newCatNames = new Set<string>();

      const existingPaymentMethods = await api.getPaymentMethods();
      const existingPayNames = new Set(existingPaymentMethods.map((p) => p.name.toLowerCase()));
      const newPayNames = new Set<string>();

      rawRows.forEach((row) => {
        if (colMap.categoryCol) {
          const cat = (row[colMap.categoryCol] ?? "").trim();
          if (cat && !existingCatNames.has(cat.toLowerCase())) newCatNames.add(cat);
        }
        if (colMap.paymentCol) {
          const pay = (row[colMap.paymentCol] ?? "").trim();
          if (pay && !existingPayNames.has(pay.toLowerCase())) newPayNames.add(pay);
        }
      });

      const DEFAULT_COLORS = ["#2E8B74","#ED6F50","#D6A032","#5B8FD9","#A46FB0","#D4564A","#3FA9A0","#8A93A6"];
      let colorIdx = existingCategories.length;
      for (const catName of newCatNames) {
        await api.createCategory(catName, undefined, DEFAULT_COLORS[colorIdx % DEFAULT_COLORS.length]);
        colorIdx++;
      }
      for (const payName of newPayNames) {
        await api.createPaymentMethod(payName);
      }

      const updatedCats = await api.getCategories();
      const catNameToId = new Map(updatedCats.map((c) => [c.name.toLowerCase(), c.id]));
      const updatedPays = await api.getPaymentMethods();
      const payNameToId = new Map(updatedPays.map((p) => [p.name.toLowerCase(), p.id]));

      // لكشف التكرارات: مقارنة (الاسم + التاريخ + المبلغ) مع المصروفات الموجودة بالفعل
      const existingSignatures = new Set(
        expenses.map((e) => `${e.name.trim().toLowerCase()}|${e.date}|${e.amount}`)
      );
      const batchSignatures = new Set<string>();

      const validRows: { id: string; name: string; date: string; amount: number; category_id?: string | null; payment_method_id?: string | null; description?: string | null }[] = [];
      const skipped: string[] = [];
      const batchIds = new Set<string>(); // لمنع تكرار IDs داخل نفس عملية الاستيراد
      let duplicateCount = 0;

      rawRows.forEach((row, idx) => {
        const rowNum = idx + 2;
        const rawId   = colMap.idCol       ? (row[colMap.idCol]       ?? "").trim() : "";
        const rawName = colMap.nameCol     ? (row[colMap.nameCol]     ?? "").trim() : "";
        const dateRaw = colMap.dateCol     ? (row[colMap.dateCol]     ?? "").trim() : "";
        const amtRaw  = colMap.amountCol   ? (row[colMap.amountCol]   ?? "").trim() : "";
        const catRaw  = colMap.categoryCol ? (row[colMap.categoryCol] ?? "").trim() : "";
        const payRaw  = colMap.paymentCol  ? (row[colMap.paymentCol]  ?? "").trim() : "";
        const notesRaw = colMap.notesCol
          ? (row[colMap.notesCol] ?? "").trim()
          : (row["Notes"] ?? row["notes"] ?? row["ملاحظات"] ?? row["ملاحظة"] ?? "").trim();

        if (!dateRaw) { skipped.push(`Row ${rowNum}: Missing date`); return; }

        const date = normalizeDate(dateRaw, dateFormat);
        if (!date) { skipped.push(`Row ${rowNum}: Unrecognized date "${dateRaw}"`); return; }

        const amount = parseFloat(amtRaw.replace(/[^\d.-]/g, ""));
        if (isNaN(amount) || amount <= 0) {
          skipped.push(`Row ${rowNum}: Invalid amount "${amtRaw}"`);
          return;
        }

        // Name fallback: لو مفيش عمود اسم منفصل (نمط شائع في دفاتر المصاريف البسيطة)،
        // نستخدم الفئة كاسم، وإلا الملاحظات، وإلا تسمية عامة — بدل رفض الصف بالكامل
        const name = rawName || catRaw || notesRaw || `Expense (${date})`;

        // توليد ID فريد: لو الـ ID موجود وصالح وغير مكرر نحتفظ به، غير كده نولّد جديد
        let id: string;
        if (isValidExpenseId(rawId) && !batchIds.has(rawId)) {
          id = rawId;
        } else {
          let attempts = 0;
          do {
            id = generateExpenseId(date);
            attempts++;
          } while (batchIds.has(id) && attempts < 100);
        }
        batchIds.add(id);

        // كشف التكرار: نفس (الاسم + التاريخ + المبلغ) موجود بالفعل أو تكرر داخل نفس الملف
        const signature = `${name.trim().toLowerCase()}|${date}|${amount}`;
        if (existingSignatures.has(signature) || batchSignatures.has(signature)) {
          duplicateCount++;
        }
        batchSignatures.add(signature);

        const category_id = catRaw ? (catNameToId.get(catRaw.toLowerCase()) ?? null) : null;
        const payment_method_id = payRaw ? (payNameToId.get(payRaw.toLowerCase()) ?? null) : null;
        validRows.push({ id, name, date, amount, category_id, payment_method_id, description: notesRaw || null });
      });

      if (validRows.length === 0) {
        setMessage(`❌ No valid rows found.\nHeader row detected at row ${headerRowIndex + 1}.\nDetected columns: ${debugCols}\nFirst issues:\n${skipped.slice(0, 5).join("\n")}`);
        return;
      }

      const { count, failed } = await importExpensesBulk(validRows);

      const lines: string[] = [
        `✅ Imported: ${count}`,
        `⚠ Skipped: ${skipped.length}${failed > 0 ? ` (+${failed} failed to save)` : ""}`,
        `🔁 Duplicates: ${duplicateCount} (imported anyway — review in All Expenses)`,
        `📁 New Categories: ${newCatNames.size}${newCatNames.size > 0 ? ` (${[...newCatNames].join(", ")})` : ""}`,
        `💳 New Payment Methods: ${newPayNames.size}${newPayNames.size > 0 ? ` (${[...newPayNames].join(", ")})` : ""}`,
      ];
      if (skipped.length > 0) lines.push(`\nFirst skip reasons: ${skipped.slice(0, 3).join(" | ")}${skipped.length > 3 ? ` (+${skipped.length - 3} more)` : ""}`);

      setMessage(lines.join("\n"));
    } catch (err) {
      setMessage(`❌ Import failed: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {/* Auto Backup System */}
      <AutoBackupSection />

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Backup & Restore (JSON)</h3>
        <p className="text-muted" style={{ fontSize: "calc(13px * var(--app-font-scale, 1))" }}>
          Export a full JSON backup of your data regularly. Keep it somewhere safe (USB drive, cloud storage)
          in case anything happens to this computer. This is the recommended format for full restore.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleExportJson} disabled={busy} style={primaryBtnStyle}>
            {busy ? <RefreshCw size={16} className="spin-icon" /> : <Download size={16} />} {busy ? "Exporting..." : "Export Backup (JSON)"}
          </button>
          <label style={{ ...secondaryBtnStyle, display: "flex", alignItems: "center", gap: 6, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            <Upload size={16} /> Import Backup (JSON)
            <input type="file" accept=".json" onChange={handleImportJson} style={{ display: "none" }} disabled={busy} />
          </label>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Excel Export / Import</h3>
        <p className="text-muted" style={{ fontSize: "calc(13px * var(--app-font-scale, 1))" }}>
          Export your expenses as an Excel-compatible file for spreadsheets and reporting.
          Import auto-detects columns by name and content — a dedicated Name column is optional.
        </p>

        <div style={{ marginBottom: 10 }}>
          <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", marginBottom: 6, fontWeight: 600 }}>
            Ambiguous Date Format (used only when a date like 02/07/2026 could mean either)
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setDateFormat("DMY")} style={{ ...chipStyle, fontSize: "calc(12px * var(--app-font-scale, 1))", ...(dateFormat === "DMY" ? chipActiveStyle : {}) }}>
              Day/Month/Year (02/07 → 2 Jul)
            </button>
            <button onClick={() => setDateFormat("MDY")} style={{ ...chipStyle, fontSize: "calc(12px * var(--app-font-scale, 1))", ...(dateFormat === "MDY" ? chipActiveStyle : {}) }}>
              Month/Day/Year (02/07 → Feb 7)
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleExportExcel} disabled={busy} style={primaryBtnStyle}>
            {busy ? <RefreshCw size={16} className="spin-icon" /> : <FileSpreadsheet size={16} />} {busy ? "Working..." : "Export Excel"}
          </button>
          <label style={{ ...secondaryBtnStyle, display: "flex", alignItems: "center", gap: 6, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            <Upload size={16} /> {busy ? "Importing..." : "Import Excel/CSV"}
            <input type="file" accept=".csv,.xls,.xlsx" onChange={handleImportExcel} style={{ display: "none" }} disabled={busy} />
          </label>
        </div>
        {message && (
          <div style={{
            fontSize: "calc(12px * var(--app-font-scale, 1))", marginTop: 10, padding: "8px 12px", borderRadius: 8,
            background: message.startsWith("✅") ? "var(--success)18" : message.startsWith("⚠") ? "var(--warning)18" : "var(--danger)18",
            color: message.startsWith("✅") ? "var(--success)" : message.startsWith("⚠") ? "var(--warning)" : "var(--danger)",
            border: `1px solid ${message.startsWith("✅") ? "var(--success)" : message.startsWith("⚠") ? "var(--warning)" : "var(--danger)"}44`,
            whiteSpace: "pre-wrap",
          }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   Danger Zone Panel (requires password confirmation if enabled)
   ========================================================= */
function DangerZonePanel() {
  const { deleteAllData } = useDataStore();
  const { refreshPasswordStatus } = useAuth();
  const confirmDialog = useConfirm();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [passwordPrompt, setPasswordPrompt] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  const requestConfirmation = async (action: () => Promise<void>) => {
    const enabled = await api.isPasswordEnabled();
    if (enabled) {
      setPendingAction(() => action);
      setPasswordPrompt(true);
    } else {
      action();
    }
  };

  const confirmWithPassword = async () => {
    const valid = await api.verifyPassword(enteredPassword);
    if (!valid) { setMessage("Incorrect password."); return; }
    setPasswordPrompt(false);
    setEnteredPassword("");
    if (pendingAction) await pendingAction();
  };

  const handleDeleteAll = () => requestConfirmation(async () => {
    // Dialog واحد قوي بنمط "اكتب DELETE للتأكيد" بدل double window.confirm() الهش —
    // يمنع أي تنفيذ غير مقصود بضغطة واحدة، ويعمل بشكل مضمون 100% في كل بيئة
    // (بخلاف window.confirm الذي قد لا يعمل بشكل موثوق داخل Tauri WebView2 على ويندوز)
    const confirmed = await confirmDialog({
      title: "Delete All Data",
      message: "This will permanently delete ALL your expenses, categories, budgets, goals, and settings.\nThis action cannot be undone.",
      danger: true,
      typeToConfirm: "DELETE",
      confirmLabel: "Delete Everything",
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      await deleteAllData(); // الـ Store يعيد تحميل كل شيء تلقائياً، فالـ Sidebar وكل صفحة تتفرّغ فوراً
      await refreshPasswordStatus(); // حذف كل البيانات يصفّر إعدادات الأمان أيضاً
      setMessage("All data deleted.");
    } finally { setBusy(false); }
  });

  return (
    <div className="card" style={{ border: "1px solid var(--danger)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <AlertTriangle size={18} color="var(--danger)" />
        <h3 style={{ margin: 0, color: "var(--danger)" }}>Danger Zone</h3>
      </div>
      <p className="text-muted" style={{ fontSize: "calc(13px * var(--app-font-scale, 1))" }}>
        Permanently delete all expenses, categories, and settings. This cannot be undone.
        {" "}If password protection is enabled, you will be asked to confirm your password first.
      </p>

      {passwordPrompt && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            type="password" autoFocus placeholder="Enter your password to confirm"
            style={inputStyle} value={enteredPassword} onChange={(e) => setEnteredPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmWithPassword()}
          />
          <button onClick={confirmWithPassword} style={primaryBtnStyle}>Confirm</button>
          <button onClick={() => { setPasswordPrompt(false); setEnteredPassword(""); }} style={secondaryBtnStyle}>Cancel</button>
        </div>
      )}

      <button onClick={handleDeleteAll} disabled={busy} style={{ ...primaryBtnStyle, background: "var(--danger)" }}>
        Delete All Data
      </button>
      {message && <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", marginTop: 10 }}>{message}</div>}
    </div>
  );
}
