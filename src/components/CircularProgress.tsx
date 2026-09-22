import { useEffect, useState } from "react";

export default function CircularProgress({ score }: { score: number }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setAnimatedScore(score), 80);
    return () => clearTimeout(timeout);
  }, [score]);

  const size = 172, stroke = 12, radius = (size - stroke) / 2, circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;

  const status = score >= 90 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Fair" : "Poor";
  const gradientId = "health-gradient";
  // ألوان مربوطة بالثيم — تتبدّل تلقائياً بين الفاتح والداكن
  const colorStops =
    score >= 90 ? ["var(--c1)", "var(--success)"] :
    score >= 70 ? ["var(--c7)", "var(--c1)"] :
    score >= 50 ? ["var(--c3)", "var(--warning)"] :
    ["var(--c2)", "var(--danger)"];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorStops[0]} />
            <stop offset="100%" stopColor={colorStops[1]} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-hover)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={`url(#${gradientId})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
        <text x="50%" y="47%" textAnchor="middle" fontSize="44" fontWeight="400" fill="var(--text)"
          fontFamily="var(--font-display)" letterSpacing="-1">{Math.round(animatedScore)}</text>
        <text x="50%" y="64%" textAnchor="middle" fontSize="9.5" fill="var(--text-faint)"
          letterSpacing="1.6" fontWeight="600">OUT OF 100</text>
      </svg>
      <div style={{
        marginTop: 8, fontWeight: 700, fontSize: "calc(11px * var(--app-font-scale, 1))", letterSpacing: ".1em", textTransform: "uppercase",
        color: colorStops[1], background: "var(--surface-hover)", padding: "5px 14px", borderRadius: 99,
      }}>{status}</div>
    </div>
  );
}
