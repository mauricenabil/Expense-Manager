import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, LayoutDashboard, PlusCircle, Receipt, Calendar, BarChart3, Settings,
  BookOpen, Sun, Download, Lock,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { useDataStore } from "../store/DataStore";

interface CommandItem {
  id: string;
  label: string;
  group: "Navigation" | "Commands" | "Expenses" | "Categories";
  icon: ReactNode;
  action: () => void;
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { toggleTheme } = useTheme();
  const { lockNow } = useAuth();
  const { expenses, categories } = useDataStore();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (open) { setQuery(""); setActiveIndex(0); }
  }, [open]);

  const go = (path: string) => { navigate(path); onClose(); };

  const staticCommands: CommandItem[] = useMemo(() => [
    { id: "nav-dashboard", label: "Go to Dashboard", group: "Navigation", icon: <LayoutDashboard size={15} />, action: () => go("/") },
    { id: "nav-add", label: "Go to Add Expense", group: "Navigation", icon: <PlusCircle size={15} />, action: () => go("/add") },
    { id: "nav-search", label: "Go to Search", group: "Navigation", icon: <Search size={15} />, action: () => go("/search") },
    { id: "nav-expenses", label: "Go to All Expenses", group: "Navigation", icon: <Receipt size={15} />, action: () => go("/expenses") },
    { id: "nav-calendar", label: "Go to Calendar", group: "Navigation", icon: <Calendar size={15} />, action: () => go("/calendar") },
    { id: "nav-analytics", label: "Go to Analytics", group: "Navigation", icon: <BarChart3 size={15} />, action: () => go("/analytics") },
    { id: "nav-settings", label: "Go to Settings", group: "Navigation", icon: <Settings size={15} />, action: () => go("/settings") },
    { id: "nav-guide", label: "Go to Guide", group: "Navigation", icon: <BookOpen size={15} />, action: () => go("/guide") },
    { id: "cmd-theme", label: "Switch Theme (Dark/Light)", group: "Commands", icon: <Sun size={15} />, action: () => { toggleTheme(); onClose(); } },
    { id: "cmd-lock", label: "Lock Application", group: "Commands", icon: <Lock size={15} />, action: () => { lockNow(); onClose(); } },
    {
      id: "cmd-backup", label: "Backup Data (Export JSON)", group: "Commands", icon: <Download size={15} />,
      action: async () => {
        const json = await api.exportBackupJson();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "expense-manager-backup.json"; a.click();
        URL.revokeObjectURL(url); onClose();
      },
    },
  ], []);

  const dynamicResults: CommandItem[] = useMemo(() => {
    if (query.trim().length < 2) return [];
    const kw = query.trim().toLowerCase();
    const expResults: CommandItem[] = expenses
      .filter((e) => e.name.toLowerCase().includes(kw))
      .slice(0, 5)
      .map((e) => ({
        id: `exp-${e.id}`, label: `${e.name} — ${e.amount} EGP (${e.date})`, group: "Expenses" as const,
        icon: <Receipt size={15} />, action: () => go("/expenses"),
      }));
    const catResults: CommandItem[] = categories
      .filter((c) => c.name.toLowerCase().includes(kw))
      .slice(0, 3)
      .map((c) => ({ id: `cat-${c.id}`, label: `Category: ${c.name}`, group: "Categories" as const, icon: <LayoutDashboard size={15} />, action: () => go("/settings") }));
    return [...expResults, ...catResults];
  }, [query, expenses, categories]);

  const filteredStatic = useMemo(() => {
    if (!query.trim()) return staticCommands;
    const kw = query.trim().toLowerCase();
    return staticCommands.filter((c) => c.label.toLowerCase().includes(kw));
  }, [query, staticCommands]);

  const allResults = [...filteredStatic, ...dynamicResults];

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, allResults.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
      if (e.key === "Enter") { e.preventDefault(); allResults[activeIndex]?.action(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, allResults, activeIndex, onClose]);

  if (!open) return null;

  let lastGroup = "";

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div className="card modal-in" style={paletteStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            placeholder="Search expenses, categories, or type a command..."
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--text)", fontSize: 15 }}
          />
          <kbd style={kbdStyle}>Esc</kbd>
        </div>

        <div style={{ maxHeight: 360, overflowY: "auto", padding: 8 }}>
          {allResults.length === 0 && <p className="text-muted" style={{ padding: 16, fontSize: 13 }}>No results.</p>}
          {allResults.map((cmd, i) => {
            const showGroupHeader = cmd.group !== lastGroup;
            lastGroup = cmd.group;
            return (
              <div key={cmd.id}>
                {showGroupHeader && (
                  <div className="text-muted" style={{ fontSize: 11, fontWeight: 700, padding: "8px 10px 4px", textTransform: "uppercase" }}>{cmd.group}</div>
                )}
                <button
                  onClick={cmd.action}
                  onMouseEnter={() => setActiveIndex(i)}
                  style={{ ...resultStyle, ...(i === activeIndex ? resultActiveStyle : {}) }}
                >
                  {cmd.icon} <span style={{ flex: 1, textAlign: "left" }}>{cmd.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh", zIndex: "var(--z-command-palette)" as unknown as number,
};

const paletteStyle: CSSProperties = { width: 560, maxWidth: "90vw", padding: 0, overflow: "hidden" };

const resultStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px",
  borderRadius: 8, border: "none", background: "transparent", color: "var(--text)",
  fontSize: 13, cursor: "pointer", textAlign: "left",
};

const resultActiveStyle: CSSProperties = { background: "var(--accent-soft)" };

const kbdStyle: CSSProperties = {
  fontSize: 11, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)",
  background: "var(--surface-hover)", color: "var(--text-muted)",
};
