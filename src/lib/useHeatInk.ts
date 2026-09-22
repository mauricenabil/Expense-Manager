import { useEffect, useState } from "react";
import { inkFor, readCssVar, type Ink } from "./contrast";
import { useTheme } from "../context/ThemeContext";

/* ===================================================================
   useHeatInk
   -------------------------------------------------------------------
   بيرجّع لون نص مقروء فوق كل درجة من درجات --heat-*.

   بيتحسب وقت التشغيل لأن قيم المتغيّرات نفسها بتتغيّر مع الثيم، وبعضها
   rgba شفّاف — يعني لونه النهائي بيعتمد على لون البطاقة اللي تحته.
   بيتعاد الحساب عند كل تبديل ثيم فقط، مش في كل رسم.
   =================================================================== */
export function useHeatInk(vars: Record<string, string>): Record<string, Ink> {
  const { theme } = useTheme();
  const keys = Object.keys(vars).join("|");
  const [ink, setInk] = useState<Record<string, Ink>>({});

  useEffect(() => {
    // rAF: نضمن إن سمة data-theme الجديدة اتطبّقت فعلاً على :root قبل
    // ما نقرأ المتغيّرات، وإلا هنقرأ ألوان الثيم القديم.
    const id = requestAnimationFrame(() => {
      const behind = readCssVar("--surface");
      const next: Record<string, Ink> = {};
      for (const [level, varName] of Object.entries(vars)) {
        next[level] = inkFor(readCssVar(varName), behind);
      }
      setInk(next);
    });
    return () => cancelAnimationFrame(id);
    // vars كائن حرفي بيتبنى في كل رسم، فبنعتمد على مفاتيحه بدل مرجعه
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, keys]);

  return ink;
}

export const FALLBACK_INK: Ink = { fg: "var(--text)", fgMuted: "var(--text-muted)" };
