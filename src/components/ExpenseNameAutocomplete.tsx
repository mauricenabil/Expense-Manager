import { useEffect, useMemo, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useDataStore } from "../store/DataStore";
import { useDropdown } from "../lib/useDropdown";
import DropdownPortal from "./DropdownPortal";

const MAX_SUGGESTIONS = 8;

interface Suggestion {
  name: string;
  count: number;
  lastDate: string;
}

interface ExpenseNameAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: CSSProperties;
  id?: string;
  /** تركيز فعلي عند أول ظهور فقط (يماثل سلوك input autoFocus العادي) — يناسب النوافذ التي تُفتح من جديد كل مرة (Quick Add). */
  autoFocus?: boolean;
  /**
   * إشارة تركيز قابلة لإعادة التفعيل: أي تغيّر في قيمتها (حتى لو رقمياً فقط) يعيد تركيز الحقل.
   * تُستخدم في الصفحات التي تبقى مُركَّبة طوال الوقت (مثل صفحة "إضافة مصروف") حيث
   * autoFocus وحده لا يكفي لأنه لا يعمل إلا عند أول تركيب للعنصر.
   */
  focusSignal?: number;
  /** يُستدعى عند الضغط على Enter ولا يوجد اقتراح محدَّد حالياً — يحافظ على أي سلوك "حفظ بالـ Enter" كان موجوداً قبل إضافة الإكمال التلقائي. */
  onSubmit?: () => void;
  /** تجاوز طبقة الـ z-index لقائمة الاقتراحات (استخدم Z.modalPopover عند الاستخدام داخل Modal). */
  menuZIndex?: number;
}

/**
 * حقل اسم المصروف مع إكمال تلقائي (Autocomplete) مبني بالكامل على أسماء
 * المصروفات التي سبق للمستخدم تسجيلها — كل البيانات مصدرها الـ Store المحلي
 * (SQLite عبر Tauri) الذي يكون محمَّلاً بالفعل، فلا يوجد أي طلب شبكة ولا أي
 * تعديل على الـ Backend، والتطبيق يبقى يعمل Offline 100% كما هو تماماً.
 *
 * ترتيب الاقتراحات: تطابق بداية الاسم أولاً، ثم الأحدث استخداماً (حسب تاريخ
 * المصروف)، ثم الأكثر تكراراً — بنفس روح ترتيب "Recent Expenses" الموجود
 * بالفعل في صفحة الإضافة.
 *
 * تنقّل بالكيبورد: ↓/↑ للتنقل بين الاقتراحات، Enter لاختيار المُحدَّد،
 * Tab يقبل المُحدَّد قبل نقل التركيز، Esc يغلق القائمة فقط (لا يغلق أي
 * Modal أو يصفّر أي نموذج طالما القائمة مفتوحة).
 */
