import { useState, type CSSProperties } from "react";
import { Sun, Moon, Lock, Zap, Search, RefreshCw, Check } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useDataStore } from "../store/DataStore";
import NotificationsCenter from "./NotificationsCenter";
import QuickAddModal from "./QuickAddModal";

export default function TopHeader() {
  const { theme, toggleTheme } = useTheme();
  const { passwordEnabled, lockNow } = useAuth();
  const { reloadAll } = useDataStore();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);

  const MIN_SPIN_MS = 600; // أقل مدة يظهر فيها الأنيميشن، حتى لو البيانات المحلية اترجعت فوراً

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    const start = Date.now();
    try {
      await reloadAll();
      const elapsed = Date.now() - start;
      if (elapsed < MIN_SPIN_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS - elapsed));
      }
      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 1100); // ✓ يظهر لحظة قصيرة ثم يعود للحالة العادية
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <header style={headerStyle}>
      <button onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))} style={searchTriggerStyle}>
        <Search size={14} /> Search or run a command
        <kbd style={kbdStyle}>Ctrl K</kbd>
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => setQuickAddOpen(true)} style={iconBtnStyle} title="Quick Add Expense">
          <Zap size={16} />
        </button>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{ ...iconBtnStyle, color: justRefreshed ? "var(--success)" : "var(--text)", borderColor: justRefreshed ? "var(--success)" : "var(--border)" }}
          title={refreshing ? "Refreshing..." : justRefreshed ? "Updated" : "Refresh all data"}
        >
          {justRefreshed ? (
            <Check size={16} className="success-pop" />
          ) : (
            <RefreshCw size={16} className={refreshing ? "spin-icon" : undefined} />
          )}
        </button>

        <NotificationsCenter />

        <button onClick={toggleTheme} style={iconBtnStyle} title="Toggle theme">
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {passwordEnabled && (
          <button onClick={lockNow} style={iconBtnStyle} title="Lock application now">
            <Lock size={16} />
          </button>
        )}
      </div>

      <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onAdded={() => window.dispatchEvent(new CustomEvent("expense-added"))} />
    </header>
  );
}

const headerStyle: CSSProperties = {
  height: 62, display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "0 26px", borderBottom: "1px solid var(--border)",
  background: "color-mix(in srgb, var(--bg) 78%, transparent)",
  backdropFilter: "blur(14px) saturate(140%)",
  WebkitBackdropFilter: "blur(14px) saturate(140%)",
  position: "sticky", top: 0, zIndex: "var(--z-header)" as unknown as number,
};

const iconBtnStyle: CSSProperties = {
  width: 36, height: 36, borderRadius: 11, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text-muted)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  boxShadow: "var(--shadow-sm)",
};

const searchTriggerStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 9, padding: "9px 15px", borderRadius: 99,
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-faint)",
  fontSize: "calc(12.5px * var(--app-font-scale, 1))", cursor: "pointer", width: 320, boxShadow: "var(--shadow-sm)",
};

const kbdStyle: CSSProperties = {
  marginInlineStart: "auto", fontSize: "calc(9.5px * var(--app-font-scale, 1))", fontWeight: 700, letterSpacing: ".06em",
  padding: "3px 7px", borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--surface-hover)", color: "var(--text-faint)",
};
