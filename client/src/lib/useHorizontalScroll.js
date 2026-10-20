import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook to enable smooth horizontal scrolling for overflow containers on desktop & mobile:
 * - Converts vertical mouse wheel (deltaY) into horizontal scrolling (scrollLeft)
 * - Enables click-and-drag panning with mouse on desktop
 * - Tracks canScrollLeft and canScrollRight for navigation arrow buttons
 * - Automatically monitors resize/DOM changes via ResizeObserver
 */
export function useHorizontalScroll() {
  const elRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const hasScroll = el.scrollWidth > el.clientWidth + 2;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(hasScroll && el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    checkScroll();

    // 1. Wheel conversion: vertical mouse wheel (deltaY) scrolls horizontally
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth) return;

      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;

      const atStart = el.scrollLeft <= 0 && delta < 0;
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth && delta > 0;

      if (!atStart && !atEnd) {
        e.preventDefault();
        el.scrollLeft += delta * 0.95;
        checkScroll();
      }
    };

    // 2. Drag-to-scroll with mouse on desktop
    let isDown = false;
    let startX = 0;
    let startScrollLeft = 0;
    let hasDragged = false;

    const onMouseDown = (e) => {
      // Primary button only and not on inputs/interactive buttons
      if (e.button !== 0) return;
      isDown = true;
      hasDragged = false;
      startX = e.pageX - el.offsetLeft;
      startScrollLeft = el.scrollLeft;
      el.classList.add("is-dragging");
    };

    const onMouseMove = (e) => {
      if (!isDown) return;
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.35;
      if (Math.abs(walk) > 4) {
        hasDragged = true;
      }
      el.scrollLeft = startScrollLeft - walk;
      checkScroll();
    };

    const onMouseUp = () => {
      if (!isDown) return;
      isDown = false;
      el.classList.remove("is-dragging");

      if (hasDragged) {
        const preventClick = (clickEvent) => {
          clickEvent.stopPropagation();
          clickEvent.preventDefault();
          window.removeEventListener("click", preventClick, true);
        };
        window.addEventListener("click", preventClick, true);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);

    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        checkScroll();
      });
      ro.observe(el);
      if (el.firstElementChild) {
        ro.observe(el.firstElementChild);
      }
    }

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
      if (ro) ro.disconnect();
    };
  }, [checkScroll]);

  const scrollByAmount = (amount) => {
    if (!elRef.current) return;
    elRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  return { elRef, canScrollLeft, canScrollRight, scrollByAmount, checkScroll };
}
