import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

interface Props {
  text: string;
  /** smallest allowed font size in px */
  min?: number;
  /** largest allowed font size in px */
  max?: number;
  /** className for the measuring box (controls the available area) */
  className?: string;
  /** className for the text itself */
  textClassName?: string;
  style?: React.CSSProperties;
  lineHeight?: number;
}

/**
 * Scales text to the largest size that still fits its container,
 * both horizontally and vertically. Re-fits on resize / text change.
 */
export default function AutoFitText({
  text,
  min = 14,
  max = 180,
  className,
  textClassName,
  style,
  lineHeight = 1.08,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  const fit = useCallback(() => {
    const box = boxRef.current;
    const el = textRef.current;
    if (!box || !el) return;

    const availW = box.clientWidth;
    const availH = box.clientHeight;
    if (availW < 2 || availH < 2) return;

    let lo = min;
    let hi = max;
    let best = min;

    // binary search the biggest size that fits both axes
    for (let i = 0; i < 20 && hi - lo > 0.5; i++) {
      const mid = (lo + hi) / 2;
      el.style.fontSize = `${mid}px`;
      const fits = el.scrollHeight <= availH + 1 && el.scrollWidth <= availW + 1;
      if (fits) {
        best = mid;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    el.style.fontSize = `${best}px`;
  }, [min, max]);

  useLayoutEffect(() => {
    fit();
  }, [fit, text, lineHeight]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(box);
    // re-fit once webfonts finish loading (metrics change)
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready?.then(() => fit()).catch(() => {});
    return () => ro.disconnect();
  }, [fit]);

  return (
    <div ref={boxRef} className={className} style={style}>
      <span
        ref={textRef}
        className={textClassName}
        style={{
          display: "block",
          width: "100%",
          lineHeight,
          overflowWrap: "break-word",
        }}
      >
        {text}
      </span>
    </div>
  );
}
