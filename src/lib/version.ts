/**
 * مصدر واحد لرقم الإصدار داخل الواجهة.
 *
 * لازم يفضل مطابقاً لـ `version` في `src-tauri/tauri.conf.json` — هو الرقم
 * اللي بيتحطّ في Setup.exe وفي اسم الـ tag اللي بينشئه الـ workflow
 * (`app-v__VERSION__`). لو الرقمان اختلفا، شاشة التحديث هتقارن رقماً
 * غير اللي المستخدم مركّبه فعلاً وتكذب عليه.
 */
export const APP_VERSION = "1.1.0";

/** أجزاء الإصدار الثلاثة، أو null لو النص مش رقم إصدار أصلاً */
function parts(v: string): [number, number, number] | null {
  // نشيل أي بادئة زي "app-v" أو "v" وأي لاحقة زي "-beta.1"
  const cleaned = v.trim().replace(/^app-/i, "").replace(/^v/i, "").split(/[-+]/)[0];
  const seg = cleaned.split(".");
  if (seg.length === 0 || seg.length > 3) return null;

  const nums = [0, 1, 2].map((i) => {
    const raw = seg[i];
    if (raw === undefined) return 0; // "2.11" = "2.11.0"
    return /^\d+$/.test(raw) ? Number(raw) : NaN;
  });

  if (nums.some((n) => Number.isNaN(n))) return null;
  return nums as [number, number, number];
}

/**
 * مقارنة إصدارين: موجب لو a أحدث، سالب لو b أحدث، صفر لو متساويان.
 * بترجّع null لو أي طرف مش رقم إصدار صالح — والواجهة وقتها بتقول
 * "تعذّرت المقارنة" بدل ما تخمّن وتطلب من المستخدم تحديثاً وهمياً.
 */
export function compareVersions(a: string, b: string): number | null {
  const pa = parts(a);
  const pb = parts(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1;
  }
  return 0;
}

/**
 * يستخرج رقم الإصدار من اسم ملف المثبّت.
 *
 * Tauri بيسمّي المخرجات بالشكل `Expense Manager_1.1.0_x64-setup.exe`،
 * فالاسم وحده بيكفي لتحذير المستخدم لو اختار ملفاً أقدم من المُركَّب.
 * ترجع null لو الاسم ما فيهوش رقم واضح — وقتها الواجهة بتقول "غير معروف"
 * بدل ما تخمّن وتحذّر بالغلط.
 */
export function versionFromFileName(fileName: string): string | null {
  const m = fileName.match(/(\d+\.\d+(?:\.\d+)?)/);
  return m ? m[1] : null;
}
