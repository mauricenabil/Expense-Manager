import { useState } from "react";
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

/* ============================================================
   لوحة ألوان الرسوم — مربوطة بمتغيرات الثيم، فتتبدّل تلقائياً
   بين الوضع الفاتح والداكن بدون أي كود إضافي.
   ============================================================ */
export const PALETTE = [
  "var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)",
  "var(--c5)", "var(--c6)", "var(--c7)", "var(--c8)",
];

/* ألوان الفئات القديمة المحفوظة في قاعدة البيانات تُترجم تلقائياً
   لألوان الهوية الجديدة، فتبان بياناتك القديمة بالتصميم الجديد
   بدون ما تعدّل أي فئة يدوياً. أي لون آخر (اخترته بنفسك) يُترك كما هو. */
const LEGACY_MAP: Record<string, string> = {
  "#4DA3FF": "var(--c4)",
  "#FF8A65": "var(--c2)",
  "#66BB6A": "var(--c1)",
  "#FFC107": "var(--c3)",
  "#AB47BC": "var(--c5)",
  "#EF5350": "var(--c6)",
  "#26C6DA": "var(--c7)",
  "#8AA0BD": "var(--c8)",
};

export function chartColor(color: string | undefined, index: number): string {
  if (!color) return PALETTE[index % PALETTE.length];
  return LEGACY_MAP[color.toUpperCase()] || color;
}

const fmt = (n: number) => `${Math.round(n).toLocaleString("en-US")} EGP`;

const AXIS_TICK = { fill: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-sans)" };
const GRID_STROKE = "var(--border)";

/* ============================================================
   Custom Tooltip — مشترك بين كل الرسوم
   ============================================================ */
function ProTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={tooltipBox}>
      {label && (
        <div dir="auto" className="bidi-auto" style={{ fontWeight: 600, marginBottom: 8, color: "var(--text)", fontSize: "calc(12px * var(--app-font-scale, 1) * var(--ar-font-scale, 1))" }}>
          {label}
        </div>
      )}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: p.color || p.fill, flexShrink: 0 }} />
          <span dir="auto" className="bidi-auto" style={{ color: "var(--text-muted)", fontSize: "calc(11px * var(--app-font-scale, 1) * var(--ar-font-scale, 1))" }}>{p.name}</span>
          <strong style={{ color: "var(--text)", marginInlineStart: "auto", fontSize: "calc(12px * var(--app-font-scale, 1))", fontVariantNumeric: "tabular-nums" }}>
            {typeof p.value === "number" ? fmt(p.value) : p.value}
          </strong>
        </div>
      ))}
    </div>
  );
}

const tooltipBox = {
  background: "var(--surface)",
  border: "1px solid var(--border-strong)",
  borderRadius: 12,
  padding: "11px 14px",
  boxShadow: "var(--shadow-lg)",
  fontSize: "calc(12px * var(--app-font-scale, 1))",
  minWidth: 168,
  backdropFilter: "blur(6px)",
} as const;

/* ============================================================
   Bar Chart — أعمدة بتدرّج رأسي ناعم وحواف مستديرة
   ============================================================ */
