import { useMemo, useState, type ReactNode } from "react";
import {
  Wallet, CalendarDays, TrendingUp, Activity, Trophy, Calculator, Tag,
  AlertTriangle, Flame, CheckCircle2, ArrowUp, ArrowDown,
} from "lucide-react";
import { useDataStore } from "../store/DataStore";
import DailySpendingChart from "../components/DailySpendingChart";
import { useTheme } from "../context/ThemeContext";
import CircularProgress from "../components/CircularProgress";
import AnimatedNumber from "../components/AnimatedNumber";
import RangeFilterDropdown from "../components/RangeFilterDropdown";
import ActivityFeed from "../components/ActivityFeed";
import { resolveDateRange, isWithinRange, buildDailyTimeline, type DateFilterValue } from "../lib/dateRanges";
import { useWeekStart } from "../context/WeekStartContext";

export default function Dashboard() {
  const { weekStart } = useWeekStart();
  const { theme } = useTheme();
  const { dashboardSummary: summary, expenses, budgets, budgetsEnabled, activityLog: activity } = useDataStore();

  const [top5Filter, setTop5Filter] = useState<DateFilterValue>({ range: "month" });
  const [trendFilter, setTrendFilter] = useState<DateFilterValue>({ range: "month" });

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
    return timeline.map(({ dateISO, label }) => ({ iso: dateISO, label, value: amountByDate.get(dateISO) || 0 }));
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

  if (!summary) return null;

  const kpis: { label: string; value: string; numericValue?: number; suffix?: string; icon: ReactNode; color: string; insight?: ReactNode }[] = [
    {
      label: "Today", value: fmt(summary.total_today), numericValue: summary.total_today, suffix: " EGP",
      icon: <CalendarDays size={18} />, color: "var(--c1)",
      insight: kpiComparisons.todayChange !== null ? <TrendBadge value={kpiComparisons.todayChange} suffix="vs Yesterday" /> : undefined,
    },
    { label: "This Month", value: fmt(summary.total_this_month), numericValue: summary.total_this_month, suffix: " EGP", icon: <Wallet size={18} />, color: "var(--c2)" },
    { label: "This Year", value: fmt(summary.total_this_year), numericValue: summary.total_this_year, suffix: " EGP", icon: <TrendingUp size={18} />, color: "var(--c7)" },
    {
      label: "Daily Average", value: fmt(summary.daily_average), numericValue: summary.daily_average, suffix: " EGP",
      icon: <Activity size={18} />, color: "var(--c3)",
      insight: <span className="text-muted" style={{ fontSize: "calc(11px * var(--app-font-scale, 1))" }}>30-day avg: <span className="num">{Math.round(kpiComparisons.avg30)} EGP</span></span>,
    },
    {
      label: "Expense Count", value: String(summary.expense_count_this_month), numericValue: summary.expense_count_this_month,
      icon: <Calculator size={18} />, color: "var(--c5)",
      insight: <TrendBadge value={kpiComparisons.countDelta} suffix="vs Last Month" isCount />,
    },
    { label: "Biggest Expense", value: fmt(summary.biggest_expense), numericValue: summary.biggest_expense, suffix: " EGP", icon: <Trophy size={18} />, color: "var(--c6)" },
    {
      label: "Average Expense",
      value: fmt(summary.expense_count_this_month > 0 ? summary.total_this_month / summary.expense_count_this_month : 0),
      numericValue: summary.expense_count_this_month > 0 ? summary.total_this_month / summary.expense_count_this_month : 0,
      suffix: " EGP", icon: <Calculator size={18} />, color: "var(--c4)",
    },
    { label: "Top Category", value: summary.top_category || "—", icon: <Tag size={18} />, color: "var(--c8)" },
  ];

  return (
    <div className="fade-in">
      <h1 style={{ marginTop: 0, marginBottom: 26 }}>Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        {kpis.map((k, i) => <KpiCard key={k.label} {...k} delay={i * 40} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, marginBottom: 20 }}>
        <div className="card fade-in">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ marginTop: 0 }}>Daily Spending Trend</h3>
            <RangeFilterDropdown value={trendFilter} onChange={setTrendFilter} compact />
          </div>
          <DailySpendingChart
            dates={dailyTrend.map((d) => d.iso)}
            amounts={dailyTrend.map((d) => d.value)}
            isDarkMode={theme === "dark"}
            height={280}
          />
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
              {ins.icon}<span style={{ fontSize: "calc(13px * var(--app-font-scale, 1))" }}>{ins.text}</span>
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
                <div dir="auto" className="bidi-auto" style={{ fontSize: "calc(13px * var(--app-font-scale, 1) * var(--ar-font-scale, 1))", fontWeight: 600 }}>{e.name}</div>
                <div className="text-muted" style={{ fontSize: "calc(11px * var(--app-font-scale, 1))" }}>{e.date}</div>
              </div>
              <div className="num" style={{ fontWeight: 700, fontSize: "calc(13px * var(--app-font-scale, 1) * var(--num-font-scale, 1))" }}>{fmt(e.amount)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: budgetsEnabled ? "1fr 1fr" : "1fr", gap: 20 }}>
        <div className="card fade-in">
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>Recent Activity</h3>
          <ActivityFeed entries={activity} />
        </div>

        {budgetsEnabled && budgetUsage.length > 0 && (
          <div className="card fade-in">
            <h3 style={{ marginTop: 0 }}>Budget Overview</h3>
            {budgetUsage.map((b) => (
              <div key={b.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "calc(13px * var(--app-font-scale, 1))", marginBottom: 6 }}>
                  <span>{b.category_name || "General Budget"}</span>
                  <span className="text-muted num">{Math.round(b.spent)} / {b.amount} EGP</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "var(--surface-hover)", overflow: "hidden" }}>
                  <div className="progress-bar-animated" style={{ height: "100%", width: `${b.percent}%`, background: b.percent >= 100 ? "var(--danger)" : b.percent >= 80 ? "var(--warning)" : "var(--accent)" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TrendBadge({ value, suffix, isCount = false }: { value: number; suffix: string; isCount?: boolean }) {
  const up = value > 0;
  const flat = value === 0;
  const display = isCount ? `${up ? "+" : ""}${value}` : `${up ? "+" : ""}${Math.round(value)}%`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "calc(11px * var(--app-font-scale, 1))", marginTop: 4 }}>
      {!flat && (up ? <ArrowUp size={11} color="var(--danger)" /> : <ArrowDown size={11} color="var(--success)" />)}
      <span className="num" style={{ color: flat ? "var(--text-muted)" : up ? "var(--danger)" : "var(--success)", fontWeight: 700 }}>{display}</span>
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
        position: "relative",
        overflow: "hidden",
        padding: "18px 18px 16px",
        transform: hover ? "translateY(-3px)" : "none",
        boxShadow: hover ? "var(--shadow-lg)" : "var(--shadow)",
        transition: "transform 0.2s var(--ease-decelerate), box-shadow 0.2s var(--ease-decelerate)",
        animationDelay: `${delay}ms`,
      }}
    >
      {/* شريط لوني رفيع على حافة البطاقة + هالة خفيفة بنفس اللون عند المرور */}
      <span style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 3, background: color }} />
      <span
        style={{
          position: "absolute", top: -46, insetInlineEnd: -46, width: 130, height: 130, borderRadius: "50%",
          background: color, opacity: hover ? 0.14 : 0.07, filter: "blur(26px)",
          transition: "opacity 0.25s ease", pointerEvents: "none",
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        <div className="eyebrow" style={{ fontSize: "calc(9.5px * var(--app-font-scale, 1))" }}>{label}</div>
        <div style={{
          width: 30, height: 30, borderRadius: 9, background: "var(--surface-hover)",
          display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>

      <div dir="auto" className="kpi-value bidi-auto" style={{ marginTop: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", position: "relative" }}>
        {numericValue !== undefined ? <AnimatedNumber value={numericValue} suffix={suffix} /> : value}
      </div>
      {insight && <div style={{ marginTop: 4, position: "relative" }}>{insight}</div>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-muted empty-pop" style={{ fontSize: "calc(13px * var(--app-font-scale, 1))", padding: "10px 0" }}>{text}</p>;
}

