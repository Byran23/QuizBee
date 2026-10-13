import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageOff, Maximize2, X, Loader2 } from "lucide-react";
import { cn } from "../utils/cn";

const ease = [0.22, 1, 0.36, 1] as const;

interface Props {
  src: string;
  alt?: string;
  /** max height class for the stage, e.g. "max-h-[38vh]" */
  className?: string;
  compact?: boolean;
}

/** Glass-framed question image with loading shimmer, error fallback + fullscreen lightbox. */
export default function QuestionImage({ src, alt = "Question image", className, compact = false }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  const close = useCallback(() => setZoom(false), []);
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, close]);

  if (failed) {
    return (
      <div
        className={cn(
          "glass mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-2 rounded-2xl px-6 py-8 text-fog",
          className
        )}
      >
        <ImageOff className="h-7 w-7 opacity-60" />
        <p className="font-mono text-[11px] tracking-[0.25em]">IMAGE COULDN&apos;T LOAD</p>
        <p className="max-w-md truncate font-mono text-[10px] text-fog/60">{src}</p>
      </div>
    );
  }

  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.1, ease }}
        onClick={() => setZoom(true)}
        title="Click to enlarge"
        className={cn(
          "glass group relative mx-auto block w-full max-w-3xl cursor-zoom-in overflow-hidden rounded-2xl p-1.5 transition hover:border-white/25",
          className
        )}
      >
        {!loaded && (
          <div className={cn("flex w-full items-center justify-center bg-white/[0.03]", compact ? "h-40" : "h-56 md:h-72")}>
            <Loader2 className="h-6 w-6 animate-spin text-fog" />
          </div>
        )}
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "w-full rounded-xl object-contain transition-opacity duration-500",
            compact ? "max-h-52 md:max-h-60" : "max-h-[34vh] md:max-h-[40vh]",
            loaded ? "opacity-100" : "absolute inset-0 h-0 opacity-0"
          )}
          draggable={false}
        />
        {loaded && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-ink/70 px-2.5 py-1 font-mono text-[9px] tracking-[0.2em] text-fog opacity-0 backdrop-blur transition group-hover:opacity-100">
            <Maximize2 className="h-3 w-3" /> ENLARGE
          </span>
        )}
      </motion.button>

      {/* lightbox */}
      <AnimatePresence>
        {zoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={close}
            className="glass-strong fixed inset-0 z-[95] flex cursor-zoom-out items-center justify-center p-4 md:p-10"
          >
            <motion.img
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ duration: 0.35, ease }}
              src={src}
              alt={alt}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full cursor-default rounded-2xl border border-white/15 object-contain shadow-2xl"
              draggable={false}
            />
            <button
              onClick={close}
              className="glass absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full text-fog transition hover:text-paper"
              title="Close (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
