import { type CSSProperties } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, PlusCircle, Search, Receipt, Calendar, BarChart3,
  Settings, BookOpen, Wallet, ChevronLeft, ChevronRight, PiggyBank, Target, ShoppingCart,
} from "lucide-react";
import { useSidebar } from "../context/SidebarContext";
import { useDataStore } from "../store/DataStore";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/add", label: "Add Expense", icon: PlusCircle },
  { to: "/search", label: "Search", icon: Search },
  { to: "/expenses", label: "All Expenses", icon: Receipt },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/planned", label: "Planned", icon: ShoppingCart },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/guide", label: "Guide", icon: BookOpen },
];

export const EXPANDED_WIDTH = 220;
export const COLLAPSED_WIDTH = 72;

export default function Sidebar() {
  const { collapsed, toggleCollapsed } = useSidebar();
  const { budgets, budgetsEnabled, savingsGoals, expenses } = useDataStore();

  // فقط العناصر التي ثبّتها المستخدم يدوياً تظهر هنا — لا شيء افتراضياً
  const pinnedBudgets = budgetsEnabled ? budgets.filter((b) => b.pinned) : [];
  const pinnedGoals = savingsGoals.filter((g) => g.pinned);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const spentThisMonth = (categoryId: string | null) =>
    expenses
      .filter((e) => e.date.slice(0, 7) === thisMonth && (categoryId ? e.category_id === categoryId : true))
      .reduce((s, e) => s + e.amount, 0);

  const hasWidgets = pinnedBudgets.length > 0 || pinnedGoals.length > 0;

  return (
    <aside
      className="sidebar-glow"
      style={{
        width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        height: "100vh",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: "var(--z-sidebar)" as unknown as number,
        transition: "width 0.22s ease",
        overflow: "hidden",
      }}
    >
      {/* Logo + Collapse Toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 16px", justifyContent: collapsed ? "center" : "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
          <div style={logoBoxStyle}>
            <Wallet size={20} color="var(--accent)" />
          </div>
          {!collapsed && (
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, whiteSpace: "nowrap" }}>
              <span className="display" style={{ fontSize: "calc(17px * var(--app-font-scale, 1))" }}>Expense</span>
              <span className="eyebrow" style={{ fontSize: "calc(8.5px * var(--app-font-scale, 1))" }}>Manager 2026</span>
            </span>
          )}
        </div>
        {!collapsed && (
          <button onClick={toggleCollapsed} style={collapseBtnStyle} title="Collapse sidebar">
            <ChevronLeft size={15} />
          </button>
        )}
      </div>
      {collapsed && (
        <button onClick={toggleCollapsed} style={{ ...collapseBtnStyle, margin: "0 auto 8px" }} title="Expand sidebar">
          <ChevronRight size={15} />
        </button>
      )}

      {/* Navigation */}
      <nav style={{ flex: hasWidgets ? "0 1 auto" : 1, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className="nav-link"
            title={collapsed ? label : undefined}
            style={({ isActive }) => ({
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: collapsed ? "10px 0" : "10px 13px",
              justifyContent: collapsed ? "center" : "flex-start",
              borderRadius: 11,
              fontSize: "calc(13.5px * var(--app-font-scale, 1))",
              fontWeight: isActive ? 600 : 500,
              textDecoration: "none",
              color: isActive ? "var(--accent)" : "var(--text-muted)",
              background: isActive ? "var(--accent-soft)" : "transparent",
              boxShadow: isActive ? "inset 0 0 0 1px var(--accent-glow)" : "none",
              whiteSpace: "nowrap",
              transition: "background .15s ease, color .15s ease",
            })}
          >
            <Icon size={18} style={{ flexShrink: 0 }} />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>

      {/* Pinned Widgets Area — تظهر فقط لو فيه عناصر مثبّتة فعلياً من المستخدم */}
      {!collapsed && hasWidgets && (
        <div style={{ flex: "1 1 auto", overflowY: "auto", padding: "4px 14px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
          {pinnedBudgets.length > 0 && (
            <div>
              <div className="eyebrow" style={{ margin: "8px 2px" }}>Pinned Budgets</div>
              {pinnedBudgets.map((b) => {
                const spent = spentThisMonth(b.category_id ?? null);
                const percent = b.amount > 0 ? Math.min(100, (spent / b.amount) * 100) : 0;
                return (
                  <div key={b.id} className="card" style={{ padding: "14px 14px", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <PiggyBank size={15} color="var(--accent)" />
                      <span style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {b.category_name || "General Budget"}
                      </span>
                    </div>
                    <div style={{ height: 7, borderRadius: 99, background: "var(--surface-sunken)", overflow: "hidden" }}>
                      <div className="progress-bar-animated" style={{ height: "100%", borderRadius: 99, width: `${percent}%`, background: percent >= 100 ? "var(--danger)" : "var(--accent)" }} />
                    </div>
                    <div className="text-muted" style={{ fontSize: "calc(11px * var(--app-font-scale, 1))", marginTop: 6 }}>
                      <span className="num">{Math.round(spent)} / {b.amount} EGP</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {pinnedGoals.length > 0 && (
            <div>
              <div className="eyebrow" style={{ margin: "8px 2px" }}>Pinned Goals</div>
              {pinnedGoals.map((g) => {
                const percent = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
                return (
                  <div key={g.id} className="card" style={{ padding: "14px 14px", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <Target size={15} color="var(--success)" />
                      <span style={{ fontSize: "calc(12px * var(--app-font-scale, 1))", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 99, background: "var(--surface-sunken)", overflow: "hidden" }}>
                      <div className="progress-bar-animated" style={{ height: "100%", borderRadius: 99, width: `${percent}%`, background: "var(--success)" }} />
                    </div>
                    <div className="text-muted" style={{ fontSize: "calc(11px * var(--app-font-scale, 1))", marginTop: 6 }}>
                      <span className="num">{Math.round(percent)}%</span> saved
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

const logoBoxStyle: CSSProperties = {
  width: 38, height: 38, borderRadius: 12, background: "var(--accent-soft)",
  boxShadow: "inset 0 0 0 1px var(--accent-glow)",
  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};

const collapseBtnStyle: CSSProperties = {
  width: 26, height: 26, borderRadius: 9, border: "1px solid var(--border)",
  background: "var(--surface-hover)", color: "var(--text-muted)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};
