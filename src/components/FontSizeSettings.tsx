import type { CSSProperties, ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import {
  useFontScale,
  APP_SCALE_MIN, APP_SCALE_MAX, AR_SCALE_MIN, AR_SCALE_MAX, NUM_SCALE_MIN, NUM_SCALE_MAX,
  DASHBOARD_SCALE_MIN, DASHBOARD_SCALE_MAX,
} from "../context/FontScaleContext";

/* ضعه داخل صفحة Settings في قسم Appearance بجوار مبدّل الثيم:
     import FontSizeSettings from "../components/FontSizeSettings";
     ...
     <FontSizeSettings />
*/

export default function FontSizeSettings() {
  const {
    appScale, arScale, numScale, dashboardScale, dashboardBold,
    setAppScale, setArScale, setNumScale, setDashboardScale, setDashboardBold, reset,
  } = useFontScale();

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>Text size</h3>
        <button onClick={reset} style={resetBtn} title="Restore all text settings to their defaults">
          <RotateCcw size={13} /> Reset
        </button>
      </div>
      <p className="text-muted" style={{ fontSize: "calc(12.5px * var(--app-font-scale, 1))", marginTop: 0, marginBottom: 20 }}>
        This changes text size only — not page zoom. Spacing, icons, column widths and
        the layout stay exactly where they are. The interface, your own expense names and
        the numbers scale independently, so you can enlarge amounts without stretching the
        tables around them.
      </p>

      <Row
        label="Interface"
        hint="Menus, headings, labels — everything the app writes."
        value={appScale}
        min={APP_SCALE_MIN}
        max={APP_SCALE_MAX}
        onChange={setAppScale}
        // المعاينة لا تضرب في appScale يدوياً: مقاس الخط هنا مكتوب أصلاً
        // calc(14px * var(--app-font-scale)) مثل بقية التطبيق، فيتغيّر حيّاً وحده.
        preview={<span style={{ fontSize: "calc(14px * var(--app-font-scale, 1))" }}>Groceries · 250 EGP</span>}
      />

      <div style={{ height: 1, background: "var(--border)", margin: "20px 0" }} />

      <Row
        label="Numbers & amounts"
        hint="Every figure on its own: amounts, totals, day numbers, percentages."
        value={numScale}
        min={NUM_SCALE_MIN}
        max={NUM_SCALE_MAX}
        onChange={setNumScale}
        // .num بتطبّق --num-font-scale بنفسها فوق مقاس الواجهة، فالمعاينة
        // بتتصرّف بالضبط زي أي مبلغ في التطبيق
        preview={
          <span style={{ fontSize: "calc(14px * var(--app-font-scale, 1))" }}>
            Total: <span className="num" style={{ fontWeight: 700 }}>1,250.00 EGP</span>
          </span>
        }
      />

      <div style={{ height: 1, background: "var(--border)", margin: "20px 0" }} />

      <Row
        label="Dashboard cards"
        hint="Numbers and the top category name on the Dashboard cards only."
        value={dashboardScale}
        min={DASHBOARD_SCALE_MIN}
        max={DASHBOARD_SCALE_MAX}
        onChange={setDashboardScale}
        preview={
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{
              fontFamily: "var(--font-display)",
              fontSize: "calc(38px * var(--dashboard-font-scale, 1))",
              lineHeight: 1.05,
              fontWeight: "var(--dashboard-font-weight, 400)",
              fontVariantNumeric: "tabular-nums",
            }}>1,250</span>
            <span dir="auto" style={{
              fontSize: "calc(34px * var(--dashboard-font-scale, 1))",
              fontWeight: "var(--dashboard-font-weight, 400)",
            }}>Groceries</span>
          </div>
        }
      />

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: "calc(13.5px * var(--app-font-scale, 1))" }}>Dashboard cards bold</div>
          <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))" }}>Make Dashboard card values and top category name bold.</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={dashboardBold}
          onClick={() => setDashboardBold(!dashboardBold)}
          style={{
            padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer",
            background: dashboardBold ? "var(--accent)" : "var(--surface-hover)",
            color: dashboardBold ? "var(--on-accent)" : "var(--text-muted)",
            fontWeight: 600, fontSize: "calc(12px * var(--app-font-scale, 1))",
          }}
        >
          {dashboardBold ? "Bold On" : "Bold Off"}
        </button>
      </div>

      <div style={{ height: 1, background: "var(--border)", margin: "20px 0" }} />

      <Row
        label="Your expense names"
        hint="Only the text you type yourself, in any language."
        value={arScale}
        min={AR_SCALE_MIN}
        max={AR_SCALE_MAX}
        onChange={setArScale}
        // .bidi-auto تطبّق --ar-font-scale بنفسها، فالمعاينة تعكس الإعداد حيّاً
        preview={<span dir="auto" className="bidi-auto" style={{ fontSize: "calc(14px * var(--app-font-scale, 1) * var(--ar-font-scale, 1))" }}>مشتريات البيت الأسبوعية</span>}
      />
    </div>
  );
}

function Row({
  label, hint, value, min, max, onChange, preview,
}: {
  label: string; hint: string; value: number; min: number; max: number;
  onChange: (v: number) => void; preview: ReactNode;
}) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: "calc(13.5px * var(--app-font-scale, 1))" }}>{label}</div>
          <div className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))" }}>{hint}</div>
        </div>
        <span style={pctPill}>{pct}%</span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        style={{ width: "100%", marginTop: 12, accentColor: "var(--accent)", cursor: "pointer" }}
      />

      <div style={previewBox}>{preview}</div>
    </div>
  );
}

const pctPill: CSSProperties = {
  background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 99,
  padding: "2px 10px", fontSize: "calc(11.5px * var(--app-font-scale, 1))", fontWeight: 700, fontVariantNumeric: "tabular-nums",
  flexShrink: 0,
};

const previewBox: CSSProperties = {
  marginTop: 12, padding: "12px 14px", borderRadius: "var(--radius-sm)",
  background: "var(--surface-sunken)", border: "1px solid var(--border)",
  minHeight: 46, display: "flex", alignItems: "center",
};

const resetBtn: CSSProperties = {
  display: "flex", alignItems: "center", gap: 5, background: "var(--surface-hover)",
  border: "1px solid var(--border)", borderRadius: 8, padding: "5px 11px",
  fontSize: "calc(12px * var(--app-font-scale, 1))", cursor: "pointer", color: "var(--text-muted)",
};
