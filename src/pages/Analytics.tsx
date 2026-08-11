import { useMemo, useState, useRef, type RefObject, type CSSProperties, type ReactNode } from "react";
import { useDataStore } from "../store/DataStore";
import type { ExpenseWithDetails } from "../types";
import { ProBarChart, ProDonutChart, ProDailyAreaChart, ProCategoryTrend, ProWeekdayChart, ProHeatmap } from "../components/ChartsPro";
import RangeFilterDropdown from "../components/RangeFilterDropdown";
import DropdownPortal from "../components/DropdownPortal";
import { useDropdown } from "../lib/useDropdown";
import { resolveDateRange, isWithinRange, buildDailyTimeline, type DateFilterValue, type RangeKey } from "../lib/dateRanges";
import { MONTHLY_RANGE_OPTIONS } from "../lib/dateRanges";
import { useWeekStart } from "../context/WeekStartContext";
import {
  TrendingUp, TrendingDown, Minus, ShoppingBag, Calendar, Tag, Calculator, Activity, Flame, Download,
} from "lucide-react";

/* =========================================================
   Helpers
   ========================================================= */
const fmt = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} EGP`;

function filterExpenses(expenses: ExpenseWithDetails[], filter: DateFilterValue, weekStart: number) {
  const r = resolveDateRange(filter, weekStart as 0 | 1 | 6);
  return expenses.filter((e) => isWithinRange(e.date, r.from, r.to));
}

function groupByCategory(list: ExpenseWithDetails[]) {
  const map = new Map<string, number>();
  list.forEach((e) => { const k = e.category_name || "Uncategorized"; map.set(k, (map.get(k) || 0) + e.amount); });
  return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function groupByPayment(list: ExpenseWithDetails[]) {
  const map = new Map<string, number>();
  list.forEach((e) => { const k = e.payment_method_name || "Unspecified"; map.set(k, (map.get(k) || 0) + e.amount); });
  return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
}

/** الفترة السابقة المقابلة بنفس الطول (للمقارنة) */
function getPreviousPeriod(filter: DateFilterValue, weekStart: number): { from: string | null; to: string | null } {
  const r = resolveDateRange(filter, weekStart as 0 | 1 | 6);
  if (!r.from || !r.to) return { from: null, to: null };
  const from = new Date(r.from), to = new Date(r.to);
  const length = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - length);
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

/* =========================================================
   Comparison Badge — الألوان تعتمد على المعنى الدلالي للمقياس
   spending↑ = أحمر (سيء)، spending↓ = أخضر (جيد)
   ========================================================= */
type MetricSentiment = "spending" | "savings" | "neutral";

function ComparisonBadge({ change, sentiment = "spending", suffix = "vs prev. period" }: {
  change: number | null;
  sentiment?: MetricSentiment;
  suffix?: string;
}) {
  if (change === null) return null;
  const absChange = Math.abs(Math.round(change));
  const up = change > 0;
  const flat = Math.abs(change) < 0.5;

  // الألوان الدلالية: spending↑ = أحمر، spending↓ = أخضر. savings: العكس.
  let color: string;
  if (flat) {
    color = "var(--text-muted)";
  } else if (sentiment === "spending") {
    color = up ? "var(--danger)" : "var(--success)";
  } else if (sentiment === "savings") {
    color = up ? "var(--success)" : "var(--danger)";
  } else {
    color = "var(--text-muted)";
  }

  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
      <Icon size={12} color={color} />
      <span style={{ fontSize: 11, color, fontWeight: 600 }}>
        {flat ? "No change" : `${up ? "+" : "-"}${absChange}%`}
      </span>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{suffix}</span>
    </div>
  );
}

/* =========================================================
   Summary Card
   ========================================================= */
function SummaryCard({ icon, label, value, change, sentiment = "spending", suffix }: {
  icon: ReactNode;
  label: string;
  value: string;
  change: number | null;
  sentiment?: MetricSentiment;
  suffix?: string;
}) {
  return (
    <div className="card kpi-card-in" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ color: "var(--accent)", display: "flex" }}>{icon}</div>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      <ComparisonBadge change={change} sentiment={sentiment} suffix={suffix} />
    </div>
  );
}

/* =========================================================
   Chart Card wrapper
   ========================================================= */
function ChartCard({ title, children, filter, onFilter, filterOptions }: {
  title: string;
  children: ReactNode;
  filter?: DateFilterValue;
  onFilter?: (v: DateFilterValue) => void;
  filterOptions?: { key: RangeKey; label: string }[];
}) {
  return (
    <div className="card fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3>
        {filter && onFilter && <RangeFilterDropdown value={filter} onChange={onFilter} compact options={filterOptions} />}
      </div>
      {children}
    </div>
  );
}

/* =========================================================
   Main Analytics Page
   ========================================================= */
export default function Analytics() {
  const { weekStart } = useWeekStart();
  const { expenses, budgets, budgetsEnabled } = useDataStore();
  const pageRef = useRef<HTMLDivElement>(null);

  // --- Global filter (affects Summary Cards + all charts by default) ---
  const [globalFilter, setGlobalFilter] = useState<DateFilterValue>({ range: "month" });

  // --- Individual chart filters ---
  const [monthlyFilter, setMonthlyFilter] = useState<DateFilterValue>({ range: "year" }); // Monthly Trend الخاص
  const [dailyFilter, setDailyFilter] = useState<DateFilterValue>({ range: "month" });
  const [categoryFilter, setCategoryFilter] = useState<DateFilterValue>({ range: "month" });
  const [breakdownFilter, setBreakdownFilter] = useState<DateFilterValue>({ range: "month" });
  const [comparisonFilter, setComparisonFilter] = useState<DateFilterValue>({ range: "month" });

  // تغيير الفلتر العام يحدّث كل الفلاتر الفردية دفعة واحدة
  const applyGlobal = (v: DateFilterValue) => {
    setGlobalFilter(v);
    setDailyFilter(v);
    setCategoryFilter(v);
    setBreakdownFilter(v);
    setComparisonFilter(v);
  };

  // --- Filtered expense sets ---
  const globalExp = useMemo(() => filterExpenses(expenses, globalFilter, weekStart), [expenses, globalFilter, weekStart]);
  const prevExp = useMemo(() => {
    const prev = getPreviousPeriod(globalFilter, weekStart);
    return expenses.filter((e) => isWithinRange(e.date, prev.from, prev.to));
  }, [expenses, globalFilter, weekStart]);

  const dailyExp = useMemo(() => filterExpenses(expenses, dailyFilter, weekStart), [expenses, dailyFilter, weekStart]);
  const categoryExp = useMemo(() => filterExpenses(expenses, categoryFilter, weekStart), [expenses, categoryFilter, weekStart]);
  const breakdownExp = useMemo(() => filterExpenses(expenses, breakdownFilter, weekStart), [expenses, breakdownFilter, weekStart]);

  // --- Summary Card computations ---
  const totalSpending = globalExp.reduce((s, e) => s + e.amount, 0);
  const prevTotal = prevExp.reduce((s, e) => s + e.amount, 0);
  const spendingChange = prevTotal > 0 ? ((totalSpending - prevTotal) / prevTotal) * 100 : null;

  const totalTx = globalExp.length;
  const prevTx = prevExp.length;
  const txChange = prevTx > 0 ? ((totalTx - prevTx) / prevTx) * 100 : null;

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    globalExp.forEach((e) => map.set(e.date, (map.get(e.date) || 0) + e.amount));
    return map;
  }, [globalExp]);

  const highestDayEntry = useMemo(() => {
    let max = 0, day = "";
    byDay.forEach((v, k) => { if (v > max) { max = v; day = k; } });
    return { date: day, amount: max };
  }, [byDay]);

  const prevByDay = useMemo(() => {
    const map = new Map<string, number>();
    prevExp.forEach((e) => map.set(e.date, (map.get(e.date) || 0) + e.amount));
    return map;
  }, [prevExp]);

  const prevHighestDay = useMemo(() => {
    let max = 0;
    prevByDay.forEach((v) => { if (v > max) max = v; });
    return max;
  }, [prevByDay]);

  const highestDayChange = prevHighestDay > 0 ? ((highestDayEntry.amount - prevHighestDay) / prevHighestDay) * 100 : null;

  const byCat = useMemo(() => groupByCategory(globalExp), [globalExp]);
  const topCat = byCat[0];
  const prevByCat = useMemo(() => groupByCategory(prevExp), [prevExp]);
  const prevTopCatAmount = prevByCat.find((c) => c.label === topCat?.label)?.value ?? 0;
  const topCatChange = prevTopCatAmount > 0 && topCat ? ((topCat.value - prevTopCatAmount) / prevTopCatAmount) * 100 : null;

  const avgExpense = totalTx > 0 ? totalSpending / totalTx : 0;
  const prevAvg = prevTx > 0 ? prevTotal / prevTx : 0;
  const avgChange = prevAvg > 0 ? ((avgExpense - prevAvg) / prevAvg) * 100 : null;

  const daysInPeriod = useMemo(() => {
    const r = resolveDateRange(globalFilter, weekStart as 0 | 1 | 6);
    if (!r.from || !r.to) {
      const dates = globalExp.map((e) => e.date).sort();
      if (dates.length < 2) return 1;
      return Math.max(1, Math.round((new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / 86400000) + 1);
    }
    return Math.max(1, Math.round((new Date(r.to).getTime() - new Date(r.from).getTime()) / 86400000) + 1);
  }, [globalFilter, globalExp, weekStart]);

  const dailyAvg = totalSpending / daysInPeriod;
  const prevDailyAvg = prevTotal / Math.max(1, daysInPeriod);
  const dailyAvgChange = prevDailyAvg > 0 ? ((dailyAvg - prevDailyAvg) / prevDailyAvg) * 100 : null;

  // --- Monthly Trend (بفلتر مستقل) ---
  const monthlyTrend = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => { const k = e.date.slice(0, 7); map.set(k, (map.get(k) || 0) + e.amount); });
    const allMonths = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    const now = new Date();
    const thisYear = now.getFullYear();

    let filtered = allMonths;
    switch (monthlyFilter.range) {
      case "year":      filtered = allMonths.filter(([k]) => k.startsWith(`${thisYear}-`)); break;
      case "lastYear":  filtered = allMonths.filter(([k]) => k.startsWith(`${thisYear - 1}-`)); break;
      case "month":     filtered = allMonths.slice(-12); break;   // "Last 12 Months"
      case "lastMonth": filtered = allMonths.slice(-24); break;   // "Last 24 Months"
      case "all":       /* كل البيانات */ break;
      case "custom":
        if (monthlyFilter.customFrom || monthlyFilter.customTo) {
          const from = monthlyFilter.customFrom?.slice(0, 7) ?? "";
          const to   = monthlyFilter.customTo?.slice(0, 7) ?? "9999-12";
          filtered = allMonths.filter(([k]) => k >= from && k <= to);
        }
        break;
      default: filtered = allMonths.slice(-12);
    }

    return filtered.map(([label, value]) => ({ label: label.slice(5), value }));
  }, [expenses, monthlyFilter]);

  // --- Daily Trend ---
  const dailyTrend = useMemo(() => {
    // buildDailyTimeline يضمن: كل أيام الفترة موجودة بالضبط، بدون drift بسبب timezone
    const timeline = buildDailyTimeline(dailyFilter, weekStart as 0 | 1 | 6);
    if (timeline.length === 0) return [];
    const amountByDate = new Map<string, number>();
    dailyExp.forEach((e) => amountByDate.set(e.date, (amountByDate.get(e.date) || 0) + e.amount));
    return timeline.map(({ dateISO, label }) => ({ label, value: amountByDate.get(dateISO) || 0 }));
  }, [dailyExp, dailyFilter, weekStart]);

  // --- Category charts ---
  const byCategoryBar = useMemo(() => groupByCategory(categoryExp), [categoryExp]);
  const byCategoryDonut = useMemo(() => groupByCategory(breakdownExp), [breakdownExp]);
  const byPaymentDonut = useMemo(() => groupByPayment(breakdownExp), [breakdownExp]);

  // --- Budget Performance ---
  const budgetPerformance = useMemo(() => {
    if (!budgetsEnabled) return [];
    const thisMonth = new Date().toISOString().slice(0, 7);
    return budgets.map((b) => {
      const spent = expenses
        .filter((e) => e.date.slice(0, 7) === thisMonth && (b.category_id ? e.category_id === b.category_id : true))
        .reduce((s, e) => s + e.amount, 0);
      const percent = b.amount > 0 ? Math.min(100, (spent / b.amount) * 100) : 0;
      const status = percent >= 100 ? "Exceeded" : percent >= 80 ? "Warning" : "Healthy";
      const color = percent >= 100 ? "var(--danger)" : percent >= 80 ? "var(--warning)" : "var(--success)";
      return { name: b.category_name || "General Budget", budget: b.amount, spent, percent, status, color };
    });
  }, [budgets, budgetsEnabled, expenses]);

  // --- Period Comparison ---
  const comparison = useMemo(() => {
    const current = filterExpenses(expenses, comparisonFilter, weekStart);
    const prev = getPreviousPeriod(comparisonFilter, weekStart);
    const prevList = expenses.filter((e) => isWithinRange(e.date, prev.from, prev.to));
    const thisMap = new Map<string, number>(), lastMap = new Map<string, number>();
    current.forEach((e) => { const k = e.category_name || "Uncategorized"; thisMap.set(k, (thisMap.get(k) || 0) + e.amount); });
    prevList.forEach((e) => { const k = e.category_name || "Uncategorized"; lastMap.set(k, (lastMap.get(k) || 0) + e.amount); });
    const allCats = new Set([...thisMap.keys(), ...lastMap.keys()]);
    return Array.from(allCats).map((cat) => {
      const curr = thisMap.get(cat) || 0, prev = lastMap.get(cat) || 0;
      const change = prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;
      return { cat, curr, prev, change };
    }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }, [expenses, comparisonFilter, weekStart]);

  // --- Weekday Analysis ---
  const weekdayData = useMemo(() => {
    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const totals = new Array(7).fill(0), counts = new Array(7).fill(0);
    globalExp.forEach((e) => {
      const d = new Date(e.date).getDay();
      totals[d] += e.amount;
      counts[d]++;
    });
    return DAYS.map((day, i) => ({ day, amount: totals[i], count: counts[i] }));
  }, [globalExp]);

  // --- Category Trend (multi-line, last 6 months, top 5 categories) ---
  const { categoryTrendData, trendCategories } = useMemo(() => {
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().slice(0, 7));
    }
    // أعلى 5 فئات بإجمالي الإنفاق خلال الـ 6 أشهر
    const catTotals = new Map<string, number>();
    expenses.filter((e) => months.includes(e.date.slice(0, 7))).forEach((e) => {
      const k = e.category_name || "Uncategorized";
      catTotals.set(k, (catTotals.get(k) || 0) + e.amount);
    });
    const topCats = Array.from(catTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map((c) => c[0]);

    const rows = months.map((m) => {
      const row: { month: string; [k: string]: string | number } = { month: m.slice(5) };
      topCats.forEach((cat) => {
        row[cat] = expenses.filter((e) => e.date.slice(0, 7) === m && (e.category_name || "Uncategorized") === cat)
          .reduce((s, e) => s + e.amount, 0);
      });
      return row;
    });

    return { categoryTrendData: rows, trendCategories: topCats };
  }, [expenses]);

  // --- Heatmap (last 12 months daily) ---
  const heatmapData = useMemo(() => {
    const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const map = new Map<string, number>();
    expenses.filter((e) => e.date >= cutoffStr).forEach((e) => map.set(e.date, (map.get(e.date) || 0) + e.amount));
    return Array.from(map.entries()).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date));
  }, [expenses]);

  return (
    <div ref={pageRef} className="fade-in">
      {/* Header + Global Filter + Export */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Analytics</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="text-muted" style={{ fontSize: 12 }}>Global filter:</span>
          <RangeFilterDropdown value={globalFilter} onChange={applyGlobal} />
          <ExportMenu expenses={globalExp} pageRef={pageRef} />
        </div>
      </div>

      {/* ── 1. Summary Cards ────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <SummaryCard
          icon={<ShoppingBag size={16} />} label="Total Spending" value={fmt(totalSpending)}
          change={spendingChange} sentiment="spending" suffix="vs prev. period"
        />
        <SummaryCard
          icon={<Activity size={16} />} label="Total Transactions" value={String(totalTx)}
          change={txChange} sentiment="spending" suffix="vs prev. period"
        />
        <SummaryCard
          icon={<Flame size={16} />} label="Highest Spending Day"
          value={highestDayEntry.amount > 0 ? `${fmt(highestDayEntry.amount)}` : "—"}
          change={highestDayChange} sentiment="spending" suffix="vs prev. period"
        />
        <SummaryCard
          icon={<Tag size={16} />} label="Top Category"
          value={topCat?.label ?? "—"}
          change={topCatChange} sentiment="spending" suffix="vs prev. period"
        />
        <SummaryCard
          icon={<Calculator size={16} />} label="Average Expense"
          value={avgExpense > 0 ? fmt(avgExpense) : "—"}
          change={avgChange} sentiment="spending" suffix="vs prev. period"
        />
        <SummaryCard
          icon={<Calendar size={16} />} label="Daily Average"
          value={dailyAvg > 0 ? fmt(dailyAvg) : "—"}
          change={dailyAvgChange} sentiment="spending" suffix="vs prev. period"
        />
      </div>

      {/* ── 2. Monthly Trend ─────────────────────────────── */}
      <ChartCard title="Monthly Trend" filter={monthlyFilter} onFilter={setMonthlyFilter} filterOptions={MONTHLY_RANGE_OPTIONS}>
        {monthlyTrend.length > 0 ? <ProBarChart data={monthlyTrend} /> : <EmptyChart />}
      </ChartCard>

      {/* ── 3. Daily Spending Trend ─────────────────────────── */}
      <div style={{ marginTop: 20 }}>
        <ChartCard title="Daily Spending Trend" filter={dailyFilter} onFilter={setDailyFilter}>
          {dailyTrend.length > 0 ? <ProDailyAreaChart data={dailyTrend} /> : <EmptyChart />}
        </ChartCard>
      </div>

      {/* ── 4. Spending by Category (Bar) ────────────────────── */}
      <div style={{ marginTop: 20 }}>
        <ChartCard title="Spending by Category" filter={categoryFilter} onFilter={setCategoryFilter}>
          {byCategoryBar.length > 0 ? <ProBarChart data={byCategoryBar} /> : <EmptyChart />}
        </ChartCard>
      </div>

      {/* ── 5. Category Breakdown + Payment Method ──────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
        <ChartCard title="Category Breakdown" filter={breakdownFilter} onFilter={setBreakdownFilter}>
          {byCategoryDonut.length > 0 ? <ProDonutChart data={byCategoryDonut} /> : <EmptyChart />}
        </ChartCard>
        <ChartCard title="Payment Method Analysis">
          {byPaymentDonut.length > 0 ? <ProDonutChart data={byPaymentDonut} /> : <EmptyChart />}
        </ChartCard>
      </div>

      {/* ── 6. Budget Performance ───────────────────────────── */}
      {budgetsEnabled && budgetPerformance.length > 0 && (
        <div className="card fade-in" style={{ marginTop: 20 }}>
          <h3 style={{ margin: "0 0 16px" }}>Budget Performance (This Month)</h3>
          {budgetPerformance.map((b) => (
            <div key={b.name} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{b.name}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: `${b.color}22`, color: b.color, fontWeight: 700 }}>
                    {b.status}
                  </span>
                </div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  {fmt(b.spent)} / {fmt(b.budget)} ({Math.round(b.percent)}%)
                </div>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: "var(--surface-hover)", overflow: "hidden" }}>
                <div className="progress-bar-animated" style={{ height: "100%", width: `${b.percent}%`, background: b.color, borderRadius: 5 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 7. Period Comparison ────────────────────────────── */}
      <div style={{ marginTop: 20 }}>
        <ChartCard title="Period Comparison (vs Equivalent Previous Period)" filter={comparisonFilter} onFilter={setComparisonFilter}>
          {comparison.length === 0 ? (
            <EmptyChart label="Not enough data to compare." />
          ) : (
            <div>
              {comparison.map((c) => {
                const up = c.change > 0, flat = Math.abs(c.change) < 0.5;
                const color = flat ? "var(--text-muted)" : up ? "var(--danger)" : "var(--success)";
                return (
                  <div key={c.cat} className="fade-in-item" style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--border)", alignItems: "center" }}>
                    <span style={{ fontSize: 13 }}>{c.cat}</span>
                    <span style={{ fontSize: 13 }} className="text-muted">{Math.round(c.prev)} → {Math.round(c.curr)} EGP</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color, display: "flex", alignItems: "center", gap: 4 }}>
                      {flat ? <Minus size={13} /> : up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {flat ? "—" : `${up ? "+" : ""}${Math.round(c.change)}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── 8. Weekday Analysis ─────────────────────────────── */}
      <div style={{ marginTop: 20 }}>
        <ChartCard title="Spending by Day of the Week">
          {weekdayData.every((d) => d.amount === 0)
            ? <EmptyChart />
            : <ProWeekdayChart data={weekdayData} />}
        </ChartCard>
      </div>

      {/* ── 9. Category Trend (multi-line, last 6 months) ────── */}
      {trendCategories.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <ChartCard title="Category Trend (Last 6 Months)">
            <ProCategoryTrend data={categoryTrendData} categories={trendCategories} />
          </ChartCard>
        </div>
      )}

      {/* ── 10. Spending Heatmap (last 12 months) ────────────── */}
      {heatmapData.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <ChartCard title="Spending Heatmap (Last 12 Months)">
            <ProHeatmap data={heatmapData} />
          </ChartCard>
        </div>
      )}

      {/* ── 11. Statistics Table ─────────────────────────────── */}
      <StatisticsTable expenses={globalExp} prevExpenses={prevExp} />
    </div>
  );
}

