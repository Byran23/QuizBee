import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame, X, Check, Clock, Lightbulb, ChevronRight, Volume2, VolumeX, LogOut, Eye,
} from "lucide-react";
// note: X still used in the open-answer "MISSED IT" button
import { cn } from "../utils/cn";
import { QuizRound, AnswerRecord } from "../lib/types";
import { sfx, setMuted, isMuted } from "../lib/sound";

const ease = [0.22, 1, 0.36, 1] as const;
const REVEAL_MS = 3600;

type Phase = "answering" | "check" | "revealed";

interface Props {
  round: QuizRound;
  roundIndex: number;
  totalRounds: number;
  score: number;
  streak: number;
  onQuestionResult: (record: AnswerRecord) => void;
  onRoundDone: () => void;
  onQuit: () => void;
}

export default function QuizScreen({
  round, roundIndex, totalRounds, score, streak,
  onQuestionResult, onRoundDone, onQuit,
}: Props) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("answering");
  const [selected, setSelected] = useState<number | null>(null);
  const [selfVerdict, setSelfVerdict] = useState<boolean | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [timeLeft, setTimeLeft] = useState(round.def.seconds);
  const [muted, setMutedState] = useState(isMuted());
  const startRef = useRef<number>(Date.now());
  const lastTickRef = useRef<number>(round.def.seconds);
  const lockedRef = useRef(false);
  const leftRef = useRef(round.def.seconds);

  const roundDone = index >= round.questions.length;
  const question = round.questions[Math.min(index, round.questions.length - 1)];
  const isOpen = question.kind === "open";
  const pointsFor = question.points > 0 ? question.points : round.def.points;

  /* ---------- sync leftRef ---------- */
  useEffect(() => { leftRef.current = timeLeft; }, [timeLeft]);

  /* ---------- countdown ---------- */
  useEffect(() => {
    if (phase !== "answering" || roundDone) return;
    startRef.current = Date.now();
    lastTickRef.current = round.def.seconds;
    const iv = setInterval(() => {
      const next = Math.max(0, leftRef.current - 0.05);
      leftRef.current = next;
      setTimeLeft(next);
      const whole = Math.ceil(next);
      if (whole !== lastTickRef.current) {
        lastTickRef.current = whole;
        if (whole <= 5 && whole > 0) sfx.tick();
      }
      if (next <= 0) {
        clearInterval(iv);
        sfx.timeUp();
        if (isOpen) enterCheck(true);
        else lock(null, true);
      }
    }, 50);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase]);

  /* ---------- round completion ---------- */
  useEffect(() => {
    if (roundDone) onRoundDone();
  }, [roundDone, onRoundDone]);

  /* ---------- MCQ lock ---------- */
  const lock = useCallback(
    (idx: number | null, to = false) => {
      if (lockedRef.current) return;
      lockedRef.current = true;
      const elapsed = (Date.now() - startRef.current) / 1000;
      const left = Math.max(0, round.def.seconds - elapsed);
      const correct = idx !== null && idx === question.answerIndex;
      if (correct) sfx.correct();
      else if (!to) sfx.wrong(); // time-up already plays its own buzzer — don't stack sounds
      setSelected(idx);
      setTimedOut(to);
      setPhase("revealed");
      onQuestionResult({
        question,
        selectedIndex: idx,
        correct,
        timedOut: to,
        pointsEarned: correct ? pointsFor : 0,
        timeLeft: Math.round(left * 10) / 10,
      });
    },
    [question, pointsFor, round.def.seconds, onQuestionResult]
  );

  /* ---------- open: show the answer ---------- */
  const enterCheck = useCallback((to: boolean) => {
    if (lockedRef.current) return;
    sfx.select();
    setTimedOut(to);
    setPhase("check");
  }, []);

  /* ---------- open: self verdict ---------- */
  const verdict = useCallback(
    (correct: boolean) => {
      if (lockedRef.current) return;
      lockedRef.current = true;
      const elapsed = (Date.now() - startRef.current) / 1000;
      const left = Math.max(0, round.def.seconds - elapsed);
      if (correct) sfx.correct();
      else sfx.wrong();
      setSelfVerdict(correct);
      setPhase("revealed");
      onQuestionResult({
        question,
        selectedIndex: null,
        correct,
        timedOut,
        pointsEarned: correct ? pointsFor : 0,
        timeLeft: Math.round(left * 10) / 10,
      });
    },
    [question, pointsFor, round.def.seconds, onQuestionResult, timedOut]
  );

  /* ---------- advance ---------- */
  const advance = useCallback(() => {
    setIndex((i) => i + 1);
    setSelected(null);
    setSelfVerdict(null);
    setTimedOut(false);
    setTimeLeft(round.def.seconds);
    leftRef.current = round.def.seconds;
    lockedRef.current = false;
    setPhase("answering");
    sfx.advance();
  }, [round.def.seconds]);

  useEffect(() => {
    if (phase !== "revealed") return;
    const t = setTimeout(advance, REVEAL_MS);
    return () => clearTimeout(t);
  }, [phase, advance]);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (roundDone) return;
      if (phase === "answering") {
        if (isOpen) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            enterCheck(false);
          }
          return;
        }
        const letters = "abcdef";
        let idx: number | null = null;
        if (/^[1-6]$/.test(e.key)) idx = parseInt(e.key) - 1;
        else if (letters.includes(e.key.toLowerCase())) idx = letters.indexOf(e.key.toLowerCase());
        if (idx !== null && idx < question.options.length) {
          sfx.select();
          lock(idx);
        }
      } else if (phase === "check") {
        const k = e.key.toLowerCase();
        if (k === "y" || k === "1") verdict(true);
        else if (k === "n" || k === "0") verdict(false);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, isOpen, question, lock, advance, enterCheck, verdict, roundDone]);

  /* ---------- derived ---------- */
  const frac = timeLeft / round.def.seconds;
  const danger = timeLeft <= 5 && phase === "answering";
  const accent = danger ? "#FF5C8A" : round.def.color;
  const R = 26;
  const C = 2 * Math.PI * R;
  const letters = useMemo(() => ["A", "B", "C", "D", "E", "F"], []);

  if (roundDone) return null;

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* top bar */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 pt-6">
        <span className="pip pip-glass" style={{ color: round.def.color, borderColor: `${round.def.color}40`, background: `${round.def.color}0f` }}>
          <span className="dot animate-pulse" />
          R{roundIndex + 1}/{totalRounds} · {round.def.label.toUpperCase()}
        </span>

        <div className="flex items-center gap-3">
          <AnimatePresence>
            {streak >= 2 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.6 }}
                className="flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber/10 px-3.5 py-2 font-mono text-[12px] font-bold text-amber"
              >
                <Flame className="h-3.5 w-3.5" />
                {streak}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="rounded-full border border-line bg-panel px-4 py-2 font-mono text-[13px] font-bold tracking-wider">
            <motion.span key={score} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="inline-block text-lime tabular-nums">
              {score}
            </motion.span>
            <span className="ml-1 text-fog">PTS</span>
          </div>
          <button
            onClick={() => { const m = !muted; setMutedState(m); setMuted(m); }}
            className="grid h-9 w-9 place-items-center rounded-full border border-line text-fog transition hover:border-lime/40 hover:text-paper"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            onClick={onQuit}
            className="grid h-9 w-9 place-items-center rounded-full border border-line text-fog transition hover:border-rose/50 hover:text-rose"
            title="Quit to setup"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* segmented progress */}
      <div className="mx-auto mt-5 flex w-full max-w-5xl gap-1.5 px-6">
        {round.questions.map((_, i) => (
          <div
            key={i}
            className="seg h-1 rounded-full"
            style={{
              flexGrow: i === index ? 2.4 : 1,
              background: i < index ? round.def.color : i === index ? `${round.def.color}aa` : "rgba(255,255,255,0.08)",
            }}
          />
        ))}
      </div>

      {/* main card */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -30, filter: "blur(6px)" }}
            transition={{ duration: 0.55, ease }}
          >
            {/* question row */}
            <div className="flex items-start justify-between gap-8">
              <div className="min-w-0">
                <p className="font-mono text-[11px] tracking-[0.35em] text-fog">
                  QUESTION {String(index + 1).padStart(2, "0")} / {String(round.questions.length).padStart(2, "0")}
                  <span className="mx-2 text-white/20">|</span>
                  <span style={{ color: round.def.color }}>{pointsFor} PT{pointsFor > 1 ? "S" : ""}</span>
                  {isOpen && <span className="ml-2 rounded bg-white/5 px-1.5 py-0.5 text-violet">OPEN</span>}
                </p>
                <h2 className="type-qa mt-3 leading-snug text-paper" style={{ fontSize: "clamp(1.65rem, 3.1vw, 2.75rem)" }}>
                  {question.text}
                </h2>
              </div>

              {/* timer ring */}
              <div className={cn("relative shrink-0", danger && "ring-pulse")}>
                <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
                  <circle cx="36" cy="36" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                  <circle
                    cx="36" cy="36" r={R} fill="none"
                    stroke={accent}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={C * (1 - frac)}
                    style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.3s", filter: `drop-shadow(0 0 6px ${accent})` }}
                  />
                </svg>
                <div className="absolute inset-0 grid place-items-center">
                  <span className="font-mono text-lg font-bold tabular-nums" style={{ color: accent }}>
                    {phase === "answering" ? Math.ceil(timeLeft) : <Clock className="h-5 w-5 text-fog" />}
                  </span>
                </div>
              </div>
            </div>

            {/* ============ MCQ options — on reveal only the correct one remains, zoomed & centered ============ */}
            {!isOpen && (
              <div
                className={cn(
                  "mt-8 grid w-full gap-3",
                  phase === "revealed"
                    ? "mx-auto max-w-2xl grid-cols-1 place-items-center"
                    : "md:grid-cols-2"
                )}
              >
                <AnimatePresence mode="popLayout">
                  {question.options.map((opt, i) => {
                    const isCorrect = i === question.answerIndex;
                    const revealed = phase === "revealed";
                    if (revealed && !isCorrect) return null;
                    return (
                      <motion.button
                        key={i}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          scale: revealed && isCorrect ? 1.1 : 1,
                        }}
                        exit={{ opacity: 0, scale: 0.85, filter: "blur(6px)", transition: { duration: 0.3, ease } }}
                        transition={{
                          duration: revealed ? 0.55 : 0.45,
                          delay: revealed ? 0.12 : 0.15 + i * 0.07,
                          ease,
                        }}
                        onClick={() => { if (phase === "answering") { sfx.select(); lock(i); } }}
                        disabled={phase !== "answering"}
                        className={cn(
                          "relative flex items-center gap-4 rounded-2xl border text-left transition-colors duration-300",
                          phase === "answering" &&
                            "glass group sheen px-4 py-4 hover:translate-x-1.5 hover:border-white/25 active:scale-[0.99] md:px-5 md:py-5",
                          revealed && isCorrect &&
                            "glass-col !border-lime/70 w-full justify-center px-7 py-6 shadow-[0_0_60px_rgba(184,255,60,0.3)]"
                        )}
                      >
                        {/* check badge — upper-left corner; letter always stays */}
                        {revealed && isCorrect && (
                          <motion.span
                            initial={{ scale: 0, rotate: -40 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ duration: 0.42, delay: 0.42, ease }}
                            className="absolute -left-3 -top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-lime text-ink shadow-[0_0_22px_rgba(184,255,60,0.75)]"
                          >
                            <Check className="h-4 w-4" strokeWidth={3.5} />
                          </motion.span>
                        )}
                        <span
                          className={cn(
                            "grid shrink-0 place-items-center rounded-lg font-mono font-bold transition-all",
                            revealed && isCorrect
                              ? "h-12 w-12 bg-lime text-ink text-lg"
                              : "h-9 w-9 bg-white/5 text-fog text-sm group-hover:bg-white/10 group-hover:text-paper"
                          )}
                        >
                          {letters[i]}
                        </span>
                        <span
                          className={cn("type-qa leading-snug", revealed && isCorrect ? "text-paper" : "text-paper/85")}
                          style={{ fontSize: revealed && isCorrect ? "clamp(1.25rem, 2.4vw, 1.9rem)" : "0.95rem" }}
                        >
                          {opt}
                        </span>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            {/* ============ open-answer flow ============ */}
            {isOpen && phase === "answering" && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2, ease }}
                className="mt-10 flex flex-col items-center gap-3"
              >
                <p className="font-mono text-[11px] tracking-[0.3em] text-fog/60">THINK · ANSWER ALOUD · THEN REVEAL</p>
                <button
                  onClick={() => enterCheck(false)}
                  className="sheen group flex items-center gap-2.5 rounded-xl border border-violet/50 bg-violet/10 px-7 py-4 font-mono text-[12px] font-bold tracking-[0.2em] text-violet transition hover:bg-violet hover:text-ink active:scale-[0.98]"
                >
                  <Eye className="h-4 w-4" />
                  SHOW ANSWER
                </button>
              </motion.div>
            )}

            {isOpen && phase === "check" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease }}
                className="glass-col !border-lime/40 mt-8 rounded-3xl p-6 text-center md:p-8"
              >
                <p className="font-mono text-[10px] tracking-[0.4em] text-fog">THE ANSWER IS</p>
                <p className="type-qa mt-3 text-lime" style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.6rem)", fontWeight: 800 }}>
                  {question.answerText}
                </p>
                <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <button
                    onClick={() => verdict(true)}
                    className="sheen flex items-center gap-2 rounded-xl bg-lime px-8 py-4 font-mono text-[12px] font-bold tracking-[0.15em] text-ink transition hover:shadow-[0_0_30px_rgba(184,255,60,0.35)] active:scale-[0.98]"
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                    I GOT IT
                  </button>
                  <button
                    onClick={() => verdict(false)}
                    className="flex items-center gap-2 rounded-xl border border-rose/50 bg-rose/10 px-8 py-4 font-mono text-[12px] font-bold tracking-[0.15em] text-rose transition hover:bg-rose hover:text-ink active:scale-[0.98]"
                  >
                    <X className="h-4 w-4" strokeWidth={3} />
                    MISSED IT
                  </button>
                </div>
                <p className="mt-4 font-mono text-[10px] tracking-[0.3em] text-fog/50">Y · GOT IT &nbsp;&nbsp; N · MISSED</p>
              </motion.div>
            )}

            {/* reveal footer */}
            <AnimatePresence>
              {phase === "revealed" && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease }}
                  className="glass-strong mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl px-5 py-4 sm:flex-row sm:items-center"
                >
                  <div className="flex items-start gap-3">
                    {isOpen ? (
                      <span className={cn(
                        "rounded-md px-2.5 py-1 font-mono text-[11px] font-bold tracking-widest",
                        selfVerdict ? "bg-lime/15 text-lime" : "bg-rose/15 text-rose"
                      )}>
                        {selfVerdict ? `+${pointsFor} PT${pointsFor > 1 ? "S" : ""}` : "MISSED"}
                      </span>
                    ) : selected === question.answerIndex ? (
                      <span className="rounded-md bg-lime/15 px-2.5 py-1 font-mono text-[11px] font-bold tracking-widest text-lime">
                        +{pointsFor} PT{pointsFor > 1 ? "S" : ""}
                      </span>
                    ) : timedOut ? (
                      <span className="rounded-md bg-rose/15 px-2.5 py-1 font-mono text-[11px] font-bold tracking-widest text-rose">TIME’S UP</span>
                    ) : (
                      <span className="rounded-md bg-rose/15 px-2.5 py-1 font-mono text-[11px] font-bold tracking-widest text-rose">WRONG</span>
                    )}
                    {question.explanation && (
                      <p className="flex items-start gap-2 text-[13px] leading-relaxed text-fog">
                        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" />
                        {question.explanation}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={advance}
                    className="group flex shrink-0 items-center gap-2 rounded-lg border border-line px-4 py-2.5 font-mono text-[11px] font-bold tracking-widest text-fog transition hover:border-lime/50 hover:text-paper"
                  >
                    NEXT
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
