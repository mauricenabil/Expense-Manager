import { useState, type CSSProperties } from "react";
import { Plus, Tag as TagIcon } from "lucide-react";
import { useDataStore } from "../store/DataStore";

/**
 * اختيار وسوم لمصروف واحد.
 *
 * الوسوم تُخزَّن في جدول الربط expense_tags، فالقيمة هنا قائمة معرّفات فقط.
 * يمكن إنشاء وسم جديد من نفس المكان بدل الذهاب إلى Settings ثم العودة.
 */
export default function TagPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const { tags, createTag } = useDataStore();
  const [newTag, setNewTag] = useState("");
  const [creating, setCreating] = useState(false);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((t) => t !== id) : [...value, id]);
  };

  const handleCreate = async () => {
    const name = newTag.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const id = await createTag(name);
      setNewTag("");
      // الوسم الجديد يُختار فوراً: من أنشأه الآن يريده على هذا المصروف غالباً.
      if (id && !value.includes(id)) onChange([...value, id]);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {tags.length === 0 && (
          <span className="text-muted" style={{ fontSize: "calc(12.5px * var(--app-font-scale, 1))" }}>
            No tags yet — create one below.
          </span>
        )}
        {tags.map((t) => {
          const active = value.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              style={{
                ...chipStyle,
                background: active ? "var(--accent)" : "var(--surface-hover)",
                color: active ? "var(--on-accent)" : "var(--text-muted)",
                borderColor: active ? "var(--accent)" : "var(--border)",
              }}
            >
              <TagIcon size={12} /> <span dir="auto" className="bidi-auto">{t.name}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
        <input dir="auto"
          style={smallInputStyle}
          placeholder="New tag..."
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
        />
        <button type="button" onClick={handleCreate} disabled={creating} style={addBtnStyle}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

const chipStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "5px 11px", borderRadius: 99, border: "1px solid var(--border)",
  fontSize: "calc(12.5px * var(--app-font-scale, 1))", fontWeight: 600, cursor: "pointer", lineHeight: 1.4,
};

const smallInputStyle: CSSProperties = {
  flex: 1, padding: "8px 11px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface-hover)", color: "var(--text)", fontSize: "calc(13px * var(--app-font-scale, 1))",
  outline: "none", boxSizing: "border-box",
};

const addBtnStyle: CSSProperties = {
  padding: "0 13px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface-hover)", color: "var(--text)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};