export function ProBarChart({ data }: { data: { label: string; value: number; color?: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 12, right: 8, left: -12, bottom: 0 }} barCategoryGap="28%">
        <defs>
          {data.map((d, i) => {
            const c = chartColor(d.color, i);
            return (
              <linearGradient key={i} id={`barGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity={1} />
                <stop offset="100%" stopColor={c} stopOpacity={0.38} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid strokeDasharray="2 6" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} dy={6} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={58} />
        <Tooltip content={<ProTooltip />} cursor={{ fill: "var(--accent-soft)", radius: 10 }} />
        <Bar dataKey="value" name="Amount" radius={[10, 10, 3, 3]} isAnimationActive animationDuration={800} animationEasing="ease-out">
          {data.map((_d, i) => <Cell key={i} fill={`url(#barGrad${i})`} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ============================================================
   Area Chart — منحنى ناعم بتعبئة متدرجة
   ============================================================ */
export function ProAreaChart({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.30} />
            <stop offset="55%" stopColor="var(--accent)" stopOpacity={0.09} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 6" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={20} dy={6} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={58} />
        <Tooltip content={<ProTooltip />} cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeDasharray: "3 4", strokeOpacity: 0.6 }} />
        <Area
          type="monotone" dataKey="value" name="Spending" stroke="var(--accent)" strokeWidth={2.25}
          fill="url(#areaGrad)" dot={false}
          activeDot={{ r: 5, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2.5 }}
          isAnimationActive animationDuration={800} animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ============================================================
   Donut Chart — حلقة رفيعة أنيقة + المجموع في المنتصف
   ============================================================ */
export function ProDonutChart({ data }: { data: { label: string; value: number; color?: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: 208, height: 208, flexShrink: 0 }}>
        <ResponsiveContainer width={208} height={208}>
          <PieChart>
            <Pie
              data={data} dataKey="value" nameKey="label" cx="50%" cy="50%"
              innerRadius={68} outerRadius={94} paddingAngle={2.5} cornerRadius={8}
              isAnimationActive animationDuration={800} animationEasing="ease-out"
            >
              {data.map((d, i) => (
                <Cell key={i} fill={chartColor(d.color, i)} stroke="var(--surface)" strokeWidth={2.5} />
              ))}
            </Pie>
            <Tooltip content={<ProTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* المجموع في قلب الحلقة — يوفّر قراءة فورية بدون تمرير الماوس */}
        <div style={donutCenter}>
          <div className="eyebrow" style={{ fontSize: "calc(9px * var(--app-font-scale, 1))" }}>Total</div>
          <div className="display" style={{ fontSize: "calc(22px * var(--app-font-scale, 1) * var(--num-font-scale, 1))", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
            {Math.round(total).toLocaleString("en-US")}
          </div>
          <div className="text-muted" style={{ fontSize: "calc(10px * var(--app-font-scale, 1))", letterSpacing: ".08em" }}>EGP</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 180 }}>
        {data.map((d, i) => {
          const pct = Math.round((d.value / total) * 100);
          return (
            <div key={d.label} style={legendRow}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: chartColor(d.color, i), flexShrink: 0 }} />
              <span dir="auto" className="bidi-auto" style={{ fontSize: "calc(12.5px * var(--app-font-scale, 1) * var(--ar-font-scale, 1))", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.label}
              </span>
              <span className="text-muted" style={{ fontSize: "calc(11.5px * var(--app-font-scale, 1))", fontVariantNumeric: "tabular-nums" }}><span className="num">{fmt(d.value)}</span></span>
              <span style={pctPill}><span className="num">{pct}%</span></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const donutCenter = {
  position: "absolute" as const,
  inset: 0,
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none" as const,
  lineHeight: 1.15,
};

const legendRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "7px 2px",
  borderBottom: "1px solid var(--border)",
};

const pctPill = {
  fontSize: "calc(10.5px * var(--app-font-scale, 1))",
  fontWeight: 700,
  padding: "2px 7px",
  borderRadius: 99,
  background: "var(--surface-hover)",
  color: "var(--text-muted)",
  minWidth: 38,
  textAlign: "center" as const,
  fontVariantNumeric: "tabular-nums" as const,
};

/* ============================================================
   Daily Area Chart — مخصص للبيانات اليومية (Daily Spending Trend)
   يضمن ظهور كل التواريخ بدون حذف، مع rotation تلقائي عند الكثافة.
   [نفس المنطق الأصلي بالكامل — التغيير في الشكل فقط]
   ============================================================ */
export function ProDailyAreaChart({ data }: { data: { label: string; value: number }[] }) {
  const count = data.length;
  const rotated = count > 14;
  const maxVal = Math.max(...data.map((d) => d.value), 0);
  // Y-axis: نحسب الحد الأعلى تلقائياً بناءً على أعلى قيمة + 18% padding
  const yMax = maxVal > 0 ? Math.ceil(maxVal * 1.18) : 10;

  return (
    <ResponsiveContainer width="100%" height={rotated ? 300 : 260}>
      <AreaChart data={data} margin={{ top: 12, right: 8, left: -12, bottom: rotated ? 60 : 0 }}>
        <defs>
          <linearGradient id="dailyAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.32} />
            <stop offset="55%" stopColor="var(--accent)" stopOpacity={0.10} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 6" stroke={GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ ...AXIS_TICK, fontSize: count > 25 ? 9 : count > 14 ? 10 : 11, textAnchor: rotated ? "end" : "middle" }}
          axisLine={false} tickLine={false}
          interval={0} angle={rotated ? -45 : 0} height={rotated ? 60 : 30} dy={rotated ? 0 : 6}
        />
        <YAxis
          tick={AXIS_TICK} axisLine={false} tickLine={false} width={58}
          domain={[0, yMax]} allowDataOverflow={false}
        />
        <Tooltip content={<ProTooltip />} cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeDasharray: "3 4", strokeOpacity: 0.6 }} />
        <Area
          type="monotone" dataKey="value" name="Spending" stroke="var(--accent)" strokeWidth={2.25}
          fill="url(#dailyAreaGrad)" dot={false}
          activeDot={{ r: 5, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2.5 }}
          isAnimationActive animationDuration={800} animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ============================================================
   Category Trend — خطوط متعددة الفئات عبر الشهور
   ============================================================ */
export function ProCategoryTrend({ data, categories }: {
  data: { month: string; [cat: string]: string | number }[];
  categories: string[];
}) {
  if (!data.length || !categories.length) return null;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 6" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} dy={6} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={58} />
        <Tooltip content={<ProTooltip />} cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 4" }} />
        <Legend wrapperStyle={{ fontSize: "calc(11px * var(--app-font-scale, 1))", color: "var(--text-muted)", paddingTop: 14 }} iconType="circle" iconSize={8} />
        {categories.map((cat, i) => (
          <Line
            key={cat} type="monotone" dataKey={cat} name={cat}
            stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.25}
            dot={false} activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--surface)" }}
            isAnimationActive animationDuration={800} animationEasing="ease-out"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ============================================================
   Weekday Analysis — Bar Chart بأيام الأسبوع
   اللون يعبّر عن شدة الصرف (بارد ← ساخن) على تدرّج الهوية
   ============================================================ */
export function ProWeekdayChart({ data }: { data: { day: string; amount: number; count: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.amount), 1);

  const heatFor = (amount: number) => {
    const intensity = maxVal > 0 ? amount / maxVal : 0;
    if (intensity > 0.75) return "var(--c6)";
    if (intensity > 0.50) return "var(--c2)";
    if (intensity > 0.25) return "var(--c3)";
    return "var(--c1)";
  };

  const WeekdayTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = data.find((x) => x.day === label);
    return (
      <div style={tooltipBox}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
        <Row k="Total" v={fmt(payload[0]?.value || 0)} />
        {d && <Row k="Transactions" v={String(d.count)} />}
        {d && d.count > 0 && <Row k="Average" v={fmt(d.amount / d.count)} />}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 12, right: 8, left: -12, bottom: 0 }} barCategoryGap="26%">
        <defs>
          {data.map((d, i) => {
            const color = heatFor(d.amount);
            return (
              <linearGradient key={i} id={`wdGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={1} />
                <stop offset="100%" stopColor={color} stopOpacity={0.38} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid strokeDasharray="2 6" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} dy={6} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={58} />
        <Tooltip content={<WeekdayTooltip />} cursor={{ fill: "var(--accent-soft)", radius: 10 }} />
        <Bar dataKey="amount" name="Spending" radius={[10, 10, 3, 3]} isAnimationActive animationDuration={800}>
          {data.map((_d, i) => <Cell key={i} fill={`url(#wdGrad${i})`} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", gap: 14, marginTop: 3 }}>
      <span style={{ color: "var(--text-muted)", fontSize: "calc(11px * var(--app-font-scale, 1))" }}>{k}</span>
      <strong className="num" style={{ color: "var(--text)", marginInlineStart: "auto", fontSize: "calc(12px * var(--app-font-scale, 1) * var(--num-font-scale, 1))", fontVariantNumeric: "tabular-nums" }}>{v}</strong>
    </div>
  );
}

/* ============================================================
   Spending Heatmap — شبكة سنوية بـ SVG خالص
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

  // توزيع البيانات على شبكة الأسابيع (53 أسبوع × 7 أيام)
  const cells: HeatmapCell[] = data.map((d) => {
    const date = new Date(d.date);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
    const weekIndex = Math.floor(dayOfYear / 7);
    const dayOfWeek = date.getDay();
    return { date: d.date, amount: d.amount, weekIndex, dayOfWeek };
  });

  const getColor = (amount: number) => {
    if (amount === 0) return "var(--heat-0)";
    const intensity = amount / maxAmount;
    if (intensity > 0.75) return "var(--heat-4)";
    if (intensity > 0.50) return "var(--heat-3)";
    if (intensity > 0.25) return "var(--heat-2)";
    return "var(--heat-1)";
  };

  const cellSize = 13, gap = 3, labelWidth = 32;
  const totalWeeks = 53;
  const svgWidth = labelWidth + totalWeeks * (cellSize + gap);
  const svgHeight = 7 * (cellSize + gap) + 26;

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  return (
    <div style={{ overflowX: "auto", position: "relative", paddingBottom: 4 }}>
      <svg width={svgWidth} height={svgHeight}>
        {/* Month labels */}
        {MONTHS.map((m, mi) => (
          <text key={m} x={labelWidth + mi * Math.floor(totalWeeks / 12) * (cellSize + gap)} y={10}
            fill="var(--text-faint)" fontSize={9.5} letterSpacing=".08em" fontWeight={600}>{m.toUpperCase()}</text>
        ))}

        {/* Day labels */}
        {[1, 3, 5].map((d) => (
          <text key={d} x={0} y={20 + d * (cellSize + gap) + cellSize / 2}
            fill="var(--text-faint)" fontSize={9} dominantBaseline="middle">{DAYS[d]}</text>
        ))}

        {/* Cells */}
        {cells.map((c) => (
          <rect
            key={c.date}
            x={labelWidth + c.weekIndex * (cellSize + gap)}
            y={18 + c.dayOfWeek * (cellSize + gap)}
            width={cellSize} height={cellSize} rx={4}
            fill={getColor(c.amount)}
            style={{ cursor: "pointer", transition: "opacity .15s, transform .15s", transformBox: "fill-box", transformOrigin: "center" }}
            opacity={hovered && hovered.date !== c.date ? 0.55 : 1}
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
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 10 }}>
        <span className="text-muted" style={{ fontSize: "calc(10px * var(--app-font-scale, 1))" }}>Less</span>
        {["var(--heat-0)", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)"].map((c, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: 4, background: c }} />
        ))}
        <span className="text-muted" style={{ fontSize: "calc(10px * var(--app-font-scale, 1))" }}>More</span>
      </div>

      {/* Floating Tooltip */}
      {hovered && hovered.amount > 0 && (
        <div style={{
          position: "fixed", left: tooltipPos.x + 14, top: tooltipPos.y - 44,
          background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: 10,
          padding: "7px 11px", boxShadow: "var(--shadow-lg)", fontSize: "calc(11px * var(--app-font-scale, 1))", zIndex: 400,
          pointerEvents: "none", whiteSpace: "nowrap",
        }}>
          <strong style={{ fontVariantNumeric: "tabular-nums" }}>{hovered.date}</strong><br />
          <span className="num" style={{ color: "var(--accent)", fontWeight: 700 }}>{fmt(hovered.amount)}</span>
        </div>
      )}
    </div>
  );
}

export { Legend };
