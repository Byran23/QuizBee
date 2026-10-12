import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useSpring, useTransform, AnimatePresence } from "framer-motion";
import {
  Trophy, Target, Flame, Clock4, ChevronDown, Check, X, Minus,
  RotateCcw, ArrowLeftRight, Crown, Medal, Save,
} from "lucide-react";
import { cn } from "../utils/cn";
import { AnswerRecord, QuizData, LeaderboardEntry } from "../lib/types";
import { fireConfetti } from "../lib/confetti";
import { sfx } from "../lib/sound";

const ease = [0.22, 1, 0.36, 1] as const;
const LB_KEY = "quizbee.leaderboard";

interface Props {
  data: QuizData;
  records: AnswerRecord[];
  score: number;
  bestStreak: number;
  sourceLabel: string;
  onReplay: () => void;
  onNewSheet: () => void;
}

function grade(acc: number): { title: string; blurb: string; color: string } {
  if (acc >= 0.95) return { title: "GRAND CHAMPION", blurb: "A near-flawless run. The arena bows to you.", color: "#B8FF3C" };
  if (acc >= 0.8) return { title: "QUIZ MASTER", blurb: "Sharp, fast, relentless. Podium material.", color: "#5CD2FF" };
  if (acc >= 0.6) return { title: "RISING SCHOLAR", blurb: "Strong showing — the final rounds are within reach.", color: "#FFB84D" };
  if (acc >= 0.4) return { title: "BRAVE CONTENDER", blurb: "You stepped into the arena. Now sharpen the blade.", color: "#FF5C8A" };
  return { title: "FUTURE FINALIST", blurb: "Every champion has a score like this in their past.", color: "#8B7CFF" };
}

