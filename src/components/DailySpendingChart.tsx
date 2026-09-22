import { useMemo, useRef } from "react";
import ReactApexChart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";

/* ===================================================================
   Daily Spending Trend — ApexCharts Area
   -------------------------------------------------------------------
   بديل كامل لـ ProDailyAreaChart المبني على recharts.

   لماذا ApexCharts هنا:
   - منحنى smooth حقيقي (Catmull-Rom) بدل monotone الحاد في recharts.
   - dropShadow مدعوم على الـ stroke وحده، فنحصل على توهّج حول الخط
     بدون ما التعبئة المتدرّجة تتلوّث بظل رمادي.
   - تحكّم دقيق في الـ gradient stops.

   ملاحظة مهمة جداً:
   ApexCharts يقرأ الألوان في JavaScript (يبني تدرّجات SVG وقت التشغيل)،
   لذلك لا يقبل قيم مثل "var(--accent)" — تطلع سوداء أو تختفي.
   لهذا السبب المكوّن يستقبل isDarkMode ويحوّل الثيم لقيَم hex حقيقية.
   الـ Tooltip وحده HTML عادي في الـ DOM فيستخدم متغيّرات CSS مباشرة.
   =================================================================== */

export interface DailySpendingChartProps {
  /** التواريخ بصيغة YYYY-MM-DD (أو أي label جاهز للعرض) */
  dates: string[];
  /** المبالغ — نفس ترتيب وطول dates */
  amounts: number[];
  /** يأتي من ThemeContext: theme === "dark" */
  isDarkMode: boolean;
  /** رمز العملة المعروض في الـ Tooltip والمحور */
  currency?: string;
  height?: number;
  /** اسم السلسلة في الـ Tooltip */
  seriesName?: string;
  /** إظهار نقاط بارزة تلقائياً على أيام الصرف الشاذ (Spikes) */
  highlightSpikes?: boolean;
}

/* --- لوحة الألوان: أخضر زمردي، درجة لكل وضع --- */
const THEME = {
  dark: {
    accent: "#34D399",      // Emerald 400 — مضيء على خلفية ليلية
    accentDeep: "#10B981",  // نهاية التدرّج العلوي
    glow: "#34D399",
    text: "#A4ACB7",
    textStrong: "#F2EEE3",
    grid: "#323B48",
    markerRing: "#1F2733",
    spike: "#F0B945",
  },
  light: {
    accent: "#059669",      // Emerald 600 — تباين كافٍ على ورق فاتح
    accentDeep: "#047857",
    glow: "#059669",
    text: "#637083",
    textStrong: "#232E3E",
    grid: "#E2DBD0",
    markerRing: "#FDFBF7",
    spike: "#C98A1E",
  },
} as const;

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** 12 Mar — تسمية مختصرة وثابتة العرض، وتتجاهل المنطقة الزمنية */
function shortLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
}

function longLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return `${DAYS[d.getDay()]} · ${shortLabel(iso)} ${m[1]}`;
}

/**
 * كشف القفزات الحادة (Spikes) إحصائياً بدل عتبة ثابتة.
 * نستخدم المتوسط + انحرافين معياريين على الأيام غير الصفرية فقط،
 * لأن أيام الصفر تسحب المتوسط لأسفل وتجعل كل يوم عادي يبدو شاذاً.
 * المنحنى الناعم يبلع القمم القصيرة بصرياً، فنعلّمها بنقطة ظاهرة
 * بدل ما نكسر نعومة الخط أو نزوّر البيانات.
 */
function detectSpikes(values: number[]): number[] {
  const active = values.filter((v) => v > 0);
  if (active.length < 4) return [];
  const mean = active.reduce((s, v) => s + v, 0) / active.length;
  const variance = active.reduce((s, v) => s + (v - mean) ** 2, 0) / active.length;
  const sd = Math.sqrt(variance);
  if (sd === 0) return [];
  const threshold = mean + sd * 2;
  const out: number[] = [];
  values.forEach((v, i) => { if (v > threshold) out.push(i); });
  return out;
}

