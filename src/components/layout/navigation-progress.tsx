"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * شريط تقدّم رفيع أعلى الشاشة عند الانتقال بين الصفحات: استجابة فورية للنقر
 * دون حدود Suspense (لا يؤثر على router.refresh بعد الإجراءات).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // بدء الشريط عند النقر على رابط داخلي ينقل إلى صفحة أخرى
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/letters/")) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      clear();
      setVisible(true);
      setWidth(12);
      timers.current.push(setTimeout(() => setWidth(45), 150), setTimeout(() => setWidth(70), 600), setTimeout(() => setWidth(85), 1500));
      // أمان: لا يبقى الشريط ظاهراً إن لم يكتمل الانتقال
      timers.current.push(setTimeout(() => setVisible(false), 12_000));
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // اكتمال الانتقال
  useEffect(() => {
    if (!visible) return;
    clear();
    setWidth(100);
    timers.current.push(setTimeout(() => setVisible(false), 250), setTimeout(() => setWidth(0), 500));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => clear, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 print:hidden">
      <div
        className="h-full bg-qu-teal-500 shadow-[0_0_8px] shadow-qu-teal-400 transition-[width,opacity] duration-300 ease-out"
        style={{ width: `${width}%`, opacity: visible ? 1 : 0 }}
      />
    </div>
  );
}
