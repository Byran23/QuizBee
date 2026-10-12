import { useEffect, useRef } from "react";

/** Fixed ambient backdrop: two large colored orbs + pointer glow, all behind glass. */
export default function Backdrop({ accent = "#B8FF3C" }: { accent?: string }) {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (glowRef.current) {
          glowRef.current.style.transform = `translate(${e.clientX - 300}px, ${e.clientY - 300}px)`;
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
      {/* accent orb */}
      <div
        className="animate-float-slow absolute -top-52 -right-52 h-[42rem] w-[42rem] rounded-full opacity-[0.22] blur-[130px]"
        style={{ background: accent }}
      />
      {/* violet orb */}
      <div
        className="animate-float-slow absolute -bottom-60 -left-52 h-[40rem] w-[40rem] rounded-full opacity-[0.16] blur-[140px]"
        style={{ background: "#8B7CFF", animationDelay: "-6s" }}
      />
      {/* pointer-follow glow */}
      <div
        ref={glowRef}
        className="pointer-events-none absolute left-0 top-0 h-[600px] w-[600px] rounded-full opacity-[0.08] blur-[110px] transition-transform duration-300 ease-out will-change-transform"
        style={{ background: accent }}
      />
      {/* soft vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(7,7,10,0.55)_100%)]" />
    </div>
  );
}
