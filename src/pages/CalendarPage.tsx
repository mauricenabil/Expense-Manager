import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { useDropdown } from "../lib/useDropdown";
import DropdownPortal from "../components/DropdownPortal";
import { weekdayLabels } from "../lib/dateRanges";
import { useWeekStart } from "../context/WeekStartContext";
import { useDataStore } from "../store/DataStore";
import type { ExpenseWithDetails } from "../types";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function CalendarPage() {
  const { weekStart } = useWeekStart();
  const { expenses } = useDataStore();
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const picker = useDropdown<HTMLButtonElement>();

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const byDay = useMemo(() => {
    const map = new Map<string, ExpenseWithDetails[]>();
    expenses.forEach((e) => { if (!map.has(e.date)) map.set(e.date, []); map.get(e.date)!.push(e); });
    return map;
  }, [expenses]);

  const monthExpenses = useMemo(
    () => expenses.filter((e) => { const d = new Date(e.date); return d.getFullYear() === year && d.getMonth() === month; }),
    [expenses, year, month]
  );

  const totalSpending = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const daysSpent = new Set(monthExpenses.map((e) => e.date)).size;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const noSpendDays = daysInMonth - daysSpent;
  const highestDay = monthExpenses.reduce((max, e) => (e.amount > (max?.amount ?? 0) ? e : max), null as ExpenseWithDetails | null);

  const topCategory = useMemo(() => {
    const map = new Map<string, number>();
    monthExpenses.forEach((e) => { const k = e.category_name || "Uncategorized"; map.set(k, (map.get(k) || 0) + e.amount); });
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? { name: sorted[0][0], amount: sorted[0][1] } : null;
  }, [monthExpenses]);

  const firstDayOfWeek = (new Date(year, month, 1).getDay() - weekStart + 7) % 7;
  const cells: (number | null)[] = [...Array(firstDayOfWeek).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const levelFor = (total: number) => total === 0 ? "none" : total < 100 ? "low" : total < 400 ? "medium" : "high";
  const levelColors: Record<string, string> = { none: "var(--surface-hover)", low: "#4DA3FF55", medium: "#FFC10788", high: "#F87171AA" };

  const fmt = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} EGP`;
  const dateKey = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const selectedExpenses = selectedDay ? byDay.get(selectedDay) ?? [] : [];
  const selectedTotal = selectedExpenses.reduce((s, e) => s + e.amount, 0);
  const selectedTop = selectedExpenses.reduce((max, e) => (e.amount > (max?.amount ?? 0) ? e : max), null as ExpenseWithDetails | null);

  const years = Array.from({ length: 41 }, (_, i) => new Date().getFullYear() - 20 + i);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Calendar</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={iconBtnStyle} onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button>
          <button ref={picker.triggerRef} onClick={picker.toggle} style={{ ...monthLabelBtn }}>{MONTH_NAMES[month]} {year}</button>
          <button style={iconBtnStyle} onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>

          <DropdownPortal anchorRef={picker.triggerRef} menuRef={picker.menuRef} open={picker.open} width={260} align="right">
            <div className="card" style={pickerPopupStyle}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 10 }}>
                {MONTH_NAMES.map((m, i) => (
                  <button
                    key={m}
                    onClick={() => { setCursor(new Date(year, i, 1)); picker.setOpen(false); }}
                    style={{ ...pickerItemStyle, ...(i === month ? pickerItemActiveStyle : {}) }}
                  >
                    {m.slice(0, 3)}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, maxHeight: 160, flexWrap: "wrap", overflowY: "auto" }}>
                {years.map((y) => (
                  <button
                    key={y}
                    onClick={() => setCursor(new Date(y, month, 1))}
                    style={{ ...pickerItemStyle, ...(y === year ? pickerItemActiveStyle : {}), flexShrink: 0 }}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          </DropdownPortal>
        </div>
      </div>

      {/* Top Stats — never shrink, fixed grid regardless of side panel */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
        <StatCard label="Total Spending" value={fmt(totalSpending)} />
        <StatCard label="Days Spent" value={String(daysSpent)} />
        <StatCard label="No-Spend Days" value={String(noSpendDays)} />
        <StatCard label="Highest Day" value={highestDay ? fmt(highestDay.amount) : "—"} />
        <StatCard label="Top Category" value={topCategory ? topCategory.name : "—"} icon={<Trophy size={14} color="var(--accent)" />} />
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 8 }}>
              {weekdayLabels(weekStart).map((d) => (
                <div key={d} className="text-muted" style={{ textAlign: "center", fontSize: 12, fontWeight: 600 }}>{d}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const key = dateKey(day);
                const dayExpenses = byDay.get(key) ?? [];
                const total = dayExpenses.reduce((s, e) => s + e.amount, 0);
                const level = levelFor(total);
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(key)}
                    className="calendar-cell"
                    style={{
                      aspectRatio: "0.95", borderRadius: 10, border: selectedDay === key ? "2px solid var(--accent)" : "1px solid var(--border)",
                      background: levelColors[level], cursor: "pointer", display: "flex", flexDirection: "column",
                      alignItems: "flex-start", justifyContent: "space-between", color: "var(--text)", padding: "8px 8px 6px",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>{day}</span>
                    <div style={{ width: "100%" }}>
                      {total > 0 ? (
                        <>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--accent)", lineHeight: 1.1 }}>{Math.round(total)}</div>
                          <div style={{ fontSize: 10, marginTop: 2 }} className="text-muted">
                            {dayExpenses.length} item{dayExpenses.length > 1 ? "s" : ""}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 10 }} className="text-muted">—</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: 11 }} className="text-muted">
              <Legend color={levelColors.none} label="No spending" />
              <Legend color={levelColors.low} label="Low" />
              <Legend color={levelColors.medium} label="Medium" />
              <Legend color={levelColors.high} label="High" />
            </div>
          </div>
        </div>

        {/* Side panel appears ONLY beside the calendar, top cards stay fixed */}
        {selectedDay && (
          <div className="card" style={{ width: 300, flexShrink: 0, alignSelf: "flex-start" }}>
            <h3 style={{ marginTop: 0 }}>{selectedDay}</h3>
            <div className="text-muted" style={{ fontSize: 13, marginBottom: 10 }}>
              Total: <strong style={{ color: "var(--text)" }}>{fmt(selectedTotal)}</strong> · {selectedExpenses.length} expense(s)
            </div>
            {selectedTop && (
              <div className="text-muted" style={{ fontSize: 13, marginBottom: 10 }}>Largest: {selectedTop.name} ({fmt(selectedTop.amount)})</div>
            )}
            {selectedExpenses.map((e) => (
              <div key={e.id} style={{ padding: "8px 0", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                <span className="bidi-auto" style={{ fontSize: 13 }}>{e.name}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(e.amount)}</span>
              </div>
            ))}
            {selectedExpenses.length === 0 && <p className="text-muted" style={{ fontSize: 13 }}>No expenses on this day.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="card">
      <div className="text-muted" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>{icon}{label}</div>
      <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: color }} /> {label}</span>;
}

const iconBtnStyle: CSSProperties = { background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text)" };
const monthLabelBtn: CSSProperties = { fontWeight: 600, minWidth: 140, textAlign: "center", background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", color: "var(--text)" };
const pickerPopupStyle: CSSProperties = { padding: 14 };
const pickerItemStyle: CSSProperties = { padding: "6px 4px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-hover)", color: "var(--text)", fontSize: 12, cursor: "pointer" };
const pickerItemActiveStyle: CSSProperties = { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" };
