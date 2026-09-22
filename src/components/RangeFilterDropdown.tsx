import { type CSSProperties } from "react";
import { ChevronDown, Calendar } from "lucide-react";
import { useDropdown } from "../lib/useDropdown";
import DropdownPortal from "./DropdownPortal";
import { RANGE_OPTIONS, type DateFilterValue, type RangeKey } from "../lib/dateRanges";

export default function RangeFilterDropdown({
  value,
  onChange,
  compact = false,
  options,
}: {
  value: DateFilterValue;
  onChange: (v: DateFilterValue) => void;
  compact?: boolean;
  options?: { key: RangeKey; label: string }[];
}) {
  const { open, setOpen, toggle, triggerRef, menuRef } = useDropdown<HTMLButtonElement>();
  const activeOptions = options ?? RANGE_OPTIONS;
  const currentLabel = activeOptions.find((o) => o.key === value.range)?.label ?? RANGE_OPTIONS.find((o) => o.key === value.range)?.label ?? "Filter";

  return (
    <>
      <button ref={triggerRef} onClick={toggle} style={compact ? triggerCompactStyle : triggerStyle}>
        <Calendar size={13} />
        {currentLabel}
        <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      <DropdownPortal anchorRef={triggerRef} menuRef={menuRef} open={open} width={190}>
        <div style={menuStyle}>
          {activeOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                if (opt.key !== "custom") { onChange({ range: opt.key }); setOpen(false); }
                else onChange({ ...value, range: "custom" });
              }}
              style={{ ...menuItemStyle, ...(value.range === opt.key ? menuItemActiveStyle : {}) }}
            >
              {opt.label}
            </button>
          ))}

          {value.range === "custom" && (
            <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                type="date" style={dateInputStyle} value={value.customFrom || ""}
                onChange={(e) => onChange({ ...value, customFrom: e.target.value })}
              />
              <input
                type="date" style={dateInputStyle} value={value.customTo || ""}
                onChange={(e) => onChange({ ...value, customTo: e.target.value })}
              />
              <button onClick={() => setOpen(false)} style={applyBtnStyle}>Apply</button>
            </div>
          )}
        </div>
      </DropdownPortal>
    </>
  );
}

const triggerStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--surface-hover)", color: "var(--text)",
  fontSize: "calc(12px * var(--app-font-scale, 1))", cursor: "pointer", whiteSpace: "nowrap",
};

const triggerCompactStyle: CSSProperties = { ...triggerStyle, padding: "5px 8px", fontSize: "calc(11px * var(--app-font-scale, 1))" };

const menuStyle: CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
  boxShadow: "var(--shadow)", overflow: "hidden",
};

const menuItemStyle: CSSProperties = {
  display: "block", width: "100%", padding: "8px 12px", border: "none", background: "transparent",
  color: "var(--text-muted)", fontSize: "calc(12px * var(--app-font-scale, 1))", textAlign: "left", cursor: "pointer",
};

const menuItemActiveStyle: CSSProperties = { background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 600 };

const dateInputStyle: CSSProperties = {
  padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--surface-hover)", color: "var(--text)", fontSize: "calc(12px * var(--app-font-scale, 1))",
};

const applyBtnStyle: CSSProperties = {
  padding: "6px", borderRadius: 6, border: "none", background: "var(--accent)",
  color: "var(--on-accent)", fontSize: "calc(12px * var(--app-font-scale, 1))", fontWeight: 600, cursor: "pointer",
};
