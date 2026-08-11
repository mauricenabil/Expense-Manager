import { useEffect, type RefObject } from "react";

/**
 * يغلق أي عنصر عائم (dropdown / popup / context menu) عند:
 * - الضغط في أي مكان خارج كل الـ refs الممرّرة
 * - الضغط على مفتاح Esc
 *
 * يقبل أكثر من ref لأن القوائم المنسدلة دلوقتي تُرسم عبر Portal في document.body
 * (لتفادي القصّ بسبب overflow في الحاويات الأب)، يعني الزر والقائمة بيبقوا في
 * فرعين مختلفين من شجرة الـ DOM، فلازم نتحقق من الاثنين معاً.
 */
export function useClickOutside(
  refs: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
  onClose: () => void,
  active: boolean
) {
  useEffect(() => {
    if (!active) return;
    const refList = Array.isArray(refs) ? refs : [refs];

    const handlePointer = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInside = refList.some((r) => r.current && r.current.contains(target));
      if (!isInside) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [active, onClose, refs]);
}
