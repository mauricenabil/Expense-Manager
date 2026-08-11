import { useState } from "react";
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export const PALETTE = ["#4DA3FF", "#FF8A65", "#66BB6A", "#FFC107", "#AB47BC", "#EF5350", "#26C6DA", "#8AA0BD"];

const fmt = (n: number) => `${Math.round(n).toLocaleString("en-US")} EGP`;

/* ============================================================
   Custom Tooltip — مشترك بين كل الرسوم
   ============================================================ */
function ProTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
      padding: "10px 14px", boxShadow: "var(--shadow)", fontSize: 12, minWidth: 140,
    }}>
      {label && <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--text)" }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.fill, flexShrink: 0 }} />
          <span style={{ color: "var(--text-muted)" }}>{p.name}:</span>
          <strong style={{ color: "var(--text)" }}>{typeof p.value === "number" ? fmt(p.value) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   Bar Chart — rounded gradient bars + animated
   ============================================================ */
export function ProBarChart({ data }: { data: { label: string; value: number; color?: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          {data.map((d, i) => (
            <linearGradient key={i} id={`barGrad${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={d.color || PALETTE[i % PALETTE.length]} stopOpacity={0.95} />
              <stop offset="100%" stopColor={d.color || PALETTE[i % PALETTE.length]} stopOpacity={0.50} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<ProTooltip />} cursor={{ fill: "var(--accent-soft)" }} />
        <Bar dataKey="value" name="Amount" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={700} animationEasing="ease-out">
          {data.map((_d, i) => <Cell key={i} fill={`url(#barGrad${i})`} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ============================================================
   Area Chart — smooth gradient fill + animated
   ============================================================ */
export function ProAreaChart({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} minTickGap={20} />
        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<ProTooltip />} cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeDasharray: "4 4" }} />
        <Area
          type="monotone" dataKey="value" name="Spending" stroke="var(--accent)" strokeWidth={2.5}
          fill="url(#areaGrad)" dot={{ r: 0 }} activeDot={{ r: 5, fill: "var(--accent)", strokeWidth: 0 }}
          isAnimationActive animationDuration={700} animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ============================================================
   Donut Chart — rounded segments + interactive legend
   ============================================================ */
export function ProDonutChart({ data }: { data: { label: string; value: number; color?: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <ResponsiveContainer width={200} height={200}>
        <PieChart>
          <Pie
            data={data} dataKey="value" nameKey="label" cx="50%" cy="50%"
            innerRadius={56} outerRadius={82} paddingAngle={3} cornerRadius={6}
            isAnimationActive animationDuration={700} animationEasing="ease-out"
          >
            {data.map((_d, i) => <Cell key={i} fill={data[i].color || PALETTE[i % PALETTE.length]} stroke="var(--surface)" strokeWidth={2} />)}
          </Pie>
          <Tooltip content={<ProTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 140 }}>
        {data.map((d, i) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color || PALETTE[i % PALETTE.length], flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{d.label}</div>
              <div className="text-muted" style={{ fontSize: 11 }}>{fmt(d.value)} · {Math.round((d.value / total) * 100)}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Daily Area Chart — مخصص للبيانات اليومية (Daily Spending Trend)
   يضمن ظهور كل التواريخ بدون حذف، مع rotation تلقائي عند الكثافة.
   فرق جوهري عن ProAreaChart: interval=0 + rotation عند > 14 نقطة.
   ============================================================ */
export function ProDailyAreaChart({ data }: { data: { label: string; value: number }[] }) {
  const count = data.length;
  const rotated = count > 14;
  const maxVal = Math.max(...data.map((d) => d.value), 0);
  // Y-axis: نحسب الحد الأعلى تلقائياً بناءً على أعلى قيمة + 15% padding
  // لو كل القيم صفر نحط حد افتراضي صغير عشان الخط يبان
  const yMax = maxVal > 0 ? Math.ceil(maxVal * 1.18) : 10;

  return (
    <ResponsiveContainer width="100%" height={rotated ? 300 : 260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: rotated ? 60 : 0 }}>
        <defs>
          <linearGradient id="dailyAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--text-muted)", fontSize: count > 25 ? 9 : count > 14 ? 10 : 11,
            textAnchor: rotated ? "end" : "middle" }}
          axisLine={{ stroke: "var(--border)" }} tickLine={false}
          interval={0} angle={rotated ? -45 : 0} height={rotated ? 60 : 30}
        />
        <YAxis
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={false} tickLine={false}
          domain={[0, yMax]}
          allowDataOverflow={false}
        />
        <Tooltip content={<ProTooltip />} cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeDasharray: "4 4" }} />
        <Area
          type="monotone" dataKey="value" name="Spending" stroke="var(--accent)" strokeWidth={2.5}
          fill="url(#dailyAreaGrad)" dot={{ r: 0 }} activeDot={{ r: 5, fill: "var(--accent)", strokeWidth: 0 }}
          isAnimationActive animationDuration={700} animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}


export function ProCategoryTrend({ data, categories }: {
  data: { month: string; [cat: string]: string | number }[];
  categories: string[];
}) {
  if (!data.length || !categories.length) return null;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<ProTooltip />} cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }} />
        <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)", paddingTop: 8 }} />
        {categories.map((cat, i) => (
          <Line
            key={cat} type="monotone" dataKey={cat} name={cat}
            stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.5}
            dot={{ r: 0 }} activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive animationDuration={700} animationEasing="ease-out"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ============================================================
   Weekday Analysis — Bar Chart بأيام الأسبوع
   ============================================================ */
export function ProWeekdayChart({ data }: { data: { day: string; amount: number; count: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.amount), 1);

  const WeekdayTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = data.find((x) => x.day === label);
    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", boxShadow: "var(--shadow)", fontSize: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
        <div style={{ color: "var(--text-muted)" }}>Total: <strong style={{ color: "var(--text)" }}>{fmt(payload[0]?.value || 0)}</strong></div>
        {d && <div style={{ color: "var(--text-muted)" }}>Transactions: <strong style={{ color: "var(--text)" }}>{d.count}</strong></div>}
        {d && d.count > 0 && <div style={{ color: "var(--text-muted)" }}>Average: <strong style={{ color: "var(--text)" }}>{fmt(d.amount / d.count)}</strong></div>}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          {data.map((d, i) => {
            const intensity = maxVal > 0 ? d.amount / maxVal : 0;
            const color = intensity > 0.75 ? "#EF5350" : intensity > 0.5 ? "#FFC107" : intensity > 0.25 ? "#4DA3FF" : "#66BB6A";
            return (
              <linearGradient key={i} id={`wdGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={color} stopOpacity={0.5} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="day" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<WeekdayTooltip />} cursor={{ fill: "var(--accent-soft)" }} />
        <Bar dataKey="amount" name="Spending" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={700}>
          {data.map((_d, i) => <Cell key={i} fill={`url(#wdGrad${i})`} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ============================================================
   Spending Heatmap — GitHub-style yearly heatmap بـ SVG خالص
   لأن Recharts ما عندهاش heatmap مدمج
   ============================================================ */
interface HeatmapCell {
  date: string;
  amount: number;
  weekIndex: number;
  dayOfWeek: number;
}

export function ProHeatmap({ data }: { data: { date: string; amount: number }[] }) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const maxAmount = Math.max(...data.map((d) => d.amount), 1);

  // توزيع البيانات على شبكة الأسابيع (52 أسبوع × 7 أيام)
  const cells: HeatmapCell[] = data.map((d) => {
    const date = new Date(d.date);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
    const weekIndex = Math.floor(dayOfYear / 7);
    const dayOfWeek = date.getDay();
    return { date: d.date, amount: d.amount, weekIndex, dayOfWeek };
  });

  const getColor = (amount: number) => {
    if (amount === 0) return "var(--surface-hover)";
    const intensity = amount / maxAmount;
    if (intensity > 0.75) return "#EF5350";
    if (intensity > 0.50) return "#FF8A65";
    if (intensity > 0.25) return "#FFC107";
    return "#4DA3FF55";
  };

  const cellSize = 13, gap = 2, labelWidth = 30;
  const totalWeeks = 53;
  const svgWidth = labelWidth + totalWeeks * (cellSize + gap);
  const svgHeight = 7 * (cellSize + gap) + 24;

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  return (
    <div style={{ overflowX: "auto", position: "relative" }}>
      <svg width={svgWidth} height={svgHeight}>
        {/* Month labels */}
        {MONTHS.map((m, mi) => (
          <text key={m} x={labelWidth + mi * Math.floor(totalWeeks / 12) * (cellSize + gap)} y={10}
            fill="var(--text-muted)" fontSize={10}>{m}</text>
        ))}

        {/* Day labels */}
        {[1, 3, 5].map((d) => (
          <text key={d} x={0} y={20 + d * (cellSize + gap) + cellSize / 2}
            fill="var(--text-muted)" fontSize={9} dominantBaseline="middle">{DAYS[d]}</text>
        ))}

        {/* Cells */}
        {cells.map((c) => (
          <rect
            key={c.date}
            x={labelWidth + c.weekIndex * (cellSize + gap)}
            y={18 + c.dayOfWeek * (cellSize + gap)}
            width={cellSize} height={cellSize} rx={3}
            fill={getColor(c.amount)}
            style={{ cursor: "pointer", transition: "opacity 0.15s" }}
            opacity={hovered && hovered.date !== c.date ? 0.7 : 1}
            onMouseEnter={(e) => {
              setHovered(c);
              setTooltipPos({ x: e.clientX, y: e.clientY });
            }}
            onMouseLeave={() => setHovered(null)}
            onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
          />
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Less</span>
        {["var(--surface-hover)", "#4DA3FF55", "#FFC107", "#FF8A65", "#EF5350"].map((c, i) => (
          <div key={i} style={{ width: 11, height: 11, borderRadius: 3, background: c }} />
        ))}
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>More</span>
      </div>

      {/* Floating Tooltip */}
      {hovered && hovered.amount > 0 && (
        <div style={{
          position: "fixed", left: tooltipPos.x + 12, top: tooltipPos.y - 40,
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
          padding: "6px 10px", boxShadow: "var(--shadow)", fontSize: 11, zIndex: 400,
          pointerEvents: "none", whiteSpace: "nowrap",
        }}>
          <strong>{hovered.date}</strong><br />
          {fmt(hovered.amount)}
        </div>
      )}
    </div>
  );
}

export { Legend };