export default function DailySpendingChart({
  dates,
  amounts,
  isDarkMode,
  currency = "EGP",
  height = 300,
  seriesName = "Spending",
  highlightSpikes = true,
}: DailySpendingChartProps) {
  const c = isDarkMode ? THEME.dark : THEME.light;

  // معرّف ثابت طوال عمر المكوّن — لو تغيّر كل render، ApexCharts
  // يعيد تسجيل الرسم في الـ registry الداخلي ويسرّب نُسخاً قديمة.
  const idRef = useRef(`daily-spend-${Math.random().toString(36).slice(2, 9)}`);

  const spikes = useMemo(
    () => (highlightSpikes ? detectSpikes(amounts) : []),
    [amounts, highlightSpikes]
  );

  /* أعلى قيمة + 18% مساحة تنفّس. مهم مع curve:'smooth' تحديداً،
     لأن المنحنى الناعم يتجاوز أعلى نقطة قليلاً فتتقصّ القمة بدون هذا الهامش. */
  const yMax = useMemo(() => {
    const max = Math.max(...amounts, 0);
    return max > 0 ? Math.ceil((max * 1.18) / 10) * 10 : 10;
  }, [amounts]);

  const dense = dates.length > 20;

  const options: ApexOptions = useMemo(() => ({
    chart: {
      id: idRef.current,
      type: "area",
      height,
      fontFamily: "var(--font-sans)",
      background: "transparent",
      toolbar: { show: false },
      zoom: { enabled: false },
      // parentHeightOffset الافتراضي (15px) يفتح فراغاً أعلى البطاقة
      parentHeightOffset: 0,
      animations: {
        enabled: true,
        easing: "easeinout",
        speed: 650,
        animateGradually: { enabled: false },
        dynamicAnimation: { enabled: true, speed: 350 },
      },
      dropShadow: {
        // التوهّج على الخط فقط — enabledOnSeries يمنع سريانه على التعبئة
        enabled: true,
        enabledOnSeries: [0],
        top: 3,
        left: 0,
        blur: 9,
        color: c.glow,
        opacity: isDarkMode ? 0.55 : 0.28,
      },
    },

    colors: [c.accent],

    stroke: {
      curve: "smooth",
      width: 2.75,
      lineCap: "round",
    },

    fill: {
      type: "gradient",
      gradient: {
        shade: isDarkMode ? "dark" : "light",
        type: "vertical",
        shadeIntensity: 0,
        gradientToColors: [c.accentDeep],
        inverseColors: false,
        opacityFrom: isDarkMode ? 0.42 : 0.30,
        opacityTo: 0,
        stops: [0, 55, 100],
      },
    },

    dataLabels: { enabled: false },

    markers: {
      size: 0,
      strokeWidth: 0,
      hover: { size: 6, sizeOffset: 0 },
      // نقاط ثابتة على أيام القفزات فقط
      discrete: spikes.map((i) => ({
        seriesIndex: 0,
        dataPointIndex: i,
        fillColor: c.spike,
        strokeColor: c.markerRing,
        size: 4.5,
        shape: "circle" as const,
      })),
    },

    grid: {
      show: true,
      borderColor: c.grid,
      strokeDashArray: 4,
      position: "back",
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      padding: { top: 4, right: 8, bottom: dense ? 8 : 0, left: 4 },
    },

    xaxis: {
      categories: dates.map(shortLabel),
      tickPlacement: "on",
      // لا نمرّر interval ثابت: Apex يوزّع التسميات تلقائياً عبر tickAmount
      tickAmount: Math.min(dates.length, dense ? 8 : 12),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { colors: c.text, fontSize: dense ? "10px" : "11px", fontFamily: "var(--font-sans)" },
        rotate: 0,
        hideOverlappingLabels: true,
        trim: false,
        offsetY: 2,
      },
      crosshairs: {
        show: true,
        stroke: { color: c.accent, width: 1, dashArray: 4 },
      },
      tooltip: { enabled: false },
    },

    yaxis: {
      min: 0,          // يمنع المنحنى الناعم من الانحدار تحت الصفر عند القفزات
      max: yMax,
      forceNiceScale: true,
      tickAmount: 4,
      labels: {
        style: { colors: c.text, fontSize: "11px", fontFamily: "var(--font-sans)" },
        formatter: (v: number) =>
          v >= 1000 ? `${nf.format(v / 1000)}k` : nf.format(v),
      },
    },

    tooltip: {
      // Tooltip مخصّص بالكامل: HTML عادي، فيقرأ متغيّرات الثيم مباشرة
      // ويتبدّل مع الوضع الفاتح/الداكن بدون أي كود إضافي.
      custom: ({ series, seriesIndex, dataPointIndex }: any) => {
        const value = series[seriesIndex][dataPointIndex] ?? 0;
        const iso = dates[dataPointIndex] ?? "";
        const isSpike = spikes.includes(dataPointIndex);
        return `
          <div class="apex-tip" dir="auto">
            <div class="apex-tip-date">${longLabel(iso)}</div>
            <div class="apex-tip-row">
              <span class="apex-tip-dot" style="background:${isSpike ? c.spike : c.accent}"></span>
              <span class="apex-tip-label">${seriesName}</span>
              <strong class="apex-tip-value">${nf2.format(value)} ${currency}</strong>
            </div>
            ${isSpike ? `<div class="apex-tip-note">Unusually high for this period</div>` : ""}
          </div>`;
      },
      // نطفي الإطار الافتراضي عشان ما يظهرش مربع أبيض خلف الـ HTML بتاعنا
      fixed: { enabled: false },
      marker: { show: false },
    },

    states: {
      hover: { filter: { type: "none" } },
      active: { filter: { type: "none" } },
    },

    legend: { show: false },

    noData: {
      text: "No spending recorded in this period",
      style: { color: c.text, fontSize: "13px", fontFamily: "var(--font-sans)" },
    },
  }), [c, isDarkMode, dates, spikes, yMax, height, dense, currency, seriesName]);

  const series = useMemo(
    () => [{ name: seriesName, data: amounts }],
    [amounts, seriesName]
  );

  return (
    <div className="apex-wrap chart-in">
      <ReactApexChart
        // إعادة البناء الكاملة عند تبديل الثيم: التوهّج والتدرّج يتولّدان
        // كـ SVG filters وقت الإنشاء، فالتحديث الجزئي يبقي ألوان الوضع القديم.
        key={isDarkMode ? "dark" : "light"}
        options={options}
        series={series}
        type="area"
        height={height}
      />
    </div>
  );
}
