import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Wallet, CalendarDays, TrendingUp, Activity, Trophy, Calculator, Tag, RotateCcw,
  AlertTriangle, Flame, CheckCircle2, Clock, ArrowUp, ArrowDown,
} from "lucide-react";
import { useDataStore } from "../store/DataStore";
import { ProDailyAreaChart } from "../components/ChartsPro";
import CircularProgress from "../components/CircularProgress";
import AnimatedNumber from "../components/AnimatedNumber";
import RangeFilterDropdown from "../components/RangeFilterDropdown";
import { resolveDateRange, isWithinRange, buildDailyTimeline, type DateFilterValue } from "../lib/dateRanges";
import { useWeekStart } from "../context/WeekStartContext";

export default function Dashboard() {
  const { weekStart } = useWeekStart();
  const { dashboardSummary: summary, expenses, budgets, budgetsEnabled, activityLog: activity, deleteExpense, restoreExpense } = useDataStore();

  const [top5Filter, setTop5Filter] = useState<DateFilterValue>({ range: "month" });
  const [trendFilter, setTrendFilter] = useState<DateFilterValue>({ range: "month" });

  const [undoToast, setUndoToast] = useState<{ id: string; name: string } | null>(null);

  const fmt = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} EGP`;

  const dailyTrend = useMemo(() => {
    // buildDailyTimeline يضمن: كل أيام الفترة موجودة بالضبط بدون drift بسبب timezone
    const timeline = buildDailyTimeline(trendFilter, weekStart);
    if (timeline.length === 0) return [];
    const amountByDate = new Map<string, number>();
    expenses.forEach((e) => {
      if (isWithinRange(e.date, resolveDateRange(trendFilter, weekStart).from, resolveDateRange(trendFilter, weekStart).to))
        amountByDate.set(e.date, (amountByDate.get(e.date) || 0) + e.amount);
    });
    return timeline.map(({ dateISO, label }) => ({ label, value: amountByDate.get(dateISO) || 0 }));
  }, [expenses, trendFilter, weekStart]);

  const top5Range = resolveDateRange(top5Filter, weekStart);
  const top5 = useMemo(() =>
    [...expenses].filter((e) => isWithinRange(e.date, top5Range.from, top5Range.to)).sort((a, b) => b.amount - a.amount).slice(0, 5),
    [expenses, top5Filter]
  );

  const budgetUsage = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    return budgets.map((b) => {
      const spent = expenses.filter((e) => e.date.slice(0, 7) === thisMonth && (b.category_id ? e.category_id === b.category_id : true)).reduce((s, e) => s + e.amount, 0);
      return { ...b, spent, percent: b.amount > 0 ? Math.min(100, (spent / b.amount) * 100) : 0 };
    });
  }, [budgets, expenses]);

  const generalBudget = budgetUsage.find((b) => !b.category_id);

  // ---------- KPI comparisons (yesterday / last week / last month) ----------
  const kpiComparisons = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);
    const totalToday = expenses.filter((e) => e.date === today).reduce((s, e) => s + e.amount, 0);
    const totalYesterday = expenses.filter((e) => e.date === yesterdayKey).reduce((s, e) => s + e.amount, 0);
    const todayChange = totalYesterday > 0 ? ((totalToday - totalYesterday) / totalYesterday) * 100 : null;

    const thisMonth = new Date().toISOString().slice(0, 7);
    const lastMonthDate = new Date(); lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonth = lastMonthDate.toISOString().slice(0, 7);
    const countThis = expenses.filter((e) => e.date.slice(0, 7) === thisMonth).length;
    const countLast = expenses.filter((e) => e.date.slice(0, 7) === lastMonth).length;

    const last30 = expenses.filter((e) => { const d = new Date(e.date); const ago = (Date.now() - d.getTime()) / 86400000; return ago <= 30; });
    const byDate = new Map<string, number>();
    last30.forEach((e) => byDate.set(e.date, (byDate.get(e.date) || 0) + e.amount));
    const dailyTotals = Array.from(byDate.values());
    const avg30 = dailyTotals.length ? dailyTotals.reduce((a, b) => a + b, 0) / 30 : 0;

    return { todayChange, countDelta: countThis - countLast, avg30 };
  }, [expenses]);

  const healthScore = useMemo(() => {
    let score = 100;
    if (generalBudget) { if (generalBudget.percent > 100) score -= 30; else if (generalBudget.percent > 80) score -= 15; }
    const thisMonth = new Date().toISOString().slice(0, 7);
    const lastMonthDate = new Date(); lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonth = lastMonthDate.toISOString().slice(0, 7);
    const thisTotal = expenses.filter((e) => e.date.slice(0, 7) === thisMonth).reduce((s, e) => s + e.amount, 0);
    const lastTotal = expenses.filter((e) => e.date.slice(0, 7) === lastMonth).reduce((s, e) => s + e.amount, 0);
    if (lastTotal > 0) {
      const change = (thisTotal - lastTotal) / lastTotal;
      if (change > 0.3) score -= 20; else if (change > 0.1) score -= 10; else if (change < -0.1) score += 5;
    }
    return Math.max(0, Math.min(100, score));
  }, [expenses, generalBudget]);

  const insights = useMemo(() => {
    const list: { icon: ReactNode; text: string }[] = [];
    const thisMonth = new Date().toISOString().slice(0, 7);
    const lastMonthDate = new Date(); lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonth = lastMonthDate.toISOString().slice(0, 7);
    const byCatThis = new Map<string, number>(), byCatLast = new Map<string, number>();
    expenses.forEach((e) => {
      const cat = e.category_name || "Uncategorized";
      if (e.date.slice(0, 7) === thisMonth) byCatThis.set(cat, (byCatThis.get(cat) || 0) + e.amount);
      if (e.date.slice(0, 7) === lastMonth) byCatLast.set(cat, (byCatLast.get(cat) || 0) + e.amount);
    });
    byCatThis.forEach((current, cat) => {
      const previous = byCatLast.get(cat) || 0;
      if (previous > 0) {
        const change = ((current - previous) / previous) * 100;
        if (change > 25) list.push({ icon: <AlertTriangle size={15} color="var(--warning)" />, text: `${cat} spending increased ${Math.round(change)}% vs last month` });
        if (change < -20) list.push({ icon: <CheckCircle2 size={15} color="var(--success)" />, text: `${cat} spending decreased ${Math.abs(Math.round(change))}%` });
      }
    });
    budgetUsage.forEach((b) => { if (b.percent >= 100) list.push({ icon: <AlertTriangle size={15} color="var(--danger)" />, text: `${b.category_name || "General budget"} exceeded its limit` }); });
    const dowTotals = new Array(7).fill(0);
    expenses.forEach((e) => { dowTotals[new Date(e.date).getDay()] += e.amount; });
    const maxDow = dowTotals.indexOf(Math.max(...dowTotals));
    const dowNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    if (Math.max(...dowTotals) > 0) list.push({ icon: <Flame size={15} color="var(--accent)" />, text: `Highest spending day overall: ${dowNames[maxDow]}` });
    return list.slice(0, 5);
  }, [expenses, budgetUsage]);

  const handleUndoableDelete = async (id: string, name: string) => {
    await deleteExpense(id);
    setUndoToast({ id, name });
    setTimeout(() => setUndoToast((t) => (t?.id === id ? null : t)), 6000);
  };

  const handleUndo = async () => {
    if (!undoToast) return;
    await restoreExpense(undoToast.id);
    setUndoToast(null);
  };

  if (!summary) return null;

  const kpis: { label: string; value: string; numericValue?: number; suffix?: string; icon: ReactNode; color: string; insight?: ReactNode }[] = [
    {
      label: "Today", value: fmt(summary.total_today), numericValue: summary.total_today, suffix: " EGP",
      icon: <CalendarDays size={18} />, color: "#4DA3FF",
      insight: kpiComparisons.todayChange !== null ? <TrendBadge value={kpiComparisons.todayChange} suffix="vs Yesterday" /> : undefined,
    },
    { label: "This Month", value: fmt(summary.total_this_month), numericValue: summary.total_this_month, suffix: " EGP", icon: <Wallet size={18} />, color: "#FF8A65" },
    { label: "This Year", value: fmt(summary.total_this_year), numericValue: summary.total_this_year, suffix: " EGP", icon: <TrendingUp size={18} />, color: "#66BB6A" },
    {
      label: "Daily Average", value: fmt(summary.daily_average), numericValue: summary.daily_average, suffix: " EGP",
      icon: <Activity size={18} />, color: "#FFC107",
      insight: <span className="text-muted" style={{ fontSize: 11 }}>30-day avg: {Math.round(kpiComparisons.avg30)} EGP</span>,
    },
    {
      label: "Expense Count", value: String(summary.expense_count_this_month), numericValue: summary.expense_count_this_month,
      icon: <Calculator size={18} />, color: "#AB47BC",
      insight: <TrendBadge value={kpiComparisons.countDelta} suffix="vs Last Month" isCount />,
    },
    { label: "Biggest Expense", value: fmt(summary.biggest_expense), numericValue: summary.biggest_expense, suffix: " EGP", icon: <Trophy size={18} />, color: "#EF5350" },
    {
      label: "Average Expense",
      value: fmt(summary.expense_count_this_month > 0 ? summary.total_this_month / summary.expense_count_this_month : 0),
      numericValue: summary.expense_count_this_month > 0 ? summary.total_this_month / summary.expense_count_this_month : 0,
      suffix: " EGP", icon: <Calculator size={18} />, color: "#26C6DA",
    },
    { label: "Top Category", value: summary.top_category || "—", icon: <Tag size={18} />, color: "#8AA0BD" },
  ];

  return (
    <div className="fade-in">
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        {kpis.map((k, i) => <KpiCard key={k.label} {...k} delay={i * 40} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, marginBottom: 20 }}>
        <div className="card fade-in">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ marginTop: 0 }}>Daily Spending Trend</h3>
            <RangeFilterDropdown value={trendFilter} onChange={setTrendFilter} compact />
          </div>
          <ProDailyAreaChart data={dailyTrend} />
        </div>

        <div className="card fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <h3 style={{ marginTop: 0, alignSelf: "flex-start" }}>Financial Health Score</h3>
          <CircularProgress score={healthScore} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="card fade-in">
          <h3 style={{ marginTop: 0 }}>Smart Insights</h3>
          {insights.length === 0 && <EmptyState text="Not enough data yet to generate insights." />}
          {insights.map((ins, i) => (
            <div key={i} className="fade-in-item" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
              {ins.icon}<span style={{ fontSize: 13 }}>{ins.text}</span>
            </div>
          ))}
        </div>

        <div className="card fade-in">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ marginTop: 0 }}>Top 5 Expenses</h3>
            <RangeFilterDropdown value={top5Filter} onChange={setTop5Filter} compact />
          </div>
          {top5.length === 0 && <EmptyState text="No expenses in this period." />}
          {top5.map((e) => (
            <div key={e.id} className="fade-in-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--border)" }}>
              <div>
                <div className="bidi-auto" style={{ fontSize: 13, fontWeight: 600 }}>{e.name}</div>
                <div className="text-muted" style={{ fontSize: 11 }}>{e.date}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{fmt(e.amount)}</div>
                <button onClick={() => handleUndoableDelete(e.id, e.name)} style={smallIconBtn} title="Delete"><RotateCcw size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: budgetsEnabled ? "1fr 1fr" : "1fr", gap: 20 }}>
        <div className="card fade-in">
          <h3 style={{ marginTop: 0 }}>Recent Activity</h3>
          {activity.length === 0 && <EmptyState text="No recent activity." />}
          {activity.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: "1px solid var(--border)" }}>
              <Clock size={13} color="var(--text-muted)" />
              <span style={{ fontSize: 12, flex: 1 }}>{formatAction(a.action_type)}</span>
              <span className="text-muted" style={{ fontSize: 11 }}>{a.created_at.slice(5, 16).replace("T", " ")}</span>
            </div>
          ))}
        </div>

        {budgetsEnabled && budgetUsage.length > 0 && (
          <div className="card fade-in">
            <h3 style={{ marginTop: 0 }}>Budget Overview</h3>
            {budgetUsage.map((b) => (
              <div key={b.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span>{b.category_name || "General Budget"}</span>
                  <span className="text-muted">{Math.round(b.spent)} / {b.amount} EGP</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "var(--surface-hover)", overflow: "hidden" }}>
                  <div className="progress-bar-animated" style={{ height: "100%", width: `${b.percent}%`, background: b.percent >= 100 ? "var(--danger)" : b.percent >= 80 ? "var(--warning)" : "var(--accent)" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {undoToast && (
        <div style={toastStyle} className="toast-in">
          <span style={{ fontSize: 13 }}>Deleted "{undoToast.name}"</span>
          <button onClick={handleUndo} style={{ ...smallIconBtn, width: "auto", padding: "5px 10px", display: "flex", alignItems: "center", gap: 5 }}>
            <RotateCcw size={12} /> Undo
          </button>
        </div>
      )}
    </div>
  );
}

function TrendBadge({ value, suffix, isCount = false }: { value: number; suffix: string; isCount?: boolean }) {
  const up = value > 0;
  const flat = value === 0;
  const display = isCount ? `${up ? "+" : ""}${value}` : `${up ? "+" : ""}${Math.round(value)}%`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, marginTop: 4 }}>
      {!flat && (up ? <ArrowUp size={11} color="var(--danger)" /> : <ArrowDown size={11} color="var(--success)" />)}
      <span style={{ color: flat ? "var(--text-muted)" : up ? "var(--danger)" : "var(--success)", fontWeight: 700 }}>{display}</span>
      <span className="text-muted">{suffix}</span>
    </div>
  );
}

function KpiCard({ label, value, numericValue, suffix, icon, color, insight, delay }: { label: string; value: string; numericValue?: number; suffix?: string; icon: ReactNode; color: string; insight?: ReactNode; delay: number }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="card kpi-card-in"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        transform: hover ? "translateY(-3px)" : "none",
        boxShadow: hover ? `0 8px 20px ${color}33` : "var(--shadow)",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        borderTop: `3px solid ${color}`,
        animationDelay: `${delay}ms`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="text-muted" style={{ fontSize: 12 }}>{label}</div>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
          {icon}
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 17, marginTop: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {numericValue !== undefined ? <AnimatedNumber value={numericValue} suffix={suffix} /> : value}
      </div>
      {insight && <div style={{ marginTop: 2 }}>{insight}</div>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-muted" style={{ fontSize: 13, padding: "10px 0" }}>{text}</p>;
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    expense_added: "Added an expense", expense_updated: "Updated an expense",
    expense_deleted: "Deleted an expense", expense_restored: "Restored an expense",
    category_added: "Added a category", budget_changed: "Updated a budget",
    backup_created: "Created a backup", backup_restored: "Restored a backup",
    password_changed: "Changed password",
  };
  return map[action] || action.replace(/_/g, " ");
}

const smallIconBtn: CSSProperties = {
  width: 22, height: 22, borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--surface-hover)", color: "var(--text-muted)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s",
};

const toastStyle: CSSProperties = {
  position: "fixed", bottom: 24, right: 24, background: "var(--surface)",
  border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px",
  display: "flex", alignItems: "center", gap: 14, boxShadow: "var(--shadow)", zIndex: "var(--z-toast)" as unknown as number,
};
