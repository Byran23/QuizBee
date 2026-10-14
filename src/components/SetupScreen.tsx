import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2, Sparkles, AlertTriangle, Loader2, ClipboardPaste,
  ChevronDown, Copy, Check, TableProperties, Clock3, Layers3,
  ListTodo, ArrowRight, History, X, Palette as PaletteIcon,
} from "lucide-react";
import { cn } from "../utils/cn";
import { parseSheetInput, fetchQuizFromSheet, SheetFetchError } from "../lib/sheets";
import { demoQuiz } from "../lib/demo";
import { FetchResult } from "../lib/types";

interface Props {
  onReady: (result: FetchResult, url: string | null) => void;
  onCustomize: () => void;
  titleA: string;
  titleB: string;
  marquee: string[];
}

const RECENT_KEY = "quizbee.recents";
const SAMPLE_CSV = `Question,A,B,C,D,Answer,Round,Image,Explanation
Which planet is known as the Red Planet?,Venus,Mars,Jupiter,Mercury,B,Easy,,Iron oxide dust covers its surface.
What is 12 x 8?,88,96,104,112,96,Average,,12 x 8 = 96.
What landmark is in the image?,Eiffel Tower,Big Ben,Statue of Liberty,Sydney Opera House,A,Average,https://images.pexels.com/photos/29667766/pexels-photo-29667766.jpeg,Eiffel Tower in Paris.
What animal is in the image?,,,,,Philippine Tarsier,Difficult,https://images.pexels.com/photos/4086737/pexels-photo-4086737.jpeg,One of the world's smallest primates.`;

const ease = [0.22, 1, 0.36, 1] as const;

