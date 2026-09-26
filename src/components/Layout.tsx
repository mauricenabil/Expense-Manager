import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar, { EXPANDED_WIDTH, COLLAPSED_WIDTH } from "./Sidebar";
import TopHeader from "./TopHeader";
import CommandPalette from "./CommandPalette";
import { useSidebar } from "../context/SidebarContext";
import { isPreviewMode } from "../lib/api";
import { useDataStore } from "../store/DataStore";

export default function Layout() {
  const { collapsed } = useSidebar();
  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();
  const { loading } = useDataStore();

  useEffect(() => {
    const onOpenEvent = () => setPaletteOpen(true);
    window.addEventListener("open-command-palette", onOpenEvent);

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("open-command-palette", onOpenEvent);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <span className="text-muted">Loading your data...</span>
      </div>
    );
  }

  return (
    // الشل نفسه بيملأ الشاشة ومش بيتمرّر: كل التمرير بيحصل جوّه <main> وحده.
    // قبل كده كان الـ body هو اللي بيتمرّر بينما <main> واخد overflowY: auto
    // بدون ارتفاع محدّد، فكان بيبقى "حاوية تمرير" ما بتتمرّرش أبداً — وده
    // اللي كان بيكسر أي position: sticky جوّه الصفحات (زي nav الإعدادات).
    <div style={{ height: "100vh", overflow: "hidden" }}>
      <Sidebar />

      {/* marginLeft يساوي عرض الـ Sidebar الثابت دائماً => لا توجد مساحة فاضية ولا تداخل */}
      <div
        style={{
          marginLeft: sidebarWidth,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          transition: "margin-left 0.22s ease",
        }}
      >
        <TopHeader />

        <main style={{ flex: 1, minHeight: 0, padding: "30px 32px 48px", overflowY: "auto", maxWidth: 1600, width: "100%" }}>
          {isPreviewMode && (
            <div
              className="card"
              style={{
                marginBottom: 16,
                padding: "10px 16px",
                background: "var(--warning-soft)",
                border: "1px solid var(--warning)",
                borderRadius: "var(--radius-sm)",
                fontSize: "calc(12.5px * var(--app-font-scale, 1))",
                lineHeight: 1.6,
                color: "var(--warning)",
              }}
            >
              ⚠ Browser Preview Mode — data is stored temporarily in this browser only
              (localStorage). The real desktop app uses an actual SQLite database. This banner
              never appears in the installed Setup.exe / Portable.exe version.
            </div>
          )}
          <div key={location.pathname} className="fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
