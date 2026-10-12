import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, Check, Clock, ChevronRight, Volume2, VolumeX, LogOut,
  Lightbulb, PenLine, Award, UsersRound, Hourglass, BellRing,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { QuizRound, TeamScore } from "../../lib/types";
import { sfx, setMuted, isMuted } from "../../lib/sound";
import RankBadge from "../RankBadge";

const ease = [0.22, 1, 0.36, 1] as const;
const LETTERS = ["A", "B", "C", "D", "E", "F"];

type QState = "hidden" | "live" | "revealed";

interface Props {
  round: QuizRound;
  roundIndex: number;
  totalRounds: number;
  teams: TeamScore[];
  onAward: (teamId: string, questionIndex: number, points: number) => void;
  onRoundDone: () => void;
  onQuit: () => void;
}

export default function HostGame({
  round, roundIndex, totalRounds, teams, onAward, onRoundDone, onQuit,
}: Props) {
  const [qIndex, setQIndex] = useState(0);
  const [qState, setQState] = useState<QState>("hidden");
  const [left, setLeft] = useState(round.def.seconds);
  const [awardSet, setAwardSet] = useState<string[]>([]);
  const [muted, setMutedState] = useState(isMuted());
  const leftRef = useRef(round.def.seconds);
  const lastTickRef = useRef(round.def.seconds);
  const appliedRef = useRef(false);

  const roundDone = qIndex >= round.questions.length;
  const question = round.questions[Math.min(qIndex, round.questions.length - 1)];
  const isOpen = question.kind === "open";
  const pointsFor = question.points > 0 ? question.points : round.def.points;
  const ordered = [...teams].sort((a, b) => a.contestant.seat - b.contestant.seat);
  const timeUp = left <= 0;

  /* ---------- timer: runs only while live ---------- */
  useEffect(() => { leftRef.current = left; }, [left]);

  useEffect(() => {
    if (qState !== "live" || roundDone) return;
    lastTickRef.current = Math.ceil(leftRef.current);
    const iv = setInterval(() => {
      const next = Math.max(0, leftRef.current - 0.1);
      leftRef.current = next;
      setLeft(next);
      const whole = Math.ceil(next);
      if (whole !== lastTickRef.current) {
        lastTickRef.current = whole;
        if (whole <= 5 && whole > 0) sfx.tick();
      }
      if (next <= 0) {
        clearInterval(iv);
        sfx.wrong(); // time-up buzz, answer still hidden until host reveals
      }
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qState, qIndex, roundDone]);

  useEffect(() => {
    if (roundDone) onRoundDone();
  }, [roundDone, onRoundDone]);

  /* ---------- actions ---------- */
  const reveal = useCallback(() => {
    if (qState !== "hidden") return;
    sfx.advance();
    setQState("live");
  }, [qState]);

  const showAnswer = useCallback(() => {
    if (qState !== "live") return;
    sfx.select();
    setQState("revealed");
  }, [qState]);

  const toggleAward = useCallback((teamId: string) => {
    setAwardSet((s) => (s.includes(teamId) ? s.filter((x) => x !== teamId) : [...s, teamId]));
    sfx.tick();
  }, []);

  const confirmNext = useCallback(() => {
    if (qState !== "revealed" || appliedRef.current) return;
    appliedRef.current = true;
    awardSet.forEach((id) => onAward(id, qIndex, pointsFor));
    if (awardSet.length > 0) sfx.correct();
    setQIndex((i) => i + 1);
    setQState("hidden");
    setAwardSet([]);
    setLeft(round.def.seconds);
    leftRef.current = round.def.seconds;
    appliedRef.current = false;
    if (awardSet.length === 0) sfx.advance();
  }, [qState, awardSet, onAward, qIndex, pointsFor, round.def.seconds]);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (roundDone) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (qState === "hidden") reveal();
        else if (qState === "live") showAnswer();
        else confirmNext();
        return;
      }
      if (qState === "revealed") {
        const n = parseInt(e.key);
        if (n >= 1 && n <= ordered.length && n <= 9) {
          toggleAward(ordered[n - 1].contestant.id);
        } else if (e.key.toLowerCase() === "c") {
          setAwardSet([]);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundDone, qState, reveal, showAnswer, confirmNext, toggleAward, ordered.length]);

  /* ---------- derived ---------- */
  const frac = left / round.def.seconds;
  const danger = left <= 5 && qState === "live" && !timeUp;
  const accent = timeUp && qState === "live" ? "#FFB84D" : danger ? "#FF5C8A" : round.def.color;
  const R = 30;
  const C = 2 * Math.PI * R;

  if (roundDone) return null;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* top bar — slim, full width */}
      <header className="flex w-full items-center justify-between gap-4 px-4 pt-5 md:px-8">
        <span className="pip pip-glass md:!text-[12px]" style={{ color: round.def.color, borderColor: `${round.def.color}40`, background: `${round.def.color}0f` }}>
          <span className="dot animate-pulse" />
          ROUND {roundIndex + 1}/{totalRounds} · {round.def.label.toUpperCase()}
        </span>
        <div className="flex items-center gap-3">
          <span className="pip pip-glass md:!text-[12px] text-fog">
            <span className="dot opacity-70" />
            Q{String(qIndex + 1).padStart(2, "0")}<span className="text-fog/50">/{String(round.questions.length).padStart(2, "0")}</span>
            <span className="ml-2 hidden md:inline" style={{ color: round.def.color }}>· {pointsFor} PT{pointsFor > 1 ? "S" : ""}</span>
          </span>
          <button
            onClick={() => { const m = !muted; setMutedState(m); setMuted(m); }}
            className="grid h-9 w-9 place-items-center rounded-full border border-line text-fog transition hover:border-lime/40 hover:text-paper"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            onClick={onQuit}
            className="grid h-9 w-9 place-items-center rounded-full border border-line text-fog transition hover:border-rose/50 hover:text-rose"
            title="End competition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* progress segments — full width */}
      <div className="mt-4 flex w-full gap-1 px-4 md:gap-1.5 md:px-8">
        {round.questions.map((_, i) => (
          <div
            key={i}
            className="seg h-1.5 rounded-full"
            style={{
              flexGrow: i === qIndex ? 2.4 : 1,
              background: i < qIndex ? round.def.color : i === qIndex ? `${round.def.color}aa` : "rgba(255,255,255,0.08)",
            }}
          />
        ))}
      </div>

      {/* team strip — tiled grid that uses the whole width */}
      <div className="mt-4 grid w-full grid-cols-[repeat(auto-fill,minmax(138px,1fr))] gap-2 px-4 md:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:px-8">
        {ordered.map((t) => {
          const inAward = awardSet.includes(t.contestant.id);
          const interactive = qState === "revealed";
          return (
            <motion.button
              key={t.contestant.id}
              layout
              transition={{ duration: 0.4, ease }}
              onClick={() => interactive && toggleAward(t.contestant.id)}
              disabled={!interactive}
              className={cn(
                "glass relative flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition md:px-3 md:py-2.5",
                inAward
                  ? "!border-[var(--tc)]"
                  : interactive
                    ? "hover:border-white/30 hover:bg-white/[0.05]"
                    : "cursor-default"
              )}
              style={
                inAward
                  ? ({ background: `${t.contestant.color}1f`, boxShadow: `0 0 24px ${t.contestant.glow}`, "--tc": t.contestant.color } as React.CSSProperties)
                  : undefined
              }
              title={t.contestant.seat <= 9 ? `Key ${t.contestant.seat}${interactive ? " · toggle award" : ""}` : interactive ? "Toggle award" : undefined}
            >
              <RankBadge rank={t.rank} size="sm" />
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: t.contestant.color, boxShadow: `0 0 8px ${t.contestant.glow}` }}
              />
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-paper md:text-[13px]">{t.contestant.name}</span>
              <span className="font-mono text-[13px] font-bold tabular-nums md:text-[15px]" style={{ color: t.contestant.color }}>{t.total}</span>
              {inAward && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-lime text-ink"
                >
                  <Check className="h-3 w-3" strokeWidth={3.5} />
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* ================= stage ================= */}
      <main className="flex w-full flex-1 flex-col items-center justify-center px-4 py-8 md:px-8">
        <AnimatePresence mode="wait">
          {qState === "hidden" ? (
            <motion.button
              key={`hidden-${qIndex}`}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.45, ease }}
              onClick={reveal}
              className="glass group flex min-h-[22rem] w-full max-w-7xl flex-col items-center justify-center rounded-3xl transition hover:border-white/25 md:min-h-[26rem]"
            >
              <span className="font-mono text-[11px] tracking-[0.35em] text-fog md:text-[13px]">
                QUESTION {String(qIndex + 1).padStart(2, "0")}
                <span className="mx-2 text-white/20">|</span>
                <span style={{ color: round.def.color }}>{pointsFor} PT{pointsFor > 1 ? "S" : ""} · {round.def.seconds}S</span>
                {isOpen && <span className="ml-2 text-violet">· OPEN ANSWER</span>}
              </span>
              <span className="mt-8 grid h-20 w-20 place-items-center rounded-2xl border border-line bg-ink text-fog transition group-hover:border-lime/50 group-hover:text-lime group-hover:shadow-[0_0_40px_rgba(184,255,60,0.25)] md:h-24 md:w-24">
                <Eye className="h-9 w-9 md:h-11 md:w-11" />
              </span>
              <span className="mt-7 font-display text-2xl font-bold tracking-wide text-paper md:text-4xl">
                REVEAL QUESTION
              </span>
              <span className="mt-3 font-mono text-[11px] tracking-[0.3em] text-fog/60 md:text-[12px]">SPACE / CLICK</span>
            </motion.button>
          ) : (
            <motion.div
              key={`q-${qIndex}`}
              initial={{ opacity: 0, y: 30, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.5, ease }}
              className="flex w-full max-w-7xl flex-1 flex-col items-center justify-center text-center"
            >
              {/* status line + timer */}
              <div className="flex w-full max-w-6xl items-center justify-between gap-4">
                <span className="font-mono text-[11px] tracking-[0.3em] text-fog/80 md:text-[12px]">
                  {qState === "live"
                    ? timeUp ? "TIME'S UP — REVEAL THE ANSWER" : "TEAMS ANSWER NOW"
                    : "ANSWER REVEALED — AWARD POINTS"}
                </span>
                <div className={cn("relative shrink-0", danger && "ring-pulse")}>
                  <svg viewBox="0 0 76 76" className="-rotate-90" style={{ width: "clamp(76px, 7vw, 96px)", height: "clamp(76px, 7vw, 96px)" }}>
                    <circle cx="38" cy="38" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                    <circle
                      cx="38" cy="38" r={R} fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={C}
                      strokeDashoffset={C * (1 - frac)}
                      style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.3s", filter: `drop-shadow(0 0 8px ${accent})` }}
                    />
                  </svg>
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="font-mono text-xl font-bold tabular-nums md:text-2xl" style={{ color: accent }}>
                      {timeUp && qState !== "revealed" ? <Hourglass className="h-5 w-5 md:h-6 md:w-6" /> : qState === "revealed" ? <Clock className="h-5 w-5 text-fog md:h-6 md:w-6" /> : Math.ceil(left)}
                    </span>
                  </div>
                </div>
              </div>

              {/* the question — fills the stage */}
              <h2
                className="mt-6 w-full max-w-5xl font-display font-bold leading-[1.12] tracking-tight text-paper md:mt-10"
                style={{ fontSize: "clamp(1.9rem, 4.6vw, 3.75rem)" }}
              >
                {question.text}
              </h2>

              {/* MCQ options (quiet, display-only) */}
              {!isOpen && (
                <div className="mt-8 grid w-full max-w-5xl gap-3 sm:grid-cols-2 md:mt-12 md:gap-4">
                  {question.options.map((opt, i) => {
                    const isCorrect = i === question.answerIndex;
                    const revealed = qState === "revealed";
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.12 + i * 0.05, ease }}
                        className={cn(
                          "flex items-center gap-4 rounded-xl border px-5 py-4 text-left transition-all duration-300 md:px-6 md:py-5",
                          revealed && isCorrect && "glass-col !border-lime/60 shadow-[0_0_40px_rgba(184,255,60,0.2)]",
                          revealed && !isCorrect && "glass opacity-30",
                          !revealed && "glass"
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-10 w-10 shrink-0 place-items-center rounded-lg font-mono text-base font-bold md:h-12 md:w-12 md:text-lg",
                            revealed && isCorrect ? "bg-lime text-ink" : "bg-white/5 text-fog"
                          )}
                        >
                          {revealed && isCorrect ? <Check className="h-5 w-5" strokeWidth={3} /> : LETTERS[i]}
                        </span>
                        <span className={cn("text-base font-medium leading-snug md:text-xl", revealed && isCorrect ? "text-paper" : "text-paper/75")}>
                          {opt}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* open question marker */}
              {isOpen && qState === "live" && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-10 flex items-center gap-2 rounded-full border border-violet/40 bg-violet/10 px-5 py-2.5 font-mono text-[12px] tracking-[0.3em] text-violet md:text-[13px]"
                >
                  <PenLine className="h-4 w-4" />
                  OPEN ANSWER — VERBAL / WRITTEN
                </motion.p>
              )}

              {/* reveal answer button */}
              {qState === "live" && (
                <motion.button
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.35, ease }}
                  onClick={showAnswer}
                  className={cn(
                    "sheen group mt-10 flex items-center gap-3 rounded-2xl px-10 py-5 font-mono text-sm font-bold tracking-[0.2em] transition active:scale-[0.98] md:mt-14 md:text-base",
                    timeUp
                      ? "bg-amber text-ink shadow-[0_0_50px_rgba(255,184,77,0.4)]"
                      : "border border-lime/50 bg-lime/10 text-lime hover:bg-lime hover:text-ink"
                  )}
                >
                  <BellRing className={cn("h-5 w-5", timeUp && "animate-bounce")} />
                  {timeUp ? "TIME'S UP — SHOW ANSWER" : "SHOW ANSWER"}
                </motion.button>
              )}

              {/* ============ revealed ============ */}
              {qState === "revealed" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.45, ease }}
                  className="mt-8 flex w-full max-w-6xl flex-1 flex-col items-center justify-center md:mt-10"
                >
                  {isOpen && (
                    <div className="glass-col !border-lime/40 w-full max-w-4xl rounded-3xl px-6 py-7 md:py-9">
                      <p className="font-mono text-[11px] tracking-[0.4em] text-fog md:text-[12px]">THE ANSWER IS</p>
                      <p
                        className="mt-4 font-display font-extrabold text-lime"
                        style={{ fontSize: "clamp(2rem, 5.5vw, 4.5rem)", fontWeight: 800, lineHeight: 1.05 }}
                      >
                        {question.answerText}
                      </p>
                    </div>
                  )}
                  {question.explanation && (
                    <p className="mt-5 flex items-start justify-center gap-2 text-sm leading-relaxed text-fog md:text-base">
                      <Lightbulb className="mt-1 h-4 w-4 shrink-0 text-amber" />
                      {question.explanation}
                    </p>
                  )}

                  {/* award controls */}
                  <div className="glass-strong mt-6 flex w-full flex-col items-center gap-5 rounded-3xl px-5 py-6 md:mt-8 md:px-8 md:py-7">
                    <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.3em] text-fog md:text-[12px]">
                      <Award className="h-4 w-4 text-lime" />
                      TAP TEAMS THAT GOT IT · +{pointsFor} PT{pointsFor > 1 ? "S" : ""} EACH · KEYS 1–{Math.min(9, teams.length)}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 md:gap-2.5">
                      {ordered.map((t) => {
                        const inAward = awardSet.includes(t.contestant.id);
                        return (
                          <button
                            key={t.contestant.id}
                            onClick={() => toggleAward(t.contestant.id)}
                            className={cn(
                              "flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[12px] font-bold transition active:scale-95 md:px-5 md:py-2.5 md:text-[13px]",
                              inAward ? "text-ink" : "border-line text-fog hover:border-white/30 hover:text-paper"
                            )}
                            style={inAward ? { background: t.contestant.color, borderColor: t.contestant.color } : undefined}
                          >
                            {inAward && <Check className="h-4 w-4" strokeWidth={3} />}
                            {t.contestant.name}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setAwardSet([])}
                        className="flex items-center gap-2 rounded-full border border-dashed border-line px-4 py-2 font-mono text-[12px] text-fog transition hover:border-rose/50 hover:text-rose md:px-5 md:py-2.5 md:text-[13px]"
                      >
                        <UsersRound className="h-4 w-4" />
                        NOBODY
                      </button>
                    </div>
                    <button
                      onClick={confirmNext}
                      className="sheen group flex items-center gap-3 rounded-xl bg-lime px-12 py-4 font-mono text-sm font-bold tracking-[0.2em] text-ink transition hover:shadow-[0_0_50px_rgba(184,255,60,0.4)] active:scale-[0.98] md:text-base"
                    >
                      {awardSet.length > 0 ? `AWARD ${awardSet.length} & NEXT` : "NO POINTS — NEXT"}
                      <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
