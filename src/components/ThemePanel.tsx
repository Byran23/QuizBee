import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette as PaletteIcon, X, ImagePlus, Trash2, Check, Sun, Droplets, RotateCcw,
} from "lucide-react";
import { cn } from "../utils/cn";
import { PALETTES, ThemeState, DEFAULT_THEME, fileToDataUrl, resolvePalette } from "../lib/theme";

const ease = [0.22, 1, 0.36, 1] as const;

interface Props {
  theme: ThemeState;
  onChange: (patch: Partial<ThemeState>) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hide the floating launcher when a host screen provides its own trigger. */
  showLauncher?: boolean;
}

function Slider({
  label, icon, value, min, max, unit, onChange,
}: {
  label: string; icon: React.ReactNode; value: number; min: number; max: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-fog">
        <span className="flex items-center gap-1.5">{icon}{label}</span>
        <span className="text-paper">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--color-lime)]"
      />
    </div>
  );
}

export default function ThemePanel({ theme, onChange, open, onOpenChange, showLauncher = true }: Props) {
  const setOpen = onOpenChange;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const current = resolvePalette(theme);

  /* Escape closes the window */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const pickFile = async (file?: File) => {
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const url = await fileToDataUrl(file);
      onChange({ bgImage: url });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* floating launcher (hidden when a screen supplies its own trigger) */}
      {showLauncher && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.65, duration: 0.4 }}
          onClick={() => setOpen(!open)}
          title="Theme & background"
          className="glass fixed bottom-6 right-20 z-[80] grid h-12 w-12 place-items-center rounded-full text-fog transition-all hover:scale-105 hover:border-lime/50 hover:text-paper active:scale-95"
        >
          <PaletteIcon className="h-5 w-5" />
        </motion.button>
      )}

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[85] bg-ink/40 backdrop-blur-[2px]"
            />
            <div className="pointer-events-none fixed inset-0 z-[90] grid place-items-center p-4">
              <motion.aside
                initial={{ opacity: 0, y: 28, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 28, scale: 0.96 }}
                transition={{ duration: 0.35, ease }}
                className="glass-strong pointer-events-auto w-[min(23rem,calc(100vw-2rem))] max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-3xl p-5"
              >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.25em] text-paper">
                  <PaletteIcon className="h-4 w-4 text-lime" />
                  THEME
                </span>
                <button
                  onClick={() => setOpen(false)}
                  className="grid h-7 w-7 place-items-center rounded-full text-fog transition hover:bg-white/5 hover:text-paper"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* palettes */}
              <p className="mt-5 font-mono text-[10px] tracking-[0.25em] text-fog">PALETTE</p>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {PALETTES.map((p) => {
                  const active = !theme.custom && theme.paletteKey === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => onChange({ paletteKey: p.key, custom: null })}
                      className={cn(
                        "glass flex items-center gap-2 rounded-xl px-2.5 py-2 transition hover:border-white/25",
                        active && "!border-[var(--color-lime)]"
                      )}
                    >
                      <span className="flex -space-x-1">
                        {[p.accent, p.secondary, p.warn].map((c) => (
                          <span key={c} className="h-3.5 w-3.5 rounded-full ring-1 ring-black/40" style={{ background: c }} />
                        ))}
                      </span>
                      <span className="flex-1 text-left font-mono text-[10px] tracking-wider text-paper">{p.name}</span>
                      {active && <Check className="h-3.5 w-3.5 text-lime" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>

              {/* custom colors */}
              <p className="mt-5 font-mono text-[10px] tracking-[0.25em] text-fog">CUSTOM COLORS</p>
              <div className="mt-2.5 flex gap-2">
                {([
                  ["accent", "Primary"],
                  ["secondary", "Second"],
                ] as const).map(([k, label]) => (
                  <label key={k} className="glass flex flex-1 items-center gap-2 rounded-xl px-2.5 py-2">
                    <input
                      type="color"
                      value={theme.custom?.[k] ?? current[k]}
                      onChange={(e) =>
                        onChange({
                          custom: {
                            accent: theme.custom?.accent ?? current.accent,
                            secondary: theme.custom?.secondary ?? current.secondary,
                            [k]: e.target.value,
                          } as { accent: string; secondary: string },
                        })
                      }
                      className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <span className="font-mono text-[10px] tracking-wider text-fog">{label}</span>
                  </label>
                ))}
              </div>
              {theme.custom && (
                <button
                  onClick={() => onChange({ custom: null })}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-1.5 font-mono text-[9px] tracking-[0.2em] text-fog transition hover:border-rose/40 hover:text-rose"
                >
                  <RotateCcw className="h-3 w-3" /> RESET TO PALETTE
                </button>
              )}

              {/* background */}
              <p className="mt-5 font-mono text-[10px] tracking-[0.25em] text-fog">BACKGROUND IMAGE</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              {theme.bgImage ? (
                <div className="mt-2.5">
                  <div
                    className="h-24 w-full rounded-xl border border-line bg-cover bg-center"
                    style={{ backgroundImage: `url(${theme.bgImage})` }}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="glass flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-mono text-[10px] tracking-wider text-fog transition hover:text-paper"
                    >
                      <ImagePlus className="h-3.5 w-3.5" /> REPLACE
                    </button>
                    <button
                      onClick={() => onChange({ bgImage: null })}
                      className="glass grid w-10 place-items-center rounded-lg text-fog transition hover:border-rose/50 hover:text-rose"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="mt-2.5 flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-line py-6 text-fog transition hover:border-lime/40 hover:text-paper disabled:opacity-50"
                >
                  <ImagePlus className="h-5 w-5" />
                  <span className="font-mono text-[10px] tracking-[0.2em]">{busy ? "PROCESSING…" : "UPLOAD PHOTO"}</span>
                </button>
              )}
              {err && <p className="mt-2 font-mono text-[10px] text-rose">{err}</p>}

              {/* bg controls */}
              {theme.bgImage && (
                <div className="mt-4 space-y-3.5">
                  <Slider
                    label="DIM" icon={<Sun className="h-3 w-3" />} unit="%"
                    value={theme.bgDim} min={0} max={90}
                    onChange={(v) => onChange({ bgDim: v })}
                  />
                  <Slider
                    label="BLUR" icon={<Droplets className="h-3 w-3" />} unit="px"
                    value={theme.bgBlur} min={0} max={20}
                    onChange={(v) => onChange({ bgBlur: v })}
                  />
                </div>
              )}

              <button
                onClick={() => onChange({ ...DEFAULT_THEME })}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-2.5 font-mono text-[10px] tracking-[0.2em] text-fog transition hover:border-rose/40 hover:text-paper"
              >
                <RotateCcw className="h-3.5 w-3.5" /> RESET ALL
              </button>
              </motion.aside>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