export default function SetupScreen({ onReady, onCustomize, titleA, titleB, marquee }: Props) {
  const [url, setUrl] = useState("");
  const [tab, setTab] = useState("");
  const [showTab, setShowTab] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [phase, setPhase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [recents, setRecents] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
  });

  const remember = (u: string) => {
    const next = [u, ...recents.filter((r) => r !== u)].slice(0, 4);
    setRecents(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  const load = async (target?: string) => {
    const value = (target ?? url).trim();
    setError(null);
    const ref = parseSheetInput(value);
    if (!ref) {
      setError("That doesn’t look like a Google Sheets link. Paste the full URL or just the sheet ID.");
      return;
    }
    setStatus("loading");
    setPhase("Contacting Google…");
    try {
      setPhase("Trying export engines (CSV → JSON)…");
      const result = await fetchQuizFromSheet(ref, tab || undefined);
      setPhase("Building your arena…");
      await new Promise((r) => setTimeout(r, 450));
      remember(value);
      onReady(result, value);
    } catch (e) {
      setStatus("idle");
      if (e instanceof SheetFetchError) setError(e.message);
      else setError("Something went wrong while fetching the sheet. Check your connection and try again.");
    }
  };

  const runDemo = () => {
    setStatus("loading");
    setPhase("Summoning the demo set…");
    setTimeout(() => onReady({ data: demoQuiz(), via: "demo" }, null), 600);
  };

  return (
    <div className="relative min-h-screen">
      {/* top line */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-8">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-lime text-ink">
            <Sparkles className="h-5 w-5" strokeWidth={2.4} />
          </div>
          <span className="font-mono text-xs font-semibold tracking-[0.3em] text-fog">
            Q-BEE ARENA
          </span>
        </div>
        <button
          onClick={onCustomize}
          className="glass group flex items-center gap-2 rounded-full px-4 py-2 font-mono text-[11px] tracking-wider text-fog transition hover:border-lime/50 hover:text-paper"
        >
          <PaletteIcon className="h-3.5 w-3.5 text-lime transition-transform group-hover:rotate-12" />
          CUSTOMIZE
        </button>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        {/* hero */}
        <section className="pt-16 text-center md:pt-24">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
            className="font-mono text-[11px] font-semibold tracking-[0.4em] text-lime"
          >
            GOOGLE SHEETS POWERED COMPETITION ENGINE
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.08, ease }}
            className="mx-auto mt-6 font-display text-[13vw] leading-[0.95] tracking-tight sm:text-7xl md:text-8xl"
            style={{ fontWeight: 800 }}
          >
            {titleA}
            {titleA && titleB && <span className="text-lime">·</span>}
            {titleB}
          </motion.h1>
        </section>

        {/* marquee */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 1 }}
          className="mt-12 overflow-hidden border-y border-line py-3"
        >
          <div className="animate-marquee flex w-max gap-8 whitespace-nowrap font-mono text-[11px] tracking-[0.35em] text-fog">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex gap-8">
                {marquee.map((t, j) => (
                  <span key={`${t}-${j}`} className="flex items-center gap-8">
                    {t} <span className="text-lime">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </motion.div>

        {/* connector panel */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease }}
          className="mx-auto mt-16 grid max-w-4xl gap-6 lg:grid-cols-[1.5fr_1fr]"
        >
          {/* left: input */}
          <div className="glass-strong rounded-3xl p-6 md:p-8">
            <div className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.25em] text-fog">
              <Link2 className="h-4 w-4 text-lime" />
              CONNECT YOUR SHEET
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <div className="group relative flex-1">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && status === "idle" && load()}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  spellCheck={false}
                  className="w-full rounded-xl border border-line bg-ink/80 px-4 py-4 pr-12 font-mono text-[13px] text-paper placeholder:text-fog/50 transition focus:border-lime/60 focus:shadow-[0_0_0_4px_rgba(184,255,60,0.08)]"
                />
                <button
                  onClick={async () => {
                    try { setUrl(await navigator.clipboard.readText()); } catch { /* noop */ }
                  }}
                  title="Paste from clipboard"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-fog transition hover:bg-white/5 hover:text-lime"
                >
                  <ClipboardPaste className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={() => load()}
                disabled={status === "loading"}
                className={cn(
                  "sheen group relative flex items-center justify-center gap-2 rounded-xl px-7 py-4 font-mono text-[13px] font-bold tracking-wider transition",
                  status === "loading"
                    ? "cursor-wait bg-panel-2 text-fog"
                    : "bg-lime text-ink hover:shadow-[0_0_30px_rgba(184,255,60,0.35)] active:scale-[0.98]"
                )}
              >
                {status === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                )}
                {status === "loading" ? "READING" : "LOAD SHEET"}
              </button>
            </div>

            {/* advanced tab input */}
            <button
              onClick={() => setShowTab((v) => !v)}
              className="mt-4 flex items-center gap-1.5 font-mono text-[11px] tracking-wider text-fog transition hover:text-paper"
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showTab && "rotate-180")} />
              TARGET A SPECIFIC TAB
            </button>
            <AnimatePresence initial={false}>
              {showTab && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease }}
                  className="overflow-hidden"
                >
                  <input
                    value={tab}
                    onChange={(e) => setTab(e.target.value)}
                    placeholder="Sheet tab name, e.g. Sheet2"
                    className="mt-3 w-full rounded-xl border border-line bg-ink/80 px-4 py-3 font-mono text-[13px] text-paper placeholder:text-fog/50 transition focus:border-sky/60 sm:w-72"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* statuses */}
            <AnimatePresence mode="wait">
              {status === "loading" && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-5 flex items-center gap-3 rounded-xl border border-lime/20 bg-lime/5 px-4 py-3"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-lime" />
                  </span>
                  <span className="font-mono text-xs tracking-wide text-lime">{phase}</span>
                </motion.div>
              )}
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-5 flex items-start gap-3 rounded-xl border border-rose/30 bg-rose/5 px-4 py-3"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose" />
                  <div>
                    <p className="text-sm leading-relaxed text-paper">{error}</p>
                    <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-fog">
                      Fastest fix: Sheets → File → Share → “Publish to the web” → Entire document → CSV → copy that link.<br />
                      Or: File → Share → General access → “Anyone with the link · Viewer”, then paste the normal /edit link.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* recents */}
            {recents.length > 0 && (
              <div className="mt-6 border-t border-line pt-5">
                <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-fog">
                  <History className="h-3.5 w-3.5" /> RECENT SHEETS
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {recents.map((r) => (
                    <button
                      key={r}
                      onClick={() => { setUrl(r); load(r); }}
                      className="group flex max-w-full items-center gap-2 rounded-full border border-line px-3.5 py-1.5 font-mono text-[11px] text-fog transition hover:border-lime/40 hover:text-paper"
                    >
                      <span className="max-w-52 truncate">{r.replace(/^https?:\/\//, "").slice(0, 42)}…</span>
                      <ArrowRight className="h-3 w-3 text-lime opacity-0 transition group-hover:opacity-100" />
                    </button>
                  ))}
                  <button
                    onClick={() => { setRecents([]); localStorage.removeItem(RECENT_KEY); }}
                    className="grid h-7 w-7 place-items-center rounded-full border border-line text-fog transition hover:border-rose/50 hover:text-rose"
                    title="Clear history"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* right: demo card */}
          <div className="glass-col !border-lime/30 flex flex-col justify-between rounded-3xl p-6 md:p-8">
            <div>
              <div className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.25em] text-lime">
                <ListTodo className="h-4 w-4" />
                NO SHEET HANDY?
              </div>
              <p className="mt-4 text-sm leading-relaxed text-fog">
                Take the built-in 12-question arena demo for a spin — four rounds, full
                scoring, instant champion verdict.
              </p>
              <div className="mt-5 flex gap-4 font-mono text-[11px] text-fog">
                <span className="flex items-center gap-1.5"><Layers3 className="h-3.5 w-3.5 text-lime" /> 4 rounds</span>
                <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-sky" /> ~4 min</span>
              </div>
            </div>
            <button
              onClick={runDemo}
              disabled={status === "loading"}
              className="sheen mt-6 flex items-center justify-center gap-2 rounded-xl border border-lime/50 bg-lime/10 px-6 py-4 font-mono text-[13px] font-bold tracking-wider text-lime transition hover:bg-lime hover:text-ink active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4" />
              PLAY DEMO SET
            </button>
          </div>
        </motion.section>

        {/* format guide */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease }}
          className="glass mx-auto mt-6 max-w-4xl rounded-3xl"
        >
          <button
            onClick={() => setShowGuide((v) => !v)}
            className="flex w-full items-center justify-between px-6 py-5 md:px-8"
          >
            <span className="flex items-center gap-3 font-mono text-[11px] font-semibold tracking-[0.25em] text-fog">
              <TableProperties className="h-4 w-4 text-sky" />
              HOW TO FORMAT YOUR SHEET
            </span>
            <ChevronDown className={cn("h-4 w-4 text-fog transition-transform", showGuide && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {showGuide && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease }}
                className="overflow-hidden"
              >
                <div className="grid gap-8 border-t border-line px-6 py-6 md:grid-cols-[1.4fr_1fr] md:px-8">
                  <div>
                    {/* mini table preview */}
                    <div className="overflow-x-auto rounded-xl border border-line">
                      <table className="w-full min-w-[560px] text-left font-mono text-[11px]">
                        <thead>
                          <tr className="bg-white/[0.04] text-fog">
                            {["Question", "A", "B", "C", "D", "Answer", "Round"].map((h) => (
                              <th key={h} className="border-b border-line px-3 py-2.5 font-medium tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="text-fog/90">
                          <tr className="border-b border-line/50">
                            <td className="px-3 py-2.5 text-paper">Red planet?</td><td className="px-3 py-2.5">Venus</td><td className="px-3 py-2.5 text-lime">Mars</td><td className="px-3 py-2.5">Jupiter</td><td className="px-3 py-2.5">Mercury</td><td className="px-3 py-2.5 font-bold text-lime">B</td><td className="px-3 py-2.5"><span className="rounded bg-lime/10 px-1.5 py-0.5 text-lime">Easy</span></td>
                          </tr>
                          <tr className="border-b border-line/50">
                            <td className="px-3 py-2.5 text-paper">12 × 8?</td><td className="px-3 py-2.5">88</td><td className="px-3 py-2.5 text-lime">96</td><td className="px-3 py-2.5">104</td><td className="px-3 py-2.5">112</td><td className="px-3 py-2.5 font-bold text-lime">96</td><td className="px-3 py-2.5"><span className="rounded bg-sky/10 px-1.5 py-0.5 text-sky">Average</span></td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2.5 text-paper">Mona Lisa by…?</td><td className="px-3 py-2.5">Michelangelo</td><td className="px-3 py-2.5">Raphael</td><td className="px-3 py-2.5 text-lime">Da Vinci</td><td className="px-3 py-2.5">Donatello</td><td className="px-3 py-2.5 font-bold text-lime">C</td><td className="px-3 py-2.5"><span className="rounded bg-amber/10 px-1.5 py-0.5 text-amber">Difficult</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(SAMPLE_CSV);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1800);
                        } catch { /* noop */ }
                      }}
                      className="mt-3 flex items-center gap-2 rounded-lg border border-line px-3 py-2 font-mono text-[11px] text-fog transition hover:border-lime/40 hover:text-paper"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-lime" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "COPIED — PASTE INTO YOUR SHEET" : "COPY CSV TEMPLATE"}
                    </button>
                  </div>
                  <ul className="space-y-3.5 text-[13px] leading-relaxed text-fog">
                    {[
                      ["One header row. A Question column is required — everything else is optional magic.", true],
                      ["Options as columns A–F (or a single Options column split with | ). Leave options empty for open verbal questions — the Answer is simply revealed.", true],
                      ["Answer accepts a letter (B), a number (2), the exact option text — or any free text for open questions.", true],
                      ["Round groups questions: Easy 1pt · Average 2pts · Difficult 3pts · Clincher 5pts. Blank round = one general round.", true],
                      ["Optional Points column overrides scoring per question.", true],
                      ["Optional Image column (Image / Picture / Photo) — paste a direct image URL or Google Drive share link for guess-the-image rounds. Works with MCQ and open questions.", true],
                      ["Optional Explanation shows after the answer reveal.", true],
                    ].map(([text], i) => (
                      <li key={i} className="flex gap-2.5">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime" strokeWidth={3} />
                        <span>{text as string}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* steps */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease }}
          className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3"
        >
          {[
            { n: "01", t: "Make it public", d: "Share → “Anyone with the link” as Viewer. Viewing is all we need." },
            { n: "02", t: "Paste the link", d: "Your sheet is read over the wire — nothing is stored anywhere." },
            { n: "03", t: "Enter the arena", d: "Rounds are auto-built from your Round column. Let the bee begin." },
          ].map((s) => (
            <div key={s.n} className="glass group rounded-2xl p-6 transition hover:border-lime/30">
              <span className="font-display text-2xl font-bold text-outline transition group-hover:text-lime" style={{ WebkitTextStrokeWidth: 1.4 }}>
                {s.n}
              </span>
              <h3 className="mt-3 font-display text-sm font-bold tracking-wide text-paper">{s.t.toUpperCase()}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-fog">{s.d}</p>
            </div>
          ))}
        </motion.section>
      </main>
    </div>
  );
}
