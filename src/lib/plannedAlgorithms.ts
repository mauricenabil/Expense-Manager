import type { ExpenseWithDetails, PlannedPurchase, PlannedPurchaseInput } from "../types";

/* ===================================================================
   خوارزميات التخطيط للشراء
   -------------------------------------------------------------------
   كل شيء هنا يعمل على البيانات الموجودة في الـ Store محلياً، بدون أي
   استدعاء شبكة — التطبيق أوفلاين 100%.
   =================================================================== */

export interface ValidationIssue {
  field: "name" | "amount" | "date" | "general";
  /** error يمنع الحفظ، warning يسمح به مع تنبيه */
  level: "error" | "warning";
  message: string;
}

/* -------------------------------------------------------------------
   1) التحقّق من المدخلات
   الرسائل تقول ما الخطأ وكيف يُصلَح، ولا تعتذر ولا تستخدم لغة النظام.
   ------------------------------------------------------------------- */
export function validatePlan(
  // estimated_amount مفصول عمداً: null تعني "المستخدم لم يحدّد سعراً"،
  // وهي الحالة التي نريد رسالة خطأ صريحة لها، لا مجرد قيمة مفقودة.
  input: Omit<Partial<PlannedPurchaseInput>, "estimated_amount"> & { estimated_amount?: number | null },
  existing: PlannedPurchase[] = [],
  editingId?: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const name = (input.name ?? "").trim();
  const amount = input.estimated_amount;

  if (!name) {
    issues.push({ field: "name", level: "error", message: "Enter what you plan to buy." });
  } else if (name.length > 120) {
    issues.push({ field: "name", level: "error", message: "Keep the name under 120 characters." });
  }

  // الحالة التي طلبها المستخدم صراحةً: السعر غير محدّد
  if (amount === null || amount === undefined || (typeof amount === "number" && Number.isNaN(amount))) {
    issues.push({ field: "amount", level: "error", message: "Set a price so this plan can be tracked." });
  } else if (!Number.isFinite(amount)) {
    issues.push({ field: "amount", level: "error", message: "Enter a valid number for the price." });
  } else if (amount <= 0) {
    issues.push({ field: "amount", level: "error", message: "The price must be greater than zero." });
  } else if (amount > 1_000_000_000) {
    issues.push({ field: "amount", level: "error", message: "That price is too large to record." });
  }

  if (input.target_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.target_date)) {
      issues.push({ field: "date", level: "error", message: "Use the date format YYYY-MM-DD." });
    } else if (input.target_date < todayISO()) {
      // ليس خطأ: قد يسجّل المستخدم خطة فاتها موعدها ثم يحوّلها فوراً
      issues.push({ field: "date", level: "warning", message: "That target date has already passed." });
    }
  }

  // تكرار محتمل — مقارنة غير حسّاسة لحالة الأحرف وللمسافات، تعمل مع العربي
  if (name) {
    const norm = normalize(name);
    const clash = existing.find(
      (p) => p.id !== editingId && p.status === "planned" && normalize(p.name) === norm
    );
    if (clash) {
      issues.push({
        field: "name",
        level: "warning",
        message: `You already have an active plan called "${clash.name}".`,
      });
    }
  }

  return issues;
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}

