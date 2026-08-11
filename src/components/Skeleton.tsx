import { type CSSProperties } from "react";

export default function Skeleton({ height = 16, width = "100%", radius = 6 }: { height?: number; width?: number | string; radius?: number }) {
  return <div style={{ ...style, height, width, borderRadius: radius }} />;
}

const style: CSSProperties = {
  background: "linear-gradient(90deg, var(--surface-hover) 25%, var(--border) 37%, var(--surface-hover) 63%)",
  backgroundSize: "400% 100%",
  animation: "skeleton-pulse 1.4s ease infinite",
};

// نضيف الـ keyframes مرة واحدة فقط في الصفحة
if (typeof document !== "undefined" && !document.getElementById("skeleton-keyframes")) {
  const style = document.createElement("style");
  style.id = "skeleton-keyframes";
  style.textContent = `@keyframes skeleton-pulse { 0% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`;
  document.head.appendChild(style);
}
