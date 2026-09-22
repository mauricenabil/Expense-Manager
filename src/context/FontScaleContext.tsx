import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/* ===================================================================
   FontScaleContext
   -------------------------------------------------------------------
   أربعة مقاييس منفصلة بالإضافة إلى تفضيل Bold للبطاقات:
     appScale — حجم واجهة التطبيق كلها (الإنجليزي، القوائم، العناوين)
     arScale  — حجم نصوص المستخدم وحدها (أسماء المصروفات، غالباً عربية)
     numScale — حجم الأرقام والمبالغ وحدها (فوق مقياس الواجهة، لا بدلاً منه)
     dashboardScale — حجم القيم داخل بطاقات الـ Dashboard فقط
     dashboardBold — جعل قيم بطاقات الـ Dashboard واسم الفئة الأبرز Bold

   لماذا numScale منفصل: الأرقام هي المعلومة اللي المستخدم بيقرأها من بعيد
   (المبلغ، الإجمالي، رقم اليوم في التقويم)، وهي مكتوبة بخط جدولي ضيّق
   فتبان أصغر من النص المحيط بها بنفس المقاس. تكبير الواجهة كلها عشان
   الأرقام بيضخّم العناوين والقوائم بلا داعٍ.

   لماذا منفصلان: الخط العربي بنفس الـ point size يبدو أصغر وأكثف من
   اللاتيني، فمن يكتب أسماء مصروفاته بالعربي يحتاج تكبيرها وحدها بدون
   تكبير الجداول والشبكة كلها.

   التخزين في localStorage لا في قاعدة البيانات: هذه تفضيلات عرض تخصّ
   الجهاز، ونريدها مطبَّقة قبل أول استعلام SQLite (لمنع وميض تغيّر الحجم).

   ملاحظة مهمة عن آلية التطبيق:
   المتغيّران يُستهلكان فقط داخل calc() في خصائص font-size — في ملفات CSS
   وفي كل نمط سطري في المكوّنات. لا يوجد zoom ولا transform ولا تغيير في
   أي مقاس آخر، فالحشو والأيقونات وعرض الأعمدة وإحداثيات العناصر العائمة
   تبقى ثابتة تماماً مهما تغيّر المقياس. هذا تكبير خط، لا تكبير صفحة.
   =================================================================== */

const APP_KEY = "expense-manager-app-font-scale";
const AR_KEY = "expense-manager-ar-font-scale";
const NUM_KEY = "expense-manager-num-font-scale";
const DASHBOARD_KEY = "expense-manager-dashboard-font-scale";
const DASHBOARD_BOLD_KEY = "expense-manager-dashboard-bold";

export const APP_SCALE_MIN = 0.85;
export const APP_SCALE_MAX = 1.5;
export const AR_SCALE_MIN = 1;
export const AR_SCALE_MAX = 1.6;
/* الأرقام تبدأ من 1 (حجمها الطبيعي) وتصل لضعف ونصف. القيم أعلى من كده
   بتكسر عرض أعمدة الجداول لأن الرقم بيبقى أعرض من رأس العمود. */
export const NUM_SCALE_MIN = 1;
export const NUM_SCALE_MAX = 1.5;
export const DASHBOARD_SCALE_MIN = 1;
export const DASHBOARD_SCALE_MAX = 1.5;

interface FontScaleValue {
  appScale: number;
  arScale: number;
  numScale: number;
  dashboardScale: number;
  dashboardBold: boolean;
  setAppScale: (v: number) => void;
  setArScale: (v: number) => void;
  setNumScale: (v: number) => void;
  setDashboardScale: (v: number) => void;
  setDashboardBold: (v: boolean) => void;
  reset: () => void;
}

const FontScaleContext = createContext<FontScaleValue | null>(null);

function read(key: string, fallback: number, min: number, max: number): number {
  const raw = localStorage.getItem(key);
  const n = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, min, max);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [appScale, setAppScaleState] = useState(() =>
    read(APP_KEY, 1, APP_SCALE_MIN, APP_SCALE_MAX)
  );
  const [arScale, setArScaleState] = useState(() =>
    read(AR_KEY, 1.1, AR_SCALE_MIN, AR_SCALE_MAX)
  );
  const [numScale, setNumScaleState] = useState(() =>
    read(NUM_KEY, 1, NUM_SCALE_MIN, NUM_SCALE_MAX)
  );
  const [dashboardScale, setDashboardScaleState] = useState(() =>
    read(DASHBOARD_KEY, 1, DASHBOARD_SCALE_MIN, DASHBOARD_SCALE_MAX)
  );
  const [dashboardBold, setDashboardBoldState] = useState(() => {
    const raw = localStorage.getItem(DASHBOARD_BOLD_KEY);
    return raw === null ? false : raw === "true";
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--app-font-scale", String(appScale));
    localStorage.setItem(APP_KEY, String(appScale));
  }, [appScale]);

  useEffect(() => {
    document.documentElement.style.setProperty("--ar-font-scale", String(arScale));
    localStorage.setItem(AR_KEY, String(arScale));
  }, [arScale]);

  useEffect(() => {
    document.documentElement.style.setProperty("--num-font-scale", String(numScale));
    localStorage.setItem(NUM_KEY, String(numScale));
  }, [numScale]);

  useEffect(() => {
    document.documentElement.style.setProperty("--dashboard-font-scale", String(dashboardScale));
    localStorage.setItem(DASHBOARD_KEY, String(dashboardScale));
  }, [dashboardScale]);

  useEffect(() => {
    document.documentElement.style.setProperty("--dashboard-font-weight", dashboardBold ? "700" : "400");
    localStorage.setItem(DASHBOARD_BOLD_KEY, String(dashboardBold));
  }, [dashboardBold]);

  const value: FontScaleValue = {
    appScale,
    arScale,
    numScale,
    dashboardScale,
    dashboardBold,
    setAppScale: (v) => setAppScaleState(clamp(v, APP_SCALE_MIN, APP_SCALE_MAX)),
    setArScale: (v) => setArScaleState(clamp(v, AR_SCALE_MIN, AR_SCALE_MAX)),
    setNumScale: (v) => setNumScaleState(clamp(v, NUM_SCALE_MIN, NUM_SCALE_MAX)),
    setDashboardScale: (v) => setDashboardScaleState(clamp(v, DASHBOARD_SCALE_MIN, DASHBOARD_SCALE_MAX)),
    setDashboardBold: setDashboardBoldState,
    reset: () => {
      setAppScaleState(1);
      setArScaleState(1.1);
      setNumScaleState(1);
      setDashboardScaleState(1);
      setDashboardBoldState(false);
    },
  };

  return <FontScaleContext.Provider value={value}>{children}</FontScaleContext.Provider>;
}

export function useFontScale() {
  const ctx = useContext(FontScaleContext);
  if (!ctx) throw new Error("useFontScale يجب استخدامه داخل FontScaleProvider");
  return ctx;
}
