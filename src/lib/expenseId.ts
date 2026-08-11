/**
 * يولّد Expense ID احترافي بصيغة EXP-YYMMDD-XXXXXX.
 * يُستخدم في حالتين:
 * 1. العرض فقط: نشتق الجزء العشوائي من الـ UUID الداخلي الموجود أصلاً (لا تغيير في الـ id الحقيقي).
 * 2. عند الاستيراد (JSON/Excel/CSV) لسجل بدون id: نولّد ID حقيقي جديد بنفس الصيغة ليُستخدم كـ id فعلي.
 */
export function deriveExpenseIdFromUuid(uuid: string, date: string): string {
  const datePart = date.replace(/-/g, "").slice(2); // YYMMDD
  const hashPart = uuid.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `EXP-${datePart}-${hashPart}`;
}

/** يولّد Expense ID جديد بالكامل (id حقيقي صالح للتخزين) لسجل مستورد بدون id.
 *  يستخدم crypto.randomUUID() لو متاح لضمان عدم تكرار حتى مع الاستيراد الكبير (100+ صف) */
export function generateExpenseId(date: string): string {
  const datePart = (date || new Date().toISOString().slice(0, 10)).replace(/-/g, "").slice(2);
  let randomPart: string;
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    // crypto.randomUUID() متاح في كل المتصفحات الحديثة وTauri WebView
    randomPart = crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 6);
  } else {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    randomPart = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }
  return `EXP-${datePart}-${randomPart}`;
}

/** هل النص مطابق فعلاً لصيغة Expense ID المعتمدة؟ (للتحقق من IDs قادمة من استيراد قديم) */
export function isValidExpenseId(id: string | undefined | null): boolean {
  if (!id) return false;
  return /^EXP-\d{6}-[A-Z0-9]{6}$/.test(id.trim());
}
