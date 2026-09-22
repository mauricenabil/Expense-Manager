import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Trophy, X } from "lucide-react";
import { useDropdown } from "../lib/useDropdown";
import DropdownPortal from "../components/DropdownPortal";
import { weekdayLabels } from "../lib/dateRanges";
import { useWeekStart } from "../context/WeekStartContext";
import { useHeatInk, FALLBACK_INK } from "../lib/useHeatInk";
import { useDataStore } from "../store/DataStore";
import type { ExpenseWithDetails } from "../types";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const PANEL_WIDTH = 320;
const EXIT_MS = 220;   // لازم يطابق --motion-base في theme.css

export default function CalendarPage() {
  const { weekStart } = useWeekStart();
  const { expenses } = useDataStore();
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const picker = useDropdown<HTMLButtonElement>();

  /* اللوحة الجانبية كانت تظهر وتختفي فوراً لأنها مربوطة بـ selectedDay
     مباشرة: React يفصل العنصر من الـ DOM قبل أي أنيميشن خروج.
     الحل: حالة عرض منفصلة تتأخّر عن الإغلاق بمقدار مدة الأنيميشن. */
  const [panelDay, setPanelDay] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const exitTimer = useRef<number | null>(null);

  useEffect(() => {
    if (exitTimer.current) { window.clearTimeout(exitTimer.current); exitTimer.current = null; }

    if (selectedDay) {
      setClosing(false);
      setPanelDay(selectedDay);
    } else if (panelDay) {
      setClosing(true);
      exitTimer.current = window.setTimeout(() => {
        setPanelDay(null);
        setClosing(false);
      }, EXIT_MS);
    }

    return () => { if (exitTimer.current) window.clearTimeout(exitTimer.current); };
    // panelDay مستثنى عمداً: إدراجه يعيد تشغيل الأنيميشن عند كل تغيير يوم
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  // Escape يغلق اللوحة — سلوك متوقّع من أي لوحة جانبية
  useEffect(() => {
    if (!selectedDay) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedDay(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedDay]);

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

  // أعلى يوم صرفاً = اليوم صاحب أكبر إجمالي، وليس أكبر مصروف مفرد.
  const highestDay = useMemo(() => {
    const totals = new Map<string, number>();
    monthExpenses.forEach((e) => totals.set(e.date, (totals.get(e.date) ?? 0) + e.amount));
    let best: { date: string; amount: number } | null = null;
    for (const [date, amount] of totals) {
      if (!best || amount > best.amount || (amount === best.amount && date < best.date)) best = { date, amount };
    }
    return best;
  }, [monthExpenses]);

  const topCategory = useMemo(() => {
    const map = new Map<string, number>();
    monthExpenses.forEach((e) => { const k = e.category_name || "Uncategorized"; map.set(k, (map.get(k) || 0) + e.amount); });
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? { name: sorted[0][0], amount: sorted[0][1] } : null;
  }, [monthExpenses]);

  const firstDayOfWeek = (new Date(year, month, 1).getDay() - weekStart + 7) % 7;
  const cells: (number | null)[] = [...Array(firstDayOfWeek).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const levelFor = (total: number) => total === 0 ? "none" : total < 100 ? "low" : total < 400 ? "medium" : "high";
  const LEVEL_VARS: Record<string, string> = { none: "--heat-0", low: "--heat-1", medium: "--heat-2", high: "--heat-4" };
  const levelColors: Record<string, string> = { none: "var(--heat-0)", low: "var(--heat-1)", medium: "var(--heat-2)", high: "var(--heat-4)" };

  /* ألوان نص البطاقة محسوبة من لون خلفيتها الفعلي بدل ألوان ثابتة:
     رقم المبلغ كان مكتوباً بـ var(--accent) — وهو أخضر — فوق درجة حرارة
     خضراء (--heat-1)، ورقم اليوم بـ var(--text-muted) فوق درجات فاتحة،
     والاتنين كانوا بيختفوا حسب الدرجة والثيم. دلوقتي الحبر بيتقلب
     تلقائياً لأغمق/أفتح حسب أي خلفية تحته. */
  const heatInk = useHeatInk(LEVEL_VARS);

  const fmt = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} EGP`;
  const dateKey = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const years = Array.from({ length: 41 }, (_, i) => new Date().getFullYear() - 20 + i);

  return (
    <div className="route-transition">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Calendar</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={iconBtnStyle} onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
          <button ref={picker.triggerRef} onClick={picker.toggle} style={monthLabelBtn}>{MONTH_NAMES[month]} {year}</button>
          <button style={iconBtnStyle} onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month"><ChevronRight size={16} /></button>

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

      {/* البطاقات العلوية ثابتة العرض مهما فتحت اللوحة الجانبية */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
        <StatCard label="Total Spending" value={fmt(totalSpending)} />
        <StatCard label="Days Spent" value={String(daysSpent)} />
        <StatCard label="No-Spend Days" value={String(noSpendDays)} />
        <StatCard
          label="Highest Day"
          value={highestDay ? fmt(highestDay.amount) : "—"}
          sub={highestDay ? `${MONTH_NAMES[month].slice(0, 3)} ${Number(highestDay.date.slice(8, 10))}` : undefined}
        />
        <StatCard label="Top Category" value={topCategory ? topCategory.name : "—"} icon={<Trophy size={14} color="var(--accent)" />} />
      </div>

      <div className="calendar-split">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 8 }}>
              {weekdayLabels(weekStart).map((d) => (
                <div key={d} className="text-muted" style={{ textAlign: "center", fontSize: "calc(12px * var(--app-font-scale, 1))", fontWeight: 600 }}>{d}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const key = dateKey(day);
                const dayExpenses = byDay.get(key) ?? [];
                const total = dayExpenses.reduce((s, e) => s + e.amount, 0);
                const level = levelFor(total);
                const isSelected = selectedDay === key;
                const ink = heatInk[level] ?? FALLBACK_INK;
                return (
                  <button
                    key={i}
                    // الضغط على اليوم المفتوح يغلق اللوحة — تبديل بدل فتح فقط
                    onClick={() => setSelectedDay(isSelected ? null : key)}
                    className="calendar-cell"
                    aria-pressed={isSelected}
                    style={{
                      aspectRatio: "0.95", borderRadius: 10,
                      border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border)",
                      background: levelColors[level], cursor: "pointer", display: "flex", flexDirection: "column",
                      alignItems: "flex-start", justifyContent: "space-between", color: ink.fg, padding: "8px 8px 6px",
                    }}
                  >
                    <span className="num" style={{ fontSize: "calc(13px * var(--app-font-scale, 1) * var(--num-font-scale, 1))", fontWeight: 700, color: ink.fgMuted }}>{day}</span>
                    <div style={{ width: "100%" }}>
                      {total > 0 ? (
                        <>
                          <div className="num" style={{ fontSize: "calc(15px * var(--app-font-scale, 1) * var(--num-font-scale, 1))", fontWeight: 800, color: ink.fg, lineHeight: 1.1 }}>
                            {Math.round(total)}
                          </div>
                          <div style={{ fontSize: "calc(10px * var(--app-font-scale, 1))", marginTop: 2, color: ink.fgMuted }}>
                            {dayExpenses.length} item{dayExpenses.length > 1 ? "s" : ""}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: "calc(10px * var(--app-font-scale, 1))", color: ink.fgMuted }}>—</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: "calc(11px * var(--app-font-scale, 1))" }} className="text-muted">
              <Legend color={levelColors.none} label="No spending" />
              <Legend color={levelColors.low} label="Low" />
              <Legend color={levelColors.medium} label="Medium" />
              <Legend color={levelColors.high} label="High" />
            </div>
          </div>
        </div>

        {/* العمود يتمدّد بعرض متحرّك، واللوحة بداخله تنزلق — الحركتان
            معاً تمنعان "القفزة" التي كانت تحدث سابقاً. */}
        <div
          className="calendar-side-slot"
          style={{ width: selectedDay ? PANEL_WIDTH : 0 }}
          aria-hidden={!selectedDay}
        >
          {panelDay && (
            <DayPanel
              key={panelDay}
              dateISO={panelDay}
              expenses={byDay.get(panelDay) ?? []}
              closing={closing}
              width={PANEL_WIDTH}
              onClose={() => setSelectedDay(null)}
              fmt={fmt}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================================================================
   اللوحة الجانبية لليوم
   إصلاح العربي: كل صف الآن في سياق اتجاه ثابت (mixed-row)، فالاسم
   العربي يُعرض من اليمين لليسار داخل خانته بينما يظل المبلغ في مكانه
   على اليمين دائماً. قبل هذا كان المتصفح يضم المبلغ لسياق النص العربي
   فينقلب ترتيب الصف كله حسب أول حرف في اسم المصروف.
   =================================================================== */
function DayPanel({
  dateISO, expenses, closing, width, onClose, fmt,
}: {
  dateISO: string;
  expenses: ExpenseWithDetails[];
  closing: boolean;
  width: number;
  onClose: () => void;
  fmt: (n: number) => string;
}) {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const largest = expenses.reduce(
    (max, e) => (e.amount > (max?.amount ?? 0) ? e : max),
    null as ExpenseWithDetails | null
  );

  const [y, m, d] = dateISO.split("-").map(Number);
  const weekday = DAY_NAMES[new Date(y, m - 1, d).getDay()];

  return (
    <div
      className={`card ${closing ? "side-panel-exit" : "side-panel-enter"}`}
      style={{ width, alignSelf: "flex-start", padding: 18 }}
      role="region"
      aria-label={`Expenses on ${dateISO}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "calc(17px * var(--app-font-scale, 1))" }}>{d} {MONTH_NAMES[m - 1]}</h3>
          <div className="text-muted" style={{ fontSize: "calc(11.5px * var(--app-font-scale, 1))" }}>{weekday} {y}</div>
        </div>
        <button onClick={onClose} style={closeBtn} aria-label="Close"><X size={14} /></button>
      </div>

      <div style={totalBox}>
        <div className="text-muted" style={{ fontSize: "calc(11px * var(--app-font-scale, 1))" }}>Total</div>
        <div className="num" style={{ fontSize: "calc(20px * var(--app-font-scale, 1) * var(--num-font-scale, 1))", fontWeight: 700, marginTop: 2 }}>{fmt(total)}</div>
        <div className="text-muted" style={{ fontSize: "calc(11.5px * var(--app-font-scale, 1))", marginTop: 2 }}>
          {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
        </div>
      </div>

      {largest && expenses.length > 1 && (
        <div className="mixed-row" style={{ marginTop: 12, fontSize: "calc(12px * var(--app-font-scale, 1))" }}>
          <span dir="auto" className="mixed-row-text text-muted">Largest: <span dir="auto" className="bidi-auto">{largest.name}</span></span>
          <span className="mixed-row-value text-muted num">{fmt(largest.amount)}</span>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {expenses.map((e, i) => (
          <div
            key={e.id}
            className="mixed-row stagger-item"
            style={{
              padding: "10px 0",
              borderTop: "1px solid var(--border)",
              "--stagger-index": i,
            } as CSSProperties}
          >
            <div className="mixed-row-text">
              <div dir="auto" className="bidi-auto" style={{ fontSize: "calc(13.5px * var(--app-font-scale, 1) * var(--ar-font-scale, 1))", fontWeight: 500 }}>{e.name}</div>
              {e.category_name && (
                <div dir="auto" className="bidi-auto text-muted" style={{ fontSize: "calc(11px * var(--app-font-scale, 1) * var(--ar-font-scale, 1))" }}>{e.category_name}</div>
              )}
            </div>
            <div className="mixed-row-value" style={{ fontSize: "calc(13px * var(--app-font-scale, 1) * var(--num-font-scale, 1))", fontWeight: 600 }}>{fmt(e.amount)}</div>
          </div>
        ))}

        {expenses.length === 0 && (
          <p className="text-muted" style={{ fontSize: "calc(13px * var(--app-font-scale, 1))", marginTop: 4 }}>
            Nothing recorded on this day.
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, sub }: { label: string; value: string; icon?: ReactNode; sub?: string }) {
  return (
    <div className="card">
      <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", display: "flex", alignItems: "center", gap: 5 }}>{icon}{label}</div>
      <div
        dir="auto"
        className={/\d/.test(value) ? "num" : "bidi-auto"}
        style={{
          fontWeight: 700,
          // إجمالي/عدد = رقم، أما "Top Category" فاسم فئة قد يكون عربياً
          fontSize: /\d/.test(value)
            ? "calc(16px * var(--app-font-scale, 1) * var(--num-font-scale, 1))"
            : "calc(16px * var(--app-font-scale, 1) * var(--ar-font-scale, 1))",
          marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >{value}</div>
      {sub && <div className="text-muted" style={{ fontSize: "calc(11px * var(--app-font-scale, 1))", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: color }} /> {label}</span>;
}

const iconBtnStyle: CSSProperties = { background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text)" };
const monthLabelBtn: CSSProperties = { fontWeight: 600, minWidth: 140, textAlign: "center", background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", color: "var(--text)" };
const pickerPopupStyle: CSSProperties = { padding: 14 };
const pickerItemStyle: CSSProperties = { padding: "6px 4px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-hover)", color: "var(--text)", fontSize: "calc(12px * var(--app-font-scale, 1))", cursor: "pointer" };
const pickerItemActiveStyle: CSSProperties = { background: "var(--accent)", color: "var(--on-accent)", borderColor: "var(--accent)" };
const closeBtn: CSSProperties = { background: "var(--surface-hover)", border: "1px solid var(--border)", borderRadius: 8, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 };
const totalBox: CSSProperties = { marginTop: 14, padding: "12px 14px", borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)", border: "1px solid var(--border)" };
