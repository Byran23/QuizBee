import { motion } from "framer-motion";
import {
  Sheet, Timer, Trophy, ListChecks, FastForward, RotateCcw, Sparkles, Swords, UserRound,
  Minus, Plus, SlidersHorizontal, Timer as TimerIcon, Zap, Check, AlertTriangle,
} from "lucide-react";
import { QuizData, QuizMode } from "../lib/types";
import { MAX_QUESTIONS } from "../lib/sheets";
import { cn } from "../utils/cn";

const ease = [0.22, 1, 0.36, 1] as const;

interface Props {
  data: QuizData;
  sourceUrl: string | null;
  via: "csv" | "json" | "demo";
  timerMode: "auto" | "manual";
  onTimerModeChange: (mode: "auto" | "manual") => void;
  onStart: (mode: QuizMode) => void;
  onBack: () => void;
  onUpdateRound: (roundKey: string, patch: { points?: number; seconds?: number }) => void;
}

function Stepper({
  value, unit, min, max, step, onChange,
}: {
  value: number; unit: string; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-ink/60 px-1.5 py-1">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        className="grid h-6 w-6 place-items-center rounded-md text-fog transition hover:hl-soft hover:text-paper disabled:cursor-not-allowed disabled:opacity-25"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="font-mono text-[12px] font-bold tabular-nums text-paper">
        {value}<span className="ml-0.5 text-[10px] font-medium text-fog">{unit}</span>
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        className="grid h-6 w-6 place-items-center rounded-md text-fog transition hover:hl-soft hover:text-paper disabled:cursor-not-allowed disabled:opacity-25"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function BriefingScreen({
  data, sourceUrl, via, timerMode, onTimerModeChange, onStart, onBack, onUpdateRound,
}: Props) {
  const mins = Math.round(data.estimatedSeconds / 60);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease }}
        className="flex items-center gap-2 rounded-full border border-lime/30 bg-lime/5 px-4 py-1.5 font-mono text-[11px] tracking-[0.25em] text-lime"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute h-full w-full animate-ping rounded-full bg-lime opacity-75" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-lime" />
        </span>
        ARENA ARMED · {data.totalQuestions} QUESTIONS LOADED
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1, ease }}
        className="mt-6 text-center font-display text-4xl font-extrabold tracking-tight md:text-6xl"
        style={{ fontWeight: 800 }}
      >
        READY FOR <span className="text-lime">TAKEOFF</span>
      </motion.h1>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.8 }}
        className="mt-4 flex max-w-xl items-center justify-center gap-2 text-center font-mono text-[11px] tracking-wider text-fog"
      >
        <Sheet className="h-3.5 w-3.5 shrink-0 text-lime/70" />
        <span className="truncate">
          {via === "demo" ? "Built-in demo set" : sourceUrl?.replace(/^https?:\/\//, "")}
        </span>
        {data.skippedRows > 0 && (
          <span className="text-amber">· {data.skippedRows} row{data.skippedRows > 1 ? "s" : ""} skipped</span>
        )}
      </motion.div>

      {data.truncatedRows > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease }}
          className="mt-4 flex max-w-xl items-start gap-2.5 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-left"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
          <p className="text-[12px] leading-relaxed text-paper">
            This sheet has more than the <span className="font-bold text-amber">{MAX_QUESTIONS}-question limit</span> —
            using the first {MAX_QUESTIONS} and ignoring the last {data.truncatedRows}. Split the extras
            into another sheet to run them as a separate quiz.
          </p>
        </motion.div>
      )}

      {/* stats strip */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease }}
        className="mt-10 flex flex-wrap items-center justify-center gap-3 font-mono text-[11px] tracking-wider text-fog"
      >
        <span className="flex items-center gap-2 rounded-full border border-line px-4 py-2">
          <ListChecks className="h-3.5 w-3.5 text-lime" /> {data.totalQuestions} QUESTIONS
        </span>
        <span className="flex items-center gap-2 rounded-full border border-line px-4 py-2">
          <Trophy className="h-3.5 w-3.5 text-amber" /> {data.totalPoints} PTS AT STAKE
        </span>
        <span className="flex items-center gap-2 rounded-full border border-line px-4 py-2">
          <Timer className="h-3.5 w-3.5 text-sky" /> ~{mins} MIN RUN
        </span>
        {data.rounds.some((r) => r.questions.some((q) => q.image)) && (
          <span className="flex items-center gap-2 rounded-full border border-sky/40 bg-sky/10 px-4 py-2 text-sky">
            🖼 {data.rounds.reduce((n, r) => n + r.questions.filter((q) => q.image).length, 0)} WITH IMAGES
          </span>
        )}
      </motion.div>

      {/* round cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.32, duration: 0.7 }}
        className="mt-12 flex w-full max-w-4xl items-center justify-center gap-2 font-mono text-[10px] tracking-[0.3em] text-fog"
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-lime" />
        FINE-TUNE POINTS & TIME PER ROUND — APPLIES INSTANTLY
      </motion.div>
      <div className="mt-4 grid w-full max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.rounds.map((r, i) => (
          <motion.div
            key={r.def.key}
            initial={{ opacity: 0, y: 40, rotateX: -12 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.7, delay: 0.35 + i * 0.1, ease }}
            className="glass group relative overflow-hidden rounded-2xl p-5 transition hover:-translate-y-1"
          >
            <div
              className="absolute -top-10 -right-10 h-24 w-24 rounded-full opacity-20 blur-2xl transition group-hover:opacity-40"
              style={{ background: r.def.color }}
            />
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.3em] text-fog">
                ROUND {String(r.def.order).padStart(2, "0")}
              </span>
              <span className="h-2 w-2 rounded-full" style={{ background: r.def.color }} />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold tracking-wide" style={{ color: r.def.color }}>
              {r.def.label.toUpperCase()}
            </h3>
            <div className="mt-3 font-mono text-[11px] text-fog">
              <p>{r.questions.length} question{r.questions.length !== 1 ? "s" : ""}</p>
              {r.questions.some((q) => q.seconds > 0) && (
                <p className="mt-1 text-sky">
                  {r.questions.filter((q) => q.seconds > 0).length} custom timer
                  {r.questions.filter((q) => q.seconds > 0).length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="mt-3 space-y-2">
              <div>
                <p className="mb-1 font-mono text-[9px] tracking-[0.25em] text-fog/60">POINTS EACH</p>
                <Stepper
                  value={r.def.points}
                  unit="pt"
                  min={1}
                  max={25}
                  step={1}
                  onChange={(v) => onUpdateRound(r.def.key, { points: v })}
                />
              </div>
              <div>
                <p className="mb-1 font-mono text-[9px] tracking-[0.25em] text-fog/60">TIME LIMIT</p>
                <Stepper
                  value={r.def.seconds}
                  unit="s"
                  min={5}
                  max={120}
                  step={5}
                  onChange={(v) => onUpdateRound(r.def.key, { seconds: v })}
                />
              </div>
            </div>
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full hl-soft">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(r.questions.length / data.totalQuestions) * 100}%` }}
                transition={{ duration: 0.9, delay: 0.6 + i * 0.1, ease }}
                className="h-full rounded-full"
                style={{ background: r.def.color }}
              />
            </div>
           </motion.div>
        ))}
      </div>

      {/* timer start mode */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.65, ease }}
        className="glass mt-4 w-full max-w-4xl rounded-2xl p-5"
      >
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-fog">
          <TimerIcon className="h-3.5 w-3.5 text-sky" />
          WHEN DOES THE COUNTDOWN START?
        </p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {([
            ["auto", "On reveal", "The clock starts the moment the question appears.", Zap],
            ["manual", "After reading", "Question shows with the clock paused — you start it when ready.", TimerIcon],
          ] as const).map(([m, label, blurb, Icon]) => {
            const active = timerMode === m;
            return (
              <button
                key={m}
                onClick={() => onTimerModeChange(m)}
                className={cn(
                  "glass flex items-start gap-3 rounded-xl p-4 text-left transition hover:hl-b",
                  active && "!border-sky/70"
                )}
                style={active ? { boxShadow: "0 0 26px rgba(92,210,255,0.18)" } : undefined}
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-sky" : "text-fog")} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-mono text-[12px] font-bold tracking-wider text-paper">
                    {label}
                    {active && <Check className="h-3.5 w-3.5 text-sky" strokeWidth={3} />}
                  </span>
                  <span className="mt-1 block text-[12px] leading-snug text-fog">{blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ctas */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.75, ease }}
        className="mt-12 grid w-full max-w-xl gap-4 sm:grid-cols-2"
      >
        <button
          onClick={() => onStart("solo")}
          className="glass-col !border-lime/40 sheen group flex flex-col items-start gap-2 rounded-2xl p-6 text-left text-lime transition hover:!border-lime/70 hover:shadow-[0_0_40px_rgba(184,255,60,0.25)] active:scale-[0.98]"
        >
          <span className="flex items-center gap-2 font-mono text-sm font-bold tracking-[0.2em]">
            <FastForward className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            SOLO RUN
          </span>
          <span className="text-[13px] font-medium leading-snug text-fog">
            Play it yourself — timed answers, streaks and a personal verdict.
          </span>
        </button>
        <button
          onClick={() => onStart("contest")}
          className="glass-col !border-sky/40 sheen group flex flex-col items-start gap-2 rounded-2xl p-6 text-left text-sky transition hover:!border-sky/70 hover:shadow-[0_0_40px_rgba(92,210,255,0.25)] active:scale-[0.98]"
        >
          <span className="flex items-center gap-2 font-mono text-sm font-bold tracking-[0.2em]">
            <Swords className="h-4 w-4 transition-transform group-hover:rotate-12" />
            COMPETITION
          </span>
          <span className="text-[13px] font-medium leading-snug text-fog">
            2–20 teams, host calls the shots, live standings and a champion podium.
          </span>
        </button>
        <button
          onClick={onBack}
          className="flex items-center justify-center gap-2 rounded-xl border border-line px-8 py-4 font-mono text-[12px] tracking-[0.2em] text-fog transition hover:border-rose/40 hover:text-paper sm:col-span-2"
        >
          <RotateCcw className="h-4 w-4" />
          SWAP SHEET
        </button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="mt-8 flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-fog/60"
      >
        <Sparkles className="h-3 w-3" /> <UserRound className="h-3 w-3" /> SOLO: 1–4 / A–D ANSWER · CONTEST: SPACE REVEALS · 1–8 AWARD POINTS
      </motion.p>
    </div>
  );
}
