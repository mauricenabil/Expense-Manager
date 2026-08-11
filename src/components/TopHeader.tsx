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

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await reloadAll();
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
  height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "0 24px", borderBottom: "1px solid var(--border)", background: "var(--surface)",
  position: "sticky", top: 0, zIndex: "var(--z-header)" as unknown as number,
};

const iconBtnStyle: CSSProperties = {
  width: 36, height: 36, borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--surface-hover)", color: "var(--text)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const searchTriggerStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10,
  border: "1px solid var(--border)", background: "var(--surface-hover)", color: "var(--text-muted)",
  fontSize: 13, cursor: "pointer", width: 280,
};

const kbdStyle: CSSProperties = {
  marginLeft: "auto", fontSize: 10, padding: "2px 6px", borderRadius: 4,
  border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)",
};
