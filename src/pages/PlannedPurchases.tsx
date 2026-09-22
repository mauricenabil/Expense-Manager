import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Plus, ShoppingCart, Check, X, Trash2, AlertTriangle, RotateCcw, CalendarDays,
} from "lucide-react";
import { useDataStore } from "../store/DataStore";
import { useConfirm } from "../components/ConfirmDialog";
import {
  validatePlan, hasErrors, analyzeAffordability, summarizePlans, planScore,
  todayISO, daysBetween, type ValidationIssue,
} from "../lib/plannedAlgorithms";
import type { PlannedPurchase } from "../types";

const fmt = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} EGP`;
const PRIORITIES = [
  { value: 1, label: "Low" },
  { value: 2, label: "Normal" },
  { value: 3, label: "High" },
];

type Filter = "planned" | "purchased" | "cancelled";

export default function PlannedPurchases() {
  const {
    plannedPurchases, expenses, categories, paymentMethods,
    createPlannedPurchase, convertPlannedToExpense,
    cancelPlannedPurchase, restorePlannedPurchase, deletePlannedPurchase,
  } = useDataStore();
  const confirm = useConfirm();

  const [filter, setFilter] = useState<Filter>("planned");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [amountText, setAmountText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] = useState(2);
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);

  // حقل فارغ = "السعر غير محدّد"، وليس صفراً. التمييز مهم لأن الصفر
  // قيمة صالحة نحوياً لكنها ليست ما قصده المستخدم عندما ترك الحقل فارغاً.
  const amount = amountText.trim() === "" ? null : Number(amountText);

  const issues = useMemo(
    () => validatePlan(
      { name, estimated_amount: amount, target_date: targetDate || undefined, priority },
      plannedPurchases
    ),
    [name, amount, targetDate, priority, plannedPurchases]
  );
  const blocked = hasErrors(issues);

  const affordability = useMemo(
    () => (amount && amount > 0 ? analyzeAffordability(amount, targetDate || null, expenses) : null),
    [amount, targetDate, expenses]
  );

  const summary = useMemo(
    () => summarizePlans(plannedPurchases, expenses),
    [plannedPurchases, expenses]
  );

  const visible = useMemo(
    () => plannedPurchases
      .filter((p) => p.status === filter)
      .sort((a, b) => planScore(b) - planScore(a)),
    [plannedPurchases, filter]
  );

  function resetForm() {
    setName(""); setAmountText(""); setCategoryId(""); setPaymentMethodId("");
    setTargetDate(""); setPriority(2); setNotes(""); setTouched(false); setServerError(null);
  }

  async function save() {
    setTouched(true);
    if (blocked || saving) return;
    setSaving(true);
    setServerError(null);
    try {
      await createPlannedPurchase({
        name: name.trim(),
        estimated_amount: amount as number,
        category_id: categoryId || null,
        payment_method_id: paymentMethodId || null,
        target_date: targetDate || null,
        priority,
        notes: notes.trim() || null,
      });
      resetForm();
      setFormOpen(false);
    } catch (e) {
      setServerError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function markPurchased(plan: PlannedPurchase) {
    const ok = await confirm({
      title: "Add this to your expenses?",
      message: `"${plan.name}" will be recorded as an expense of ${fmt(plan.estimated_amount)} dated today. You can edit the amount afterwards from All Expenses.`,
      confirmLabel: "Record expense",
    });
    if (!ok) return;
    try {
      await convertPlannedToExpense(plan.id, todayISO(), null);
    } catch (e) {
      setServerError(String(e));
    }
  }

  const showIssue = (field: ValidationIssue["field"]) =>
    touched ? issues.find((i) => i.field === field) : undefined;

  return (
    <div className="route-transition">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Planned purchases</h1>
        <button
          className="btn-primary"
          onClick={() => { setFormOpen((o) => !o); if (formOpen) resetForm(); }}
          style={primaryBtn}
        >
          {formOpen ? <X size={15} /> : <Plus size={15} />}
          {formOpen ? "Close" : "Plan a purchase"}
        </button>
      </div>

      {/* ── ملخّص ─────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <Stat label="Active plans" value={String(summary.activeCount)} />
        <Stat label="Committed total" value={fmt(summary.activeTotal)} />
        <Stat
          label="Due within a week"
          value={String(summary.dueSoonCount)}
          tone={summary.dueSoonCount > 0 ? "warning" : undefined}
        />
        <Stat
          label="Past target date"
          value={String(summary.overdueCount)}
          tone={summary.overdueCount > 0 ? "danger" : undefined}
        />
      </div>

      {summary.estimateBias !== null && Math.abs(summary.estimateBias) > 0.08 && (
        <div style={insightBox} className="fade-in">
          <AlertTriangle size={15} color="var(--warning)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: "calc(13px * var(--app-font-scale, 1))" }}>
            Your purchases land about <span className="num">{Math.round(Math.abs(summary.estimateBias) * 100)}%</span>{" "}
            {summary.estimateBias > 0 ? "above" : "below"} the price you plan for. Worth adjusting your estimates.
          </span>
        </div>
      )}

      {/* ── نموذج الإضافة ─────────────────────────────────── */}
      {formOpen && (
        <div className="card fade-in" style={{ marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
            <Field label="What are you buying?" issue={showIssue("name")}>
              <input
                dir="auto" className="bidi-auto"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="Washing machine"
                style={{ ...inputStyle, ...(showIssue("name")?.level === "error" ? errorInput : {}) }}
              />
            </Field>

            <Field label="Price" issue={showIssue("amount")}>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="0.00"
                style={{ ...inputStyle, ...(showIssue("amount")?.level === "error" ? errorInput : {}) }}
              />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginTop: 14 }}>
            <Field label="Category">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={inputStyle}>
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>

            <Field label="Payment method">
              <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)} style={inputStyle}>
                <option value="">None</option>
                {paymentMethods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>

            <Field label="Target date" issue={showIssue("date")}>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                style={inputStyle}
              />
            </Field>

            <Field label="Priority">
              <div style={{ display: "flex", gap: 6 }}>
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    style={{ ...segBtn, ...(priority === p.value ? segBtnActive : {}) }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="Notes">
            <input
              dir="auto" className="bidi-auto"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              style={inputStyle}
            />
          </Field>

          {/* تحليل الأثر — يظهر لحظياً مع الكتابة، قبل الحفظ */}
          {affordability && (
            <div style={{ ...affordBox, borderColor: toneColor(affordability.level) }} className="fade-in">
              <span style={{ ...toneDot, background: toneColor(affordability.level) }} />
              <span style={{ fontSize: "calc(12.5px * var(--app-font-scale, 1))" }}>{affordability.message}</span>
            </div>
          )}

          {/* التحذيرات لا تمنع الحفظ */}
          {touched && issues.filter((i) => i.level === "warning").map((i, k) => (
            <div key={k} style={warnRow}>
              <AlertTriangle size={13} color="var(--warning)" />
              <span style={{ fontSize: "calc(12.5px * var(--app-font-scale, 1))" }}>{i.message}</span>
            </div>
          ))}

          {serverError && (
            <div style={{ ...warnRow, color: "var(--danger)" }}>
              <AlertTriangle size={13} color="var(--danger)" />
              <span style={{ fontSize: "calc(12.5px * var(--app-font-scale, 1))" }}>{serverError}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={save} disabled={saving || (touched && blocked)} style={{ ...primaryBtn, opacity: saving ? .6 : 1 }}>
              <Check size={15} /> {saving ? "Saving..." : "Save plan"}
            </button>
            <button onClick={() => { resetForm(); setFormOpen(false); }} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── التبويبات ─────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["planned", "purchased", "cancelled"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ ...segBtn, ...(filter === f ? segBtnActive : {}), textTransform: "capitalize" }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* ── القائمة ───────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "46px 22px" }}>
          <ShoppingCart size={26} color="var(--text-faint)" />
          <p className="text-muted" style={{ fontSize: "calc(13.5px * var(--app-font-scale, 1))", marginBottom: 0, marginTop: 12 }}>
            {filter === "planned"
              ? "Nothing planned yet. Add something you intend to buy and convert it when you do."
              : `No ${filter} plans.`}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map((p, i) => (
            <PlanRow
              key={p.id}
              plan={p}
              index={i}
              onPurchase={() => markPurchased(p)}
              onCancel={() => cancelPlannedPurchase(p.id)}
              onRestore={() => restorePlannedPurchase(p.id)}
              onDelete={async () => {
                const ok = await confirm({
                  title: "Delete this plan?",
                  message: `"${p.name}" will be removed. Any expense already created from it stays.`,
                  confirmLabel: "Delete",
                  danger: true,
                });
                if (ok) await deletePlannedPurchase(p.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* =================================================================== */

function PlanRow({
  plan, index, onPurchase, onCancel, onRestore, onDelete,
}: {
  plan: PlannedPurchase; index: number;
  onPurchase: () => void; onCancel: () => void; onRestore: () => void; onDelete: () => void;
}) {
  const days = plan.target_date ? daysBetween(todayISO(), plan.target_date) : null;
  const overdue = days !== null && days < 0 && plan.status === "planned";
  const soon = days !== null && days >= 0 && days <= 7 && plan.status === "planned";

  return (
    <div
      className="card stagger-item"
      style={{ ...rowCard, "--stagger-index": index } as CSSProperties}
    >
      <span style={{ ...priorityBar, background: priorityColor(plan.priority) }} />

      <div className="mixed-row" style={{ flex: 1, alignItems: "center" }}>
        <div className="mixed-row-text">
          <div dir="auto" className="bidi-auto" style={{ fontWeight: 600, fontSize: "calc(14.5px * var(--app-font-scale, 1) * var(--ar-font-scale, 1))" }}>{plan.name}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 3 }}>
            {plan.category_name && (
              <span dir="auto" className="text-muted bidi-auto" style={metaText}>{plan.category_name}</span>
            )}
            {plan.payment_method_name && (
              <span className="text-muted" style={metaText}>{plan.payment_method_name}</span>
            )}
            {plan.target_date && (
              <span style={{ ...metaText, display: "flex", alignItems: "center", gap: 4,
                color: overdue ? "var(--danger)" : soon ? "var(--warning)" : "var(--text-muted)" }}>
                <CalendarDays size={11} />
                {overdue ? `${Math.abs(days!)} days overdue` : days === 0 ? "Today" : `In ${days} days`}
              </span>
            )}
            {plan.notes && <span dir="auto" className="text-muted bidi-auto" style={metaText}>{plan.notes}</span>}
          </div>
        </div>

        <div className="mixed-row-value" style={{ textAlign: "end" }}>
          <div style={{ fontWeight: 700, fontSize: "calc(15px * var(--app-font-scale, 1) * var(--num-font-scale, 1))" }}>{fmt(plan.estimated_amount)}</div>
          {plan.status === "purchased" && (
            <div style={{ ...metaText, color: "var(--success)" }}>Recorded</div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexShrink: 0, marginInlineStart: 14 }}>
        {plan.status === "planned" && (
          <>
            <button onClick={onPurchase} style={primaryBtnSm} title="Record this as a real expense">
              <ShoppingCart size={13} /> Bought it
            </button>
            <button onClick={onCancel} style={iconBtn} title="Cancel this plan"><X size={14} /></button>
          </>
        )}
        {plan.status === "cancelled" && (
          <button onClick={onRestore} style={iconBtn} title="Move back to active plans">
            <RotateCcw size={14} />
          </button>
        )}
        {plan.status !== "purchased" && (
          <button onClick={onDelete} style={{ ...iconBtn, color: "var(--danger)" }} title="Delete">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, issue }: { label: string; children: ReactNode; issue?: ValidationIssue }) {
  return (
    <div style={{ marginTop: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {issue && (
        <div style={{ fontSize: "calc(11.5px * var(--app-font-scale, 1))", marginTop: 5, color: issue.level === "error" ? "var(--danger)" : "var(--warning)" }}>
          {issue.message}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warning" | "danger" }) {
  return (
    <div className="card">
      <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))" }}>{label}</div>
      <div className={/\d/.test(value) ? "num" : undefined} style={{
        fontWeight: 700,
        fontSize: /\d/.test(value)
          ? "calc(18px * var(--app-font-scale, 1) * var(--num-font-scale, 1))"
          : "calc(18px * var(--app-font-scale, 1))",
        marginTop: 4,
        color: tone === "danger" ? "var(--danger)" : tone === "warning" ? "var(--warning)" : "var(--text)",
      }}>
        {value}
      </div>
    </div>
  );
}

const toneColor = (l: "comfortable" | "noticeable" | "heavy") =>
  l === "heavy" ? "var(--danger)" : l === "noticeable" ? "var(--warning)" : "var(--success)";

const priorityColor = (p: number) =>
  p === 3 ? "var(--coral)" : p === 2 ? "var(--accent)" : "var(--border-strong)";

/* --- styles --- */
const rowCard: CSSProperties = {
  display: "flex", alignItems: "center", padding: "14px 16px", position: "relative", overflow: "hidden",
};
const priorityBar: CSSProperties = {
  position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 3,
};
const metaText: CSSProperties = { fontSize: "calc(11.5px * var(--app-font-scale, 1))" };
const labelStyle: CSSProperties = {
  display: "block", fontSize: "calc(12px * var(--app-font-scale, 1))", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6,
};
const inputStyle: CSSProperties = {
  width: "100%", padding: "9px 12px", background: "var(--surface-sunken)",
  border: "1px solid var(--border)", color: "var(--text)", fontSize: "calc(13.5px * var(--app-font-scale, 1))",
};
const errorInput: CSSProperties = { borderColor: "var(--danger)" };
const primaryBtn: CSSProperties = {
  display: "flex", alignItems: "center", gap: 7, background: "var(--accent)",
  color: "var(--on-accent)", border: "none", borderRadius: "var(--radius-sm)",
  padding: "9px 16px", fontSize: "calc(13.5px * var(--app-font-scale, 1))", fontWeight: 600, cursor: "pointer",
};
const primaryBtnSm: CSSProperties = { ...primaryBtn, padding: "6px 12px", fontSize: "calc(12.5px * var(--app-font-scale, 1))" };
const ghostBtn: CSSProperties = {
  background: "var(--surface-hover)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)", padding: "9px 16px", fontSize: "calc(13.5px * var(--app-font-scale, 1))",
  cursor: "pointer", color: "var(--text)",
};
const iconBtn: CSSProperties = {
  background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: 8,
  width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", color: "var(--text-muted)",
};
const segBtn: CSSProperties = {
  flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface-hover)", color: "var(--text-muted)", fontSize: "calc(12.5px * var(--app-font-scale, 1))", cursor: "pointer",
};
const segBtnActive: CSSProperties = {
  background: "var(--accent)", color: "var(--on-accent)", borderColor: "var(--accent)", fontWeight: 600,
};
const affordBox: CSSProperties = {
  display: "flex", alignItems: "center", gap: 9, marginTop: 16, padding: "10px 13px",
  borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)", border: "1px solid var(--border)",
};
const toneDot: CSSProperties = { width: 8, height: 8, borderRadius: 99, flexShrink: 0 };
const warnRow: CSSProperties = {
  display: "flex", alignItems: "center", gap: 7, marginTop: 9, color: "var(--warning)",
};
const insightBox: CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", marginBottom: 20,
  borderRadius: "var(--radius-sm)", background: "var(--warning-soft)", border: "1px solid var(--border)",
};
