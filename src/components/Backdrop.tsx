import { useEffect, useRef } from "react";

interface BackdropProps {
  accent?: string;
  bgImage?: string | null;
  bgDim?: number;
  bgBlur?: number;
  mode?: "dark" | "light";
}

/** Fixed ambient backdrop: optional photo + colored orbs + pointer glow, all behind glass. */
export default function Backdrop({
  accent = "#B8FF3C",
  bgImage = null,
  bgDim = 55,
  bgBlur = 4,
  mode = "dark",
}: BackdropProps) {
  const light = mode === "light";
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
      {/* uploaded photo */}
      {bgImage && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${bgImage})`,
              filter: `blur(${bgBlur}px)`,
              transform: "scale(1.06)", // hide blur edges
            }}
          />
          <div
            className="absolute inset-0"
            style={{ background: light ? "#eef0f4" : "#07070a", opacity: bgDim / 100 }}
            aria-hidden
          />
        </>
      )}
      {/* accent orb */}
      <div
        className="animate-float-slow absolute -top-52 -right-52 h-[42rem] w-[42rem] rounded-full blur-[130px]"
        style={{ background: accent, opacity: light ? 0.3 : 0.22 }}
      />
      {/* secondary orb */}
      <div
        className="animate-float-slow absolute -bottom-60 -left-52 h-[40rem] w-[40rem] rounded-full blur-[140px]"
        style={{ background: light ? "#7FB6FF" : "#8B7CFF", opacity: light ? 0.24 : 0.16, animationDelay: "-6s" }}
      />
      {/* pointer-follow glow */}
      <div
        ref={glowRef}
        className="pointer-events-none absolute left-0 top-0 h-[600px] w-[600px] rounded-full blur-[110px] transition-transform duration-300 ease-out will-change-transform"
        style={{ background: accent, opacity: light ? 0.14 : 0.08 }}
      />
      {/* soft vignette — tinted to the current mode */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, color-mix(in srgb, var(--color-ink) 72%, transparent) 100%)",
        }}
      />
    </div>
  );
}
