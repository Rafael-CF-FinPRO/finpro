"use client";

import { useEffect, useRef, useState } from "react";

/** Measures a wrapping element's real rendered width via
 * ResizeObserver, so an SVG chart's viewBox can match actual screen
 * pixels 1:1 instead of the browser's own aspect-ratio-preserving
 * auto-height (a `viewBox` + `className="w-full"` SVG scales its
 * height to keep the viewBox's own width:height ratio — harmless in a
 * half-width 2-column card, but it means every font size, bar and
 * gridline balloons together the moment that same chart becomes a
 * full-width block, since the ratio then gets stretched across nearly
 * 2x the pixels). Shared by every dashboard chart that needs to fill
 * its card's width exactly while keeping a fixed, compact height.
 * `fallbackWidth` only matters for the very first paint, before the
 * observer has measured anything. */
export function useChartWidth(fallbackWidth: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallbackWidth);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured) setWidth(measured);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { containerRef, width };
}
