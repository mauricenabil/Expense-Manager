import { useMemo, type CSSProperties, type ReactNode } from "react";
import { Bell, AlertTriangle, DatabaseBackup, Repeat } from "lucide-react";
import { useDropdown } from "../lib/useDropdown";
import DropdownPortal from "./DropdownPortal";
import { useDataStore } from "../store/DataStore";

interface Notification {
  id: string;
  icon: ReactNode;
  text: string;
  level: "warning" | "danger" | "info";
}

export default function NotificationsCenter() {
  const { open, toggle, triggerRef, menuRef } = useDropdown<HTMLButtonElement>();
  const { budgets, budgetsEnabled, expenses, recurringExpenses, activityLog } = useDataStore();

  const notifications: Notification[] = useMemo(() => {
    const items: Notification[] = [];

    if (budgetsEnabled) {
      const thisMonth = new Date().toISOString().slice(0, 7);
      budgets.forEach((b) => {
        const spent = expenses
          .filter((e) => e.date.slice(0, 7) === thisMonth && (b.category_id ? e.category_id === b.category_id : true))
          .reduce((s, e) => s + e.amount, 0);
        const percent = b.amount > 0 ? (spent / b.amount) * 100 : 0;
        if (percent >= 100) items.push({ id: `budget-over-${b.id}`, icon: <AlertTriangle size={14} color="var(--danger)" />, text: `${b.category_name || "General budget"} exceeded its limit (${Math.round(percent)}%)`, level: "danger" });
        else if (percent >= 80) items.push({ id: `budget-warn-${b.id}`, icon: <AlertTriangle size={14} color="var(--warning)" />, text: `${b.category_name || "General budget"} reached ${Math.round(percent)}% of its budget`, level: "warning" });
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    recurringExpenses.forEach((r) => {
      if (r.is_active && r.next_due_date <= today) {
        items.push({ id: `recurring-${r.id}`, icon: <Repeat size={14} color="var(--accent)" />, text: `${r.name} (${r.amount} EGP) is due — confirm it in Settings`, level: "info" });
      }
    });

    const lastBackup = activityLog.find((l) => l.action_type === "backup_created" || l.action_type === "backup_restored");
    const daysSinceBackup = lastBackup ? (Date.now() - new Date(lastBackup.created_at).getTime()) / 86400000 : Infinity;
    if (daysSinceBackup > 14) {
      items.push({ id: "backup-reminder", icon: <DatabaseBackup size={14} color="var(--warning)" />, text: "It's been a while — consider exporting a backup from Settings", level: "warning" });
    }

    return items;
  }, [budgets, budgetsEnabled, expenses, recurringExpenses, activityLog]);

  return (
    <>
      <button ref={triggerRef} onClick={toggle} style={bellBtnStyle} title="Notifications">
        <Bell size={16} />
        {notifications.length > 0 && <span className="success-pop" style={badgeStyle}>{notifications.length}</span>}
      </button>

      <DropdownPortal anchorRef={triggerRef} menuRef={menuRef} open={open} width={300}>
        <div className="card" style={panelStyle}>
          <strong style={{ fontSize: "calc(13px * var(--app-font-scale, 1))", display: "block", marginBottom: 8 }}>Notifications</strong>
          {notifications.length === 0 && <p className="text-muted" style={{ fontSize: "calc(12px * var(--app-font-scale, 1))" }}>You're all caught up.</p>}
          {notifications.map((n) => (
            <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
              {n.icon}
              <span style={{ fontSize: "calc(12px * var(--app-font-scale, 1))" }}>{n.text}</span>
            </div>
          ))}
        </div>
      </DropdownPortal>
    </>
  );
}

const bellBtnStyle: CSSProperties = {
  width: 36, height: 36, borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--surface-hover)", color: "var(--text)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
};

const badgeStyle: CSSProperties = {
  position: "absolute", top: -4, right: -4, background: "var(--danger)", color: "var(--on-danger)",
  borderRadius: "50%", width: 16, height: 16, fontSize: "calc(10px * var(--app-font-scale, 1))", display: "flex",
  alignItems: "center", justifyContent: "center", fontWeight: 700,
};

const panelStyle: CSSProperties = { maxHeight: 360, overflowY: "auto" };
