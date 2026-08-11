export type RangeKey =
  | "today" | "yesterday" | "week" | "lastWeek" | "month" | "lastMonth"
  | "year" | "lastYear" | "all" | "custom";

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "lastWeek", label: "Last Week" },
  { key: "month", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "year", label: "This Year" },
  { key: "lastYear", label: "Last Year" },
  { key: "all", label: "All Time" },
  { key: "custom", label: "Custom Range" },
];

/** خيارات خاصة بالـ Monthly Trend — تُعبّر عن فترات بالأشهر لا الأيام */
export const MONTHLY_RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "year",      label: "This Year" },
  { key: "lastYear",  label: "Last Year" },
  { key: "month",     label: "Last 12 Months" },
  { key: "lastMonth", label: "Last 24 Months" },
  { key: "all",       label: "All Time" },
  { key: "custom",    label: "Custom Range" },
];

export type WeekStart = 0 | 1 | 6; // 0=Sunday, 1=Monday, 6=Saturday

/** أول يوم في الأسبوع الحالي للتاريخ المُعطى، باعتبار weekStart المُختار */
function startOfWeek(date: Date, weekStart: WeekStart): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface DateFilterValue {
  range: RangeKey;
  customFrom?: string;
  customTo?: string;
}

/** يحوّل أي فلتر مُختار لتاريخين from/to (ISO YYYY-MM-DD)، أو null/null لو "All Time" */
export function resolveDateRange(filter: DateFilterValue, weekStart: WeekStart = 0): { from: string | null; to: string | null } {
  const now = new Date();
  // استخدام مكوّنات التاريخ المحلية مباشرة بدل toISOString()
  // لأن toISOString() تحوّل للـ UTC فتظهر Cairo +3 يوم سابق
  // مثال: new Date(2026,5,1) في Cairo → "2026-05-31T21:00:00Z" → خطأ
  const toISO = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  switch (filter.range) {
    case "today": {
      const iso = toISO(now);
      return { from: iso, to: iso };
    }
    case "yesterday": {
      const y = new Date(now); y.setDate(now.getDate() - 1);
      const iso = toISO(y);
      return { from: iso, to: iso };
    }
    case "week": {
      const start = startOfWeek(now, weekStart);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      return { from: toISO(start), to: toISO(end) };
    }
    case "lastWeek": {
      const start = startOfWeek(now, weekStart); start.setDate(start.getDate() - 7);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      return { from: toISO(start), to: toISO(end) };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: toISO(start), to: toISO(end) };
    }
    case "lastMonth": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toISO(start), to: toISO(end) };
    }
    case "year": {
      return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
    }
    case "lastYear": {
      const y = now.getFullYear() - 1;
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
    case "custom":
      return { from: filter.customFrom || null, to: filter.customTo || null };
    case "all":
    default:
      return { from: null, to: null };
  }
}

export function isWithinRange(date: string, from: string | null, to: string | null): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function weekdayLabels(weekStart: WeekStart): string[] {
  const base = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return [...base.slice(weekStart), ...base.slice(0, weekStart)];
}

/**
 * يولّد قائمة كاملة بكل أيام الفترة المحددة بالضبط (بدون أي يوم ناقص أو زائد).
 *
 * السبب: new Date("YYYY-MM-DD") يُفسَّر كـ UTC midnight، فلو الجهاز في timezone
 * موجبة (مثل Cairo +3) وبنتعامل بـ .getDate()/.getMonth() بعدها،
 * بيحصل drift يخلي اليوم الأول يبان على أنه اليوم الأخير من الشهر السابق.
 * الحل: نشتغل بـ UTC خالص في كل الحسابات الداخلية.
 *
 * @param filter الفلتر المختار
 * @param weekStart أول يوم في الأسبوع (0=Sun, 1=Mon, 6=Sat)
 * @returns مصفوفة بكل أيام الفترة، كل عنصر عبارة عن { dateISO, label }
 */
export function buildDailyTimeline(
  filter: DateFilterValue,
  weekStart: WeekStart = 0
): { dateISO: string; label: string }[] {
  const r = resolveDateRange(filter, weekStart);
  if (!r.from || !r.to) return [];

  const results: { dateISO: string; label: string }[] = [];

  // نشتغل بـ UTC timestamps خالصة لتفادي أي تأثير للـ timezone
  const fromMs = Date.UTC(
    parseInt(r.from.slice(0, 4)),
    parseInt(r.from.slice(5, 7)) - 1,
    parseInt(r.from.slice(8, 10))
  );
  const toMs = Date.UTC(
    parseInt(r.to.slice(0, 4)),
    parseInt(r.to.slice(5, 7)) - 1,
    parseInt(r.to.slice(8, 10))
  );

  let cursor = fromMs;
  let guard = 0;
  while (cursor <= toMs && guard < 400) {
    const d = new Date(cursor);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const dateISO = `${y}-${m}-${day}`;
    const label = `${parseInt(day)}/${parseInt(m)}`;
    results.push({ dateISO, label });
    cursor += 86400000; // +24 ساعة بالضبط، بدون أي تأثير DST أو timezone
    guard++;
  }

  return results;
}
