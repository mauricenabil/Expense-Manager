import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}

/**
 * يعرض رقماً مع حركة سلسة:
 * - أول ظهور: count-up قصير من صفر للقيمة الفعلية.
 * - أي تغيير لاحق (بعد Refresh مثلاً): انتقال سلس للقيمة الجديدة بدون إعادة العدّ من الصفر،
 *   لتفادي إزعاج المستخدم بعدّ طويل متكرر في كل تحديث.
 */
export default function AnimatedNumber({ value, suffix = "", prefix = "", decimals = 0 }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const hasMounted = useRef(false);
  const rafRef = useRef<number | null>(null);
  const displayRef = useRef(0);

  useEffect(() => {
    const from = hasMounted.current ? displayRef.current : 0;
    const to = value;
    const duration = hasMounted.current ? 400 : 650;
    const start = performance.now();

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (to - from) * eased;
      displayRef.current = next;
      setDisplay(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        displayRef.current = to;
        setDisplay(to);
        hasMounted.current = true;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const formatted = display.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
  // .num = أرقام جدولية + مقياس الأرقام المستقل (--num-font-scale)
  return <span className="num">{prefix}{formatted}{suffix}</span>;
}