function normalize(s: string): string {
  return s
    .trim()
    .toLocaleLowerCase("ar")
    .replace(/[\u064B-\u065F\u0670]/g, "") // إزالة التشكيل
    .replace(/[أإآ]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------
   2) قياس أثر الشراء على الميزانية
   ------------------------------------------------------------------- */
export interface AffordabilityResult {
  /** متوسط الإنفاق اليومي خلال آخر 90 يوماً */
  dailyAverage: number;
  /** كم يوماً من إنفاقك المعتاد يساوي هذا الشراء */
  daysOfSpending: number;
  /** نسبة الشراء من إجمالي إنفاق الشهر الحالي */
  shareOfMonth: number;
  /** كم يوماً باقياً حتى التاريخ المستهدف (null لو لا يوجد تاريخ) */
  daysUntilTarget: number | null;
  /** المبلغ الذي يلزم تجنيبه يومياً للوصول للسعر في الموعد */
  savePerDay: number | null;
  level: "comfortable" | "noticeable" | "heavy";
  /** جملة واحدة تُعرض تحت الحقل مباشرة */
  message: string;
}

export function analyzeAffordability(
  amount: number,
  targetDate: string | null,
  expenses: ExpenseWithDetails[]
): AffordabilityResult {
  const today = todayISO();

  // نافذة 90 يوماً: طويلة كفاية لتجاوز شهر شاذ، قصيرة كفاية لتعكس
  // عاداتك الحالية لا عادات السنة الماضية.
  const windowStart = shiftDays(today, -90);
  const recent = expenses.filter((e) => e.date >= windowStart && e.date <= today);
  const recentTotal = recent.reduce((s, e) => s + e.amount, 0);
  const dailyAverage = recentTotal / 90;

  const monthPrefix = today.slice(0, 7);
  const monthTotal = expenses
    .filter((e) => e.date.startsWith(monthPrefix))
    .reduce((s, e) => s + e.amount, 0);

  const daysOfSpending = dailyAverage > 0 ? amount / dailyAverage : 0;
  const shareOfMonth = monthTotal > 0 ? amount / monthTotal : 0;

  let daysUntilTarget: number | null = null;
  let savePerDay: number | null = null;
  if (targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    daysUntilTarget = daysBetween(today, targetDate);
    savePerDay = daysUntilTarget > 0 ? amount / daysUntilTarget : amount;
  }

  // العتبات على "كم يوم إنفاق" لا على المبلغ المطلق، فالمقياس يتكيّف
  // مع دخل وعادات كل مستخدم بدل رقم ثابت لا يناسب الجميع.
  let level: AffordabilityResult["level"] = "comfortable";
  if (daysOfSpending >= 14 || shareOfMonth >= 0.4) level = "heavy";
  else if (daysOfSpending >= 5 || shareOfMonth >= 0.15) level = "noticeable";

  let message: string;
  if (dailyAverage <= 0) {
    message = "Not enough spending history yet to judge the impact.";
  } else if (level === "heavy") {
    message = `About ${fmtDays(daysOfSpending)} of your usual spending — a large purchase for you.`;
  } else if (level === "noticeable") {
    message = `About ${fmtDays(daysOfSpending)} of your usual spending.`;
  } else {
    message = `Roughly ${fmtDays(daysOfSpending)} of your usual spending — easy to absorb.`;
  }

  if (savePerDay !== null && daysUntilTarget !== null && daysUntilTarget > 0) {
    message += ` Set aside ${Math.ceil(savePerDay).toLocaleString("en-US")} a day to be ready in ${daysUntilTarget} days.`;
  }

  return { dailyAverage, daysOfSpending, shareOfMonth, daysUntilTarget, savePerDay, level, message };
}

function fmtDays(d: number): string {
  if (d < 1) return "less than a day";
  const r = Math.round(d);
  return r === 1 ? "1 day" : `${r} days`;
}

export function shiftDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function daysBetween(fromISO: string, toISO: string): number {
  const [y1, m1, d1] = fromISO.split("-").map(Number);
  const [y2, m2, d2] = toISO.split("-").map(Number);
  // UTC يتجنّب انزياح ساعة عند التوقيت الصيفي فيعطي عدد أيام صحيحاً دائماً
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86_400_000);
}

/* -------------------------------------------------------------------
   3) ترتيب الخطط: ما الذي يستحق الشراء أولاً
   ------------------------------------------------------------------- */
export function planScore(p: PlannedPurchase): number {
  // الأولوية التي اختارها المستخدم هي العامل الأقوى،
  // والإلحاح الزمني يعدّلها: خطة عادية موعدها بعد يومين تسبق
  // خطة مهمة بلا موعد.
  let score = p.priority * 100;
  if (p.target_date) {
    const days = daysBetween(todayISO(), p.target_date);
    if (days <= 0) score += 120;              // فات موعدها
    else if (days <= 7) score += 80;
    else if (days <= 30) score += 40;
    else score += 10;
  }
  return score;
}

/* -------------------------------------------------------------------
   4) ملخّص لوحة التخطيط
   ------------------------------------------------------------------- */
export interface PlanSummary {
  activeCount: number;
  activeTotal: number;
  dueSoonCount: number;
  overdueCount: number;
  purchasedCount: number;
  /** فرق التقدير: موجب يعني أنك تدفع أكثر مما تقدّر عادةً */
  estimateBias: number | null;
}

export function summarizePlans(
  plans: PlannedPurchase[],
  expenses: ExpenseWithDetails[]
): PlanSummary {
  const today = todayISO();
  const active = plans.filter((p) => p.status === "planned");
  const purchased = plans.filter((p) => p.status === "purchased");

  let dueSoonCount = 0;
  let overdueCount = 0;
  for (const p of active) {
    if (!p.target_date) continue;
    const days = daysBetween(today, p.target_date);
    if (days < 0) overdueCount++;
    else if (days <= 7) dueSoonCount++;
  }

  // نقارن السعر المتوقّع بالمبلغ المدفوع فعلاً في المصروف الناتج
  const byId = new Map(expenses.map((e) => [e.id, e]));
  const pairs = purchased
    .map((p) => {
      const e = p.converted_expense_id ? byId.get(p.converted_expense_id) : undefined;
      return e ? (e.amount - p.estimated_amount) / p.estimated_amount : null;
    })
    .filter((v): v is number => v !== null);

  return {
    activeCount: active.length,
    activeTotal: active.reduce((s, p) => s + p.estimated_amount, 0),
    dueSoonCount,
    overdueCount,
    purchasedCount: purchased.length,
    estimateBias: pairs.length >= 3 ? pairs.reduce((s, v) => s + v, 0) / pairs.length : null,
  };
}
