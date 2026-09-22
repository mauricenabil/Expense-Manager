import { createPortal } from "react-dom";
import { useLayoutEffect, useState, type RefObject, type ReactNode, type CSSProperties } from "react";
import { Z } from "../lib/zLayers";

interface DropdownPortalProps {
  /** الزر/العنصر اللي القائمة بتتمركز بالنسبة له */
  anchorRef: RefObject<HTMLElement | null>;
  /** ref يُلصق بمحتوى القائمة نفسها (للاستخدام مع useClickOutside) */
  menuRef?: RefObject<HTMLDivElement | null>;
  open: boolean;
  children: ReactNode;
  /** محاذاة القائمة بالنسبة لحافة الزر: يمين أو يسار */
  align?: "left" | "right";
  /** عرض ثابت اختياري للقائمة (لو غير محدد، تاخد عرض الزر نفسه كحد أدنى) */
  width?: number;
  /** المسافة الرأسية بين الزر والقائمة */
  gap?: number;
}

/**
 * يرسم القائمة المنسدلة في document.body مباشرة (Portal) بدل ما تكون جوّه
 * أي كارت أو حاوية بها overflow. هذا يضمن ظهورها دائماً فوق كل عناصر الصفحة
 * بدون أي قصّ، بغض النظر عن مكانها داخل التطبيق.
 */
export default function DropdownPortal({ anchorRef, menuRef, open, children, align = "right", width, gap = 6 }: DropdownPortalProps) {
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) { setPos(null); return; }

    const update = () => {
      const rect = anchorRef.current!.getBoundingClientRect();

      // لا قسمة على أي معامل هنا. سابقاً كان الجذر مكبَّراً بـ zoom فتختلف
      // وحدات position:fixed عن بكسلات getBoundingClientRect، أما الآن فتكبير
      // الخط لا يمسّ التخطيط إطلاقاً، والإحداثيات تُستخدم كما هي.
      const top = rect.bottom + gap;
      const left = align === "right" ? rect.right - (width ?? rect.width) : rect.left;

      setPos({ top: Math.max(8, top), left: Math.max(8, left), minWidth: rect.width });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef, align, width, gap]);

  if (!open || !pos) return null;

  const style: CSSProperties = {
    position: "fixed",
    top: pos.top,
    left: pos.left,
    minWidth: width ?? pos.minWidth,
    zIndex: Z.dropdown,
  };

  return createPortal(
    <div ref={menuRef as RefObject<HTMLDivElement> | undefined} style={style} className="dropdown-menu-anim">
      {children}
    </div>,
    document.body
  );
}
