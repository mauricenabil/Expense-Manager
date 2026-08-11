import { useEffect, useState } from "react";

export default function CircularProgress({ score }: { score: number }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setAnimatedScore(score), 80);
    return () => clearTimeout(timeout);
  }, [score]);

  const size = 160, stroke = 14, radius = (size - stroke) / 2, circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;

  const status = score >= 90 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Fair" : "Poor";
  const gradientId = "health-gradient";
  const colorStops =
    score >= 90 ? ["#4ADE80", "#22C55E"] :
    score >= 70 ? ["#4DA3FF", "#2D7DF6"] :
    score >= 50 ? ["#FBBF24", "#F59E0B"] :
    ["#F87171", "#EF4444"];

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
        <text x="50%" y="46%" textAnchor="middle" fontSize="34" fontWeight="800" fill="var(--text)">{Math.round(animatedScore)}</text>
        <text x="50%" y="64%" textAnchor="middle" fontSize="11" fill="var(--text-muted)">out of 100</text>
      </svg>
      <div style={{ marginTop: 6, fontWeight: 700, fontSize: 14, color: colorStops[1] }}>{status}</div>
    </div>
  );
}