function EmptyChart({ label = "No data for this period." }: { label?: string }) {
  return (
    <div style={{ padding: "32px 0", textAlign: "center" } as CSSProperties}>
      <p className="text-muted" style={{ fontSize: 13 }}>{label}</p>
    </div>
  );
}

/* =========================================================
   Export Menu — PDF / PNG / Excel / CSV
   ========================================================= */
function ExportMenu({ expenses, pageRef }: { expenses: ExpenseWithDetails[]; pageRef: RefObject<HTMLDivElement | null> }) {
  const { open, toggle, triggerRef, menuRef } = useDropdown<HTMLButtonElement>();

  const exportCSV = () => {
    const header = "Name,Date,Amount (EGP),Category,Payment Method,Notes";
    const rows = expenses.map((e) =>
      [e.name, e.date, e.amount, e.category_name ?? "", e.payment_method_name ?? "", (e.description ?? "").replace(/,/g, ";")]
        .map((v) => `"${v}"`).join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `analytics_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toggle();
  };

  const exportExcel = () => {
    const escapeXml = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const rows = expenses.map((e) => `
      <Row>
        <Cell><Data ss:Type="String">${escapeXml(e.name)}</Data></Cell>
        <Cell><Data ss:Type="String">${e.date}</Data></Cell>
        <Cell><Data ss:Type="Number">${e.amount}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(e.category_name ?? "")}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(e.payment_method_name ?? "")}</Data></Cell>
      </Row>`).join("");
    const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Analytics"><Table>
    <Row><Cell><Data ss:Type="String">Name</Data></Cell><Cell><Data ss:Type="String">Date</Data></Cell><Cell><Data ss:Type="String">Amount</Data></Cell><Cell><Data ss:Type="String">Category</Data></Cell><Cell><Data ss:Type="String">Payment</Data></Cell></Row>
    ${rows}
  </Table></Worksheet></Workbook>`;
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `analytics_${new Date().toISOString().slice(0, 10)}.xls`; a.click();
    URL.revokeObjectURL(url);
    toggle();
  };

  const exportPNG = async () => {
    toggle();
    if (!pageRef.current) return;
    // استخدام window.print() كبديل موثوق في Tauri بدون مكتبات خارجية —
    // نادراً ما تفشل هذه العملية، ولا نعتمد على window.alert() غير الموثوق في Tauri WebView2
    window.print();
  };

  const exportPDF = () => {
    toggle();
    window.print();
  };

  return (
    <>
      <button ref={triggerRef} onClick={toggle} style={exportBtnStyle}>
        <Download size={14} /> Export
      </button>
      <DropdownPortal anchorRef={triggerRef} menuRef={menuRef} open={open} width={160}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow)", overflow: "hidden" }}>
          {[
            { label: "Export CSV", action: exportCSV },
            { label: "Export Excel", action: exportExcel },
            { label: "Export PDF", action: exportPDF },
            { label: "Print / Save PNG", action: exportPNG },
          ].map(({ label, action }) => (
            <button key={label} onClick={action} style={{ display: "block", width: "100%", padding: "9px 14px", border: "none", background: "transparent", color: "var(--text)", fontSize: 13, textAlign: "left", cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>
      </DropdownPortal>
    </>
  );
}

const exportBtnStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
  borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-hover)",
  color: "var(--text)", fontSize: 12, cursor: "pointer", fontWeight: 600,
};

/* =========================================================
   Statistics Table — Category / Transactions / Total / Average / Percentage / Trend
   ========================================================= */
function StatisticsTable({ expenses, prevExpenses }: { expenses: ExpenseWithDetails[]; prevExpenses: ExpenseWithDetails[] }) {
  const [sortKey, setSortKey] = useState<"total" | "count" | "avg" | "pct">("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const total = expenses.reduce((s, e) => s + e.amount, 0) || 1;

  const rows = useMemo(() => {
    const map = new Map<string, { total: number; count: number; color?: string }>();
    expenses.forEach((e) => {
      const k = e.category_name || "Uncategorized";
      const cur = map.get(k) || { total: 0, count: 0, color: e.category_color ?? undefined };
      map.set(k, { total: cur.total + e.amount, count: cur.count + 1, color: cur.color });
    });

    const prevMap = new Map<string, number>();
    prevExpenses.forEach((e) => {
      const k = e.category_name || "Uncategorized";
      prevMap.set(k, (prevMap.get(k) || 0) + e.amount);
    });

    return Array.from(map.entries()).map(([cat, data]) => {
      const avg = data.count > 0 ? data.total / data.count : 0;
      const pct = (data.total / total) * 100;
      const prevTotal = prevMap.get(cat) || 0;
      const trend = prevTotal > 0 ? ((data.total - prevTotal) / prevTotal) * 100 : null;
      return { cat, ...data, avg, pct, trend };
    });
  }, [expenses, prevExpenses, total]);

  const sorted = [...rows].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortDir === "desc" ? -diff : diff;
  });

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ k }: { k: typeof sortKey }) => {
    if (sortKey !== k) return <span style={{ color: "var(--border)" }}>↕</span>;
    return <span style={{ color: "var(--accent)" }}>{sortDir === "desc" ? "↓" : "↑"}</span>;
  };

  if (rows.length === 0) return null;

  const thStyle: CSSProperties = { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, cursor: "pointer", userSelect: "none" as const, textAlign: "left" as const };
  const tdStyle: CSSProperties = { padding: "12px 14px", fontSize: 13 };

  return (
    <div className="card fade-in" style={{ marginTop: 20, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
        <h3 style={{ margin: 0 }}>Statistics by Category</h3>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-hover)" }}>
              <th style={thStyle}>Category</th>
              <th style={{ ...thStyle, cursor: "pointer" }} onClick={() => toggleSort("count")}>Transactions <SortIcon k="count" /></th>
              <th style={{ ...thStyle, cursor: "pointer" }} onClick={() => toggleSort("total")}>Total <SortIcon k="total" /></th>
              <th style={{ ...thStyle, cursor: "pointer" }} onClick={() => toggleSort("avg")}>Average <SortIcon k="avg" /></th>
              <th style={{ ...thStyle, cursor: "pointer" }} onClick={() => toggleSort("pct")}>Share <SortIcon k="pct" /></th>
              <th style={thStyle}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const trendUp = r.trend !== null && r.trend > 0;
              const trendFlat = r.trend === null || Math.abs(r.trend) < 0.5;
              const trendColor = trendFlat ? "var(--text-muted)" : trendUp ? "var(--danger)" : "var(--success)";
              return (
                <tr key={r.cat} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: r.color || "var(--accent)", flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>{r.cat}</span>
                    </div>
                  </td>
                  <td style={tdStyle} className="text-muted">{r.count}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{Math.round(r.total).toLocaleString()} EGP</td>
                  <td style={tdStyle} className="text-muted">{Math.round(r.avg).toLocaleString()} EGP</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--surface-hover)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${r.pct}%`, background: r.color || "var(--accent)", borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 32 }}>{Math.round(r.pct)}%</span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: trendColor, fontWeight: 600 }}>
                    {trendFlat ? "—" : `${trendUp ? "▲" : "▼"} ${Math.abs(Math.round(r.trend!))}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
