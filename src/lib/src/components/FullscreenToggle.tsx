import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Maximize2, Minimize2 } from "lucide-react";

/** Floating fullscreen toggle — visible on every screen. Keyboard: F. */
export default function FullscreenToggle() {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* fullscreen may be blocked */ }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "f" || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      void toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.6, duration: 0.4 }}
      onClick={toggle}
      title={isFs ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
      className="fixed bottom-6 right-6 z-[80] grid h-12 w-12 place-items-center rounded-full border border-line bg-panel/90 text-fog shadow-lg backdrop-blur transition-all hover:scale-105 hover:border-lime/50 hover:text-paper hover:shadow-[0_0_24px_rgba(184,255,60,0.2)] active:scale-95"
    >
      {isFs ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
    </motion.button>
  );
}
