import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// الخطوط مبنية داخل الحزمة، لا تُحمَّل من الإنترنت — شرط أساسي لتطبيق أوفلاين 100%.
// ملفات woff2 تُنسخ إلى dist/ وتُحزَم داخل الـ exe عند بناء Tauri.
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";

import "./styles/theme.css";
import "./styles/enhancements-2026.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
