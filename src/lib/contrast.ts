/* ===================================================================
   contrast.ts
   -------------------------------------------------------------------
   حساب لون نص مقروء فوق خلفية متغيّرة.

   المشكلة اللي بيحلّها: بطاقات أيام التقويم بتاخد لونها من تدرّج
   --heat-0..4، وبعض درجاته (الأخضر تحديداً) قريبة جداً من لون
   var(--accent) اللي كان الرقم مكتوب بيه، ومن var(--text-muted) اللي
   كان رقم اليوم مكتوب بيه — فالرقم بيختفي في خلفيته.

   الحل هنا مش "لون ثابت لكل درجة" (ده بيتكسر أول ما يتغيّر الثيم أو
   تتعدّل درجة في theme.css)، لكن حساب فعلي: بنقرأ اللون النهائي للخلفية
   وقت التشغيل، بنركّبه فوق لون البطاقة لو كان شفّافاً، وبنقيس نسبة
   التباين (WCAG) مع مرشّحين — حبر غامق وحبر فاتح — ونختار الأعلى.
   =================================================================== */

export interface RGB { r: number; g: number; b: number; a: number }

/** يفهم #rgb و #rrggbb و rgb() و rgba(). أي شكل تاني بيرجع null. */
export function parseColor(input: string): RGB | null {
  const s = input.trim();
  if (!s) return null;

  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const v = hex.split("").map((c) => parseInt(c + c, 16));
      if (v.some((n) => Number.isNaN(n))) return null;
      return { r: v[0], g: v[1], b: v[2], a: v.length === 4 ? v[3] / 255 : 1 };
    }
    if (hex.length === 6 || hex.length === 8) {
      const v = [0, 2, 4, 6].slice(0, hex.length / 2).map((i) => parseInt(hex.slice(i, i + 2), 16));
      if (v.some((n) => Number.isNaN(n))) return null;
      return { r: v[0], g: v[1], b: v[2], a: v.length === 4 ? v[3] / 255 : 1 };
    }
    return null;
  }

  const m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const num = (t: string) => (t.endsWith("%") ? (parseFloat(t) / 100) * 255 : parseFloat(t));
  const r = num(parts[0]), g = num(parts[1]), b = num(parts[2]);
  const a = parts[3] === undefined ? 1 : (parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]));
  if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
  return { r, g, b, a };
}

/** تركيب لون شفّاف فوق لون معتم (alpha compositing بسيط). */
export function composite(fg: RGB, bg: RGB): RGB {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

/** الإضاءة النسبية حسب WCAG 2.1 */
export function luminance(c: RGB): number {
  const ch = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

/** نسبة التباين بين لونين معتمين (من 1 إلى 21) */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** قراءة قيمة متغيّر CSS من :root كما هي بعد تطبيق الثيم الحالي */
export function readCssVar(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export interface Ink {
  /** اللون الأساسي للنص فوق هذه الخلفية */
  fg: string;
  /** نفس اللون بشفافية أقل — للنص الثانوي (مثل "3 items") */
  fgMuted: string;
}

const DARK_INK = { r: 14, g: 21, b: 30, a: 1 };   // #0E151E
const LIGHT_INK = { r: 253, g: 251, b: 247, a: 1 }; // #FDFBF7

/**
 * يختار حبراً مقروءاً فوق خلفية معيّنة.
 *
 * @param bgCss   لون الخلفية كما هو مكتوب في CSS (يقبل rgba شفّاف)
 * @param behindCss لون ما خلف الخلفية — يُستخدم للتركيب لو كانت شفّافة
 */
export function inkFor(bgCss: string, behindCss: string): Ink {
  const bgRaw = parseColor(bgCss);
  const behind = parseColor(behindCss) ?? { r: 255, g: 255, b: 255, a: 1 };
  // لو تعذّرت القراءة (متغيّر ناقص مثلاً) نرجع لألوان الثيم العادية بدل
  // ما نخمّن لوناً ممكن يطلع أسوأ من الحالي.
  if (!bgRaw) return { fg: "var(--text)", fgMuted: "var(--text-muted)" };

  const bg = bgRaw.a < 1 ? composite(bgRaw, behind) : bgRaw;
  const dark = contrastRatio(bg, DARK_INK);
  const light = contrastRatio(bg, LIGHT_INK);
  const pick = dark >= light ? DARK_INK : LIGHT_INK;
  const rgb = `${Math.round(pick.r)}, ${Math.round(pick.g)}, ${Math.round(pick.b)}`;

  return {
    fg: `rgb(${rgb})`,
    // 0.72 يكفي لتمييز النص الثانوي عن الأساسي وما زال فوق 4.5:1 في كل
    // درجات الحرارة المستخدمة حالياً.
    fgMuted: `rgba(${rgb}, 0.72)`,
  };
}
