import { useEffect, useRef, useState } from "react";
import { useClickOutside } from "./useClickOutside";

let dropdownCounter = 0;

/**
 * Hook موحّد لكل الـ Dropdowns/Popups في التطبيق (يعمل مع DropdownPortal).
 * - triggerRef: يُلصق بالزر اللي بيفتح القائمة، ويُستخدم لحساب موضعها على الشاشة.
 * - menuRef: يُلصق بمحتوى القائمة نفسها (المُرسومة عبر Portal في document.body).
 * - يغلق عند الضغط خارج الاثنين معاً أو عند الضغط على Esc.
 * - فتح أي Dropdown جديد يقفل تلقائياً أي Dropdown آخر مفتوح حالياً.
 */
export function useDropdown<TTrigger extends HTMLElement = HTMLButtonElement>() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<TTrigger>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<number>(++dropdownCounter);

  useClickOutside([triggerRef, menuRef], () => setOpen(false), open);

  // إغلاق هذا الـ Dropdown لو دروب داون آخر فتح
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail !== idRef.current) setOpen(false);
    };
    window.addEventListener("dropdown-opened", handler);
    return () => window.removeEventListener("dropdown-opened", handler);
  }, []);

  const toggle = () => {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) window.dispatchEvent(new CustomEvent("dropdown-opened", { detail: idRef.current }));
      return next;
    });
  };

  return { open, setOpen, toggle, triggerRef, menuRef };
}