export default function ExpenseNameAutocomplete({
  value,
  onChange,
  placeholder,
  style,
  id,
  autoFocus,
  focusSignal,
  onSubmit,
  menuZIndex,
}: ExpenseNameAutocompleteProps) {
  const { expenses } = useDataStore();
  const { open, setOpen, toggle, triggerRef, menuRef } = useDropdown<HTMLInputElement>();
  const [activeIndex, setActiveIndex] = useState(-1);

  // إعادة التركيز عند تغيّر focusSignal (مثال: بعد حفظ مصروف وتصفير النموذج)
  // — لا تأثير على أي مكان لا يمرّر هذا الخيار أصلاً.
  useFocusSignal(triggerRef, focusSignal);

  // تجميع أسماء المصروفات السابقة: اسم فريد واحد (بدون فروق حالة الأحرف)
  // مع عدد مرات التكرار وآخر تاريخ استُخدم فيه.
  const uniqueNames = useMemo(() => {
    const map = new Map<string, Suggestion>();
    for (const exp of expenses) {
      const trimmed = exp.name.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (exp.date > existing.lastDate) {
          existing.lastDate = exp.date;
          existing.name = trimmed; // نحتفظ بأحدث حالة أحرف كُتب بها الاسم
        }
      } else {
        map.set(key, { name: trimmed, count: 1, lastDate: exp.date });
      }
    }
    return Array.from(map.values());
  }, [expenses]);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    let pool = uniqueNames;
    if (q) {
      pool = uniqueNames.filter((n) => n.name.toLowerCase().includes(q));
      // لو الاقتراح الوحيد مطابق تماماً لما هو مكتوب بالفعل، لا فائدة من عرضه
      if (pool.length === 1 && pool[0].name.toLowerCase() === q) return [];
    }
    return [...pool]
      .sort((a, b) => {
        const aStarts = q ? a.name.toLowerCase().startsWith(q) : true;
        const bStarts = q ? b.name.toLowerCase().startsWith(q) : true;
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        if (a.lastDate !== b.lastDate) return a.lastDate > b.lastDate ? -1 : 1;
        if (a.count !== b.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [uniqueNames, value]);

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
    setActiveIndex(-1);
  };

  return (
    <>
      <input
        ref={triggerRef}
        id={id}
        dir="auto"
        className="bidi-auto"
        autoFocus={autoFocus}
        style={style}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          setActiveIndex(-1);
          setOpen(true);
        }}
        onFocus={() => {
          if (!open && suggestions.length > 0) toggle();
        }}
        onKeyDown={(e) => {
          if (open && suggestions.length > 0) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, -1));
              return;
            }
            if (e.key === "Escape") {
              // نمنع الانتشار عمداً: أول Esc يقفل قائمة الاقتراحات فقط، بدون
              // أن يغلق أي Modal أو يصفّر النموذج المحيط بها.
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              setActiveIndex(-1);
              return;
            }
            if (e.key === "Tab" && activeIndex >= 0) {
              onChange(suggestions[activeIndex].name);
              setOpen(false);
              setActiveIndex(-1);
              return; // بدون preventDefault: خلي Tab ينقل التركيز بشكل طبيعي
            }
            if (e.key === "Enter" && activeIndex >= 0) {
              e.preventDefault();
              select(suggestions[activeIndex].name);
              return;
            }
          }
          if (e.key === "Enter") {
            setOpen(false);
            onSubmit?.();
          }
        }}
      />

      {suggestions.length > 0 && (
        <DropdownPortal anchorRef={triggerRef} menuRef={menuRef} open={open} zIndex={menuZIndex}>
          <div style={menuStyle}>
            {suggestions.map((s, i) => (
              <button
                key={s.name}
                type="button"
                // onMouseDown + preventDefault بدل onClick: يمنع فقدان تركيز
                // الحقل قبل تسجيل الاختيار (سباق blur/click الشائع في أي Combobox)
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(s.name);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                style={{ ...itemStyle, ...(i === activeIndex ? itemActiveStyle : {}) }}
              >
                <span dir="auto" className="bidi-auto">{highlight(s.name, value)}</span>
              </button>
            ))}
          </div>
        </DropdownPortal>
      )}
    </>
  );
}

/** يُبرز جزء النص المطابق لما كتبه المستخدم داخل الاقتراح */
function highlight(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong style={{ color: "var(--accent)", fontWeight: 700 }}>{text.slice(idx, idx + q.length)}</strong>
      {text.slice(idx + q.length)}
    </>
  );
}

// Hook صغير معزول: يعيد تركيز الحقل عند تغيّر focusSignal فقط (وليس عند كل render)
function useFocusSignal(ref: RefObject<HTMLInputElement | null>, focusSignal?: number) {
  useEffect(() => {
    if (focusSignal !== undefined) ref.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal]);
}

const menuStyle: CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
  boxShadow: "var(--shadow)", overflow: "hidden", maxHeight: 260, overflowY: "auto",
};

const itemStyle: CSSProperties = {
  display: "block", width: "100%", padding: "9px 12px", border: "none", background: "transparent",
  color: "var(--text)", fontSize: "calc(13.5px * var(--app-font-scale, 1))", textAlign: "left", cursor: "pointer",
};

const itemActiveStyle: CSSProperties = { background: "var(--accent-soft)", color: "var(--accent)" };
