/**
 * منطق جدولة النسخ الاحتياطي التلقائي (دوال نقية بدون أي اعتماد على React أو Tauri).
 *
 * كل التواريخ هنا بالتوقيت المحلي للمستخدم بصيغة YYYY-MM-DD.
 * ملاحظة مهمة: لا نستخدم toISOString() لأنه يحوّل للتوقيت العالمي UTC، وده ممكن يرجّع
 * اليوم السابق لو الوقت المحلي بين 00:00 و 03:00 صباحاً (مثلاً في مصر) — وبالتالي
 * يخرّب فكرة "نفّذ في يوم 15 من الشهر".
 */

export type BackupSchedule = "weekly" | "monthly" | "quarterly" | "biannual" | "yearly";

/** اليوم الافتراضي من الشهر لتنفيذ النسخ الاحتياطي التلقائي */
export const DEFAULT_BACKUP_DAY = 1;

/** عدد الأشهر بين كل نسخة والتي تليها (الأسبوعي لا يعتمد على يوم من الشهر) */
const STEP_MONTHS: Record<Exclude<BackupSchedule, "weekly">, number> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  yearly: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD بالتوقيت المحلي */
export function toLocalISODate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** يضمن أن اليوم رقم صحيح بين 1 و 31 (أي قيمة غير صالحة ترجع للافتراضي) */
export function normalizeBackupDay(day: unknown): number {
  const n = Math.floor(Number(day));
  if (!Number.isFinite(n)) return DEFAULT_BACKUP_DAY;
  return Math.min(31, Math.max(1, n));
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * الـ Date لليوم المطلوب داخل شهر معيّن.
 * - month قد يتجاوز 11 (مثلاً 12 = يناير السنة التالية) وسيتم تطبيعه تلقائياً.
 * - لو الشهر أقصر من اليوم المطلوب (مثلاً 31 في فبراير) نستخدم آخر يوم في الشهر.
 */
function dateInMonth(year: number, month: number, day: number): Date {
  const first = new Date(year, month, 1);
  const y = first.getFullYear();
  const m = first.getMonth();
  return new Date(y, m, Math.min(day, daysInMonth(y, m)));
}

/** أقرب تاريخ قادم (بعد اليوم الحالي تماماً) يوافق اليوم المختار من الشهر */
export function nextOccurrenceOfDay(dayOfMonth: number, from: Date = new Date()): string {
  const day = normalizeBackupDay(dayOfMonth);
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const inThisMonth = dateInMonth(from.getFullYear(), from.getMonth(), day);
  if (inThisMonth > today) return toLocalISODate(inThisMonth);
  return toLocalISODate(dateInMonth(from.getFullYear(), from.getMonth() + 1, day));
}

/**
 * يحسب تاريخ النسخة التلقائية القادمة.
 *
 * @param afterBackup
 *   false (الافتراضي): عند تفعيل الجدولة أو تغيير التكرار/اليوم → أقرب يوم مختار قادم.
 *   true: بعد تنفيذ نسخة فعلاً → نقفز بعدد أشهر التكرار (شهر/3/6/12) ونثبّت اليوم المختار.
 *
 * التكرار الأسبوعي يتجاهل اليوم المختار ويضيف 7 أيام دائماً.
 */
export function calcNextBackupDate(
  schedule: BackupSchedule,
  dayOfMonth: number,
  from: Date = new Date(),
  afterBackup = false
): string {
  if (schedule === "weekly") {
    return toLocalISODate(new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7));
  }
  if (!afterBackup) return nextOccurrenceOfDay(dayOfMonth, from);

  const target = dateInMonth(from.getFullYear(), from.getMonth() + STEP_MONTHS[schedule], normalizeBackupDay(dayOfMonth));
  return toLocalISODate(target);
}