export default function ResultsScreen({ data, records, score, bestStreak, sourceLabel, onReplay, onNewSheet }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const correct = records.filter((r) => r.correct).length;
  const accuracy = records.length ? correct / records.length : 0;
  const avgTime = records.length ? records.reduce((s, r) => s + r.timeLeft, 0) / records.length : 0;
  const g = useMemo(() => grade(accuracy), [accuracy]);

  const spring = useSpring(0, { stiffness: 60, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    spring.set(score);
    const unsub = display.on("change", (v) => setShown(v));
    return unsub;
  }, [spring, display, score]);

  /* confetti + fanfare */
  useEffect(() => {
    if (accuracy >= 0.6 && canvasRef.current) {
      const cancel = fireConfetti(canvasRef.current, accuracy >= 0.9 ? 220 : 130);
      sfx.fanfare();
      const t = setTimeout(() => canvasRef.current && fireConfetti(canvasRef.current, 100), 900);
      return () => { cancel(); clearTimeout(t); };
    }
  }, [accuracy]);

  /* leaderboard */
  const [name, setName] = useState(() => localStorage.getItem("quizbee.playername") || "");
  const [saved, setSaved] = useState(false);
  const [board, setBoard] = useState<LeaderboardEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(LB_KEY) || "[]"); } catch { return []; }
  });

  const saveScore = () => {
    if (!name.trim()) return;
    const entry: LeaderboardEntry = {
      name: name.trim(),
      score,
      maxScore: data.totalPoints,
      accuracy: Math.round(accuracy * 100),
      date: Date.now(),
      source: sourceLabel,
    };
    const next = [...board, entry].sort((a, b) => b.score - a.score).slice(0, 8);
    setBoard(next);
    localStorage.setItem(LB_KEY, JSON.stringify(next));
    localStorage.setItem("quizbee.playername", name.trim());
    setSaved(true);
    sfx.correct();
  };

  const [reviewOpen, setReviewOpen] = useState(false);

  /* round breakdown */
  const perRound = data.rounds.map((r) => {
    const recs = records.filter((rc) => rc.question.round.toLowerCase().trim() === (r.questions[0]?.round ?? "").toLowerCase().trim());
    const earned = recs.reduce((s, rc) => s + rc.pointsEarned, 0);
    const possible = recs.reduce((s, rc) => s + (rc.question.points > 0 ? rc.question.points : r.def.points), 0);
    return { def: r.def, earned, possible, count: recs.length };
  });

  const R = 58;
  const C = 2 * Math.PI * R;

  return (
    <div className="relative min-h-screen pb-24">
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-40 h-full w-full" />

      {/* grade header */}
      <div className="mx-auto max-w-5xl px-6 pt-20 text-center">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="font-mono text-[11px] tracking-[0.4em] text-fog"
        >
          FINAL BUZZER · {sourceLabel.toUpperCase()}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, scale: 0.9, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease }}
          className="mt-4 font-display text-4xl font-extrabold tracking-tight md:text-7xl"
          style={{ color: g.color, textShadow: `0 0 80px ${g.color}44`, fontWeight: 800 }}
        >
          {g.title}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-fog"
        >
          {g.blurb}
        </motion.p>
      </div>

      {/* hero stats */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.25, ease }}
        className="mx-auto mt-12 grid max-w-4xl gap-4 px-6 sm:grid-cols-[1.3fr_1fr]"
      >
        {/* score + donut */}
        <div className="flex items-center justify-between gap-6 rounded-2xl border border-line bg-panel p-7">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-fog">SCORE</p>
            <p className="font-display text-6xl font-extrabold tabular-nums text-lime md:text-7xl" style={{ fontWeight: 800 }}>
              {shown}
              <span className="ml-2 text-lg text-fog" style={{ fontWeight: 500 }}>/ {data.totalPoints}</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] tracking-wider text-fog">
              <span className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5">
                <Check className="h-3 w-3 text-lime" strokeWidth={3} /> {correct}/{records.length} CORRECT
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5">
                <Flame className="h-3 w-3 text-amber" /> BEST STREAK {bestStreak}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5">
                <Clock4 className="h-3 w-3 text-sky" /> AVG {avgTime.toFixed(1)}s LEFT
              </span>
            </div>
          </div>
          {/* accuracy donut */}
          <div className="relative hidden shrink-0 sm:block">
            <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
              <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
              <motion.circle
                cx="70" cy="70" r={R} fill="none"
                stroke={g.color} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={C}
                initial={{ strokeDashoffset: C }}
                animate={{ strokeDashoffset: C * (1 - accuracy) }}
                transition={{ duration: 1.4, delay: 0.5, ease }}
                style={{ filter: `drop-shadow(0 0 8px ${g.color})` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-extrabold tabular-nums" style={{ fontWeight: 800 }}>{Math.round(accuracy * 100)}%</span>
              <span className="font-mono text-[9px] tracking-[0.25em] text-fog">ACCURACY</span>
            </div>
          </div>
        </div>

        {/* save to leaderboard */}
        <div className="flex flex-col justify-between rounded-2xl border border-line bg-panel p-7">
          <div>
            <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-fog">
              <Crown className="h-3.5 w-3.5 text-amber" /> HALL OF FAME
            </p>
            <div className="mt-4 flex gap-2">
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setSaved(false); }}
                onKeyDown={(e) => e.key === "Enter" && saveScore()}
                placeholder="Your callsign"
                maxLength={18}
                className="min-w-0 flex-1 rounded-lg border border-line bg-ink/80 px-3.5 py-3 font-mono text-[13px] text-paper placeholder:text-fog/50 transition focus:border-lime/60"
              />
              <button
                onClick={saveScore}
                disabled={!name.trim() || saved}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-4 font-mono text-[11px] font-bold tracking-wider transition active:scale-95",
                  saved ? "bg-lime/20 text-lime" : "bg-lime text-ink hover:shadow-[0_0_24px_rgba(184,255,60,0.35)]",
                  !name.trim() && "cursor-not-allowed opacity-40"
                )}
              >
                {saved ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Save className="h-3.5 w-3.5" />}
                {saved ? "SAVED" : "SAVE"}
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {board.slice(0, 4).map((e, i) => (
                <div key={e.date} className="flex items-center gap-3 rounded-lg border border-line/60 bg-ink/40 px-3 py-2">
                  <span className={cn("font-mono text-[11px] font-bold", i === 0 ? "text-amber" : "text-fog")}>
                    {i === 0 ? <Medal className="h-3.5 w-3.5" /> : `#${i + 1}`}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-paper">{e.name}</span>
                  <span className="font-mono text-[11px] font-bold tabular-nums text-lime">{e.score}<span className="text-fog">/{e.maxScore}</span></span>
                </div>
              ))}
              {board.length === 0 && (
                <p className="rounded-lg border border-dashed border-line px-3 py-3 text-center font-mono text-[10px] tracking-wider text-fog/60">
                  NO SCORES YET — BE THE FIRST
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* round breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4, ease }}
        className="mx-6 mt-4 max-w-4xl rounded-2xl border border-line bg-panel px-7 py-6 sm:mx-auto"
      >
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-fog">
          <Target className="h-3.5 w-3.5 text-sky" /> ROUND BREAKDOWN
        </p>
        <div className="mt-5 space-y-4">
          {perRound.map((r) => (
            <div key={r.def.key} className="flex items-center gap-4">
              <span className="w-32 shrink-0 truncate font-mono text-[11px] font-bold tracking-wider" style={{ color: r.def.color }}>
                {r.def.label.toUpperCase()}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: r.possible ? `${(r.earned / r.possible) * 100}%` : 0 }}
                  transition={{ duration: 1, delay: 0.6, ease }}
                  className="h-full rounded-full"
                  style={{ background: r.def.color, boxShadow: `0 0 12px ${r.def.glow}` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-fog">
                {r.earned}<span className="text-fog/50"> / {r.possible}</span>
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* answer review */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease }}
        className="mx-6 mt-4 max-w-4xl rounded-2xl border border-line bg-panel sm:mx-auto"
      >
        <button onClick={() => setReviewOpen((v) => !v)} className="flex w-full items-center justify-between px-7 py-6">
          <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-fog">
            <Trophy className="h-3.5 w-3.5 text-rose" /> REVIEW ALL {records.length} ANSWERS
          </span>
          <ChevronDown className={cn("h-4 w-4 text-fog transition-transform", reviewOpen && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {reviewOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.45, ease }}
              className="overflow-hidden"
            >
              <div className="space-y-2 border-t border-line px-7 py-6">
                {records.map((r, i) => (
                  <div key={i} className="rounded-xl border border-line/70 bg-ink/40 p-4">
                    <div className="flex items-start gap-3">
                      <span className={cn(
                        "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md",
                        r.correct ? "bg-lime/15 text-lime" : "bg-rose/15 text-rose"
                      )}>
                        {r.correct ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : r.timedOut ? <Minus className="h-3.5 w-3.5" strokeWidth={3} /> : <X className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-paper">{r.question.text}</p>
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px]">
                          {r.question.kind === "open" ? (
                            <span className="text-fog">{r.correct ? "Self-marked correct" : r.timedOut ? "Timed out · self-marked missed" : "Self-marked missed"}</span>
                          ) : !r.correct && r.selectedIndex !== null ? (
                            <span className="text-rose">You: {r.question.options[r.selectedIndex]}</span>
                          ) : null}
                          {r.question.kind !== "open" && r.timedOut && <span className="text-rose">Ran out of time</span>}
                          <span className="text-lime">
                            Answer: {r.question.kind === "open" ? r.question.answerText : r.question.options[r.question.answerIndex]}
                          </span>
                          <span className="text-fog">+{r.pointsEarned} pts</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.65, ease }}
        className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
      >
        <button
          onClick={onReplay}
          className="sheen group flex items-center gap-3 rounded-xl bg-lime px-9 py-4 font-mono text-[13px] font-bold tracking-[0.2em] text-ink transition hover:shadow-[0_0_40px_rgba(184,255,60,0.35)] active:scale-[0.98]"
        >
          <RotateCcw className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-180" />
          RUN IT BACK
        </button>
        <button
          onClick={onNewSheet}
          className="flex items-center gap-2 rounded-xl border border-line px-9 py-4 font-mono text-[12px] tracking-[0.2em] text-fog transition hover:border-sky/50 hover:text-paper"
        >
          <ArrowLeftRight className="h-4 w-4" />
          LOAD NEW SHEET
        </button>
      </motion.div>
    </div>
  );
}
