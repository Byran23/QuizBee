import { useEffect, useRef } from "react";

/** Fixed ambient backdrop: dotted grid, two drifting glows, vignette. */
export default function Backdrop({ accent = "#B8FF3C" }: { accent?: string }) {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (glowRef.current) {
          glowRef.current.style.transform = `translate(${e.clientX - 250}px, ${e.clientY - 250}px)`;
        }
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-ink" aria-hidden>
      <div className="dot-grid absolute inset-0" />
      {/* accent wash */}
      <div
        className="animate-float-slow absolute -top-40 -right-40 h-[34rem] w-[34rem] rounded-full opacity-[0.14] blur-[120px]"
        style={{ background: accent }}
      />
      <div
        className="animate-float-slow absolute -bottom-48 -left-40 h-[30rem] w-[30rem] rounded-full opacity-[0.10] blur-[110px]"
        style={{ background: "#8B7CFF", animationDelay: "-6s" }}
      />
      {/* pointer-follow glow */}
      <div
        ref={glowRef}
        className="pointer-events-none absolute left-0 top-0 h-[500px] w-[500px] rounded-full opacity-[0.06] blur-[100px] transition-transform duration-300 ease-out will-change-transform"
        style={{ background: accent }}
      />
      {/* sweep line */}
      <div className="scanline absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {/* vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(7,7,10,0.75)_100%)]" />
    </div>
  );
}
