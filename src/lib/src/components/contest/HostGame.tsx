import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, Check, Clock, ChevronRight, ChevronDown, Volume2, VolumeX, LogOut,
  Lightbulb, PenLine, Award, UsersRound, Hourglass, BellRing, PlayCircle,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { QuizRound, TeamScore } from "../../lib/types";
import { sfx, setMuted, isMuted } from "../../lib/sound";
import RankBadge from "../RankBadge";
import AutoFitText from "../AutoFitText";
import QuestionImage from "../QuestionImage";
import QuestionTypeBadge from "../QuestionTypeBadge";

const ease = [0.22, 1, 0.36, 1] as const;
const LETTERS = ["A", "B", "C", "D", "E", "F"];

type QState = "hidden" | "live" | "revealed";

interface Props {
  round: QuizRound;
  roundIndex: number;
  totalRounds: number;
  teams: TeamScore[];
  /** "manual" = host reads the question first, then starts the clock */
  timerMode?: "auto" | "manual";
  onAward: (teamId: string, questionIndex: number, points: number) => void;
  onRoundDone: () => void;
  onQuit: () => void;
}

export default function HostGame({
  round, roundIndex, totalRounds, teams, timerMode = "auto", onAward, onRoundDone, onQuit,
}: Props) {
  const [qIndex, setQIndex] = useState(0);
  const [qState, setQState] = useState<QState>("hidden");
  const [running, setRunning] = useState(timerMode === "auto");
  const [left, setLeft] = useState(
    round.questions[0]?.seconds > 0 ? round.questions[0].seconds : round.def.seconds
  );
  const [awardSet, setAwardSet] = useState<string[]>([]);
  const [muted, setMutedState] = useState(isMuted());
  const [showAllTeams, setShowAllTeams] = useState(false);
  const [vw, setVw] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  const leftRef = useRef(round.def.seconds);
  const lastTickRef = useRef(round.def.seconds);
  const appliedRef = useRef(false);

  /* track viewport width so the scoreboard can re-flow */
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const roundDone = qIndex >= round.questions.length;
  const question = round.questions[Math.min(qIndex, round.questions.length - 1)];
  const isOpen = question.kind === "open";
  const pointsFor = question.points > 0 ? question.points : round.def.points;
  // per-question timer from the sheet, else the round default
  const secondsFor = question.seconds > 0 ? question.seconds : round.def.seconds;
  // live standings: highest score first, ties broken by seat — re-sorts on every award
  const ordered = [...teams].sort(
    (a, b) => b.total - a.total || a.contestant.seat - b.contestant.seat
  );
  const bySeat = (seat: number) => teams.find((t) => t.contestant.seat === seat);
  const timeUp = left <= 0;

  /**
   * Scoreboard columns scale with how many competitors there are,
   * so chips always fit the screen width without squashing.
   */
  const teamColumns = useMemo(() => {
    const n = Math.max(1, teams.length);
    const perRow = Math.max(1, Math.floor((vw - 32) / 140)); // chips the row can hold
    if (n <= 4) return Math.min(n, vw < 640 ? 2 : 4);
    if (n <= 6) return Math.min(6, vw < 640 ? 2 : vw < 900 ? 3 : 6);
    if (n <= 10) return Math.min(perRow, vw < 640 ? 2 : 5);
    return Math.min(perRow, vw < 640 ? 2 : vw < 900 ? 4 : 6);
  }, [teams.length, vw]);
  // rows the strip will occupy, and whether we need a scroll/expand affordance
  const teamRows = Math.ceil(teams.length / teamColumns);
  const needsOverflow = teamRows > 2;

  /* ---------- timer: runs only while live ---------- */
  useEffect(() => { leftRef.current = left; }, [left]);

  useEffect(() => {
    if (qState !== "live" || roundDone || !running) return;
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
        sfx.timeUp(); // single bell — answer still hidden until host reveals
      }
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qState, qIndex, roundDone, running]);

  useEffect(() => {
    if (roundDone) onRoundDone();
  }, [roundDone, onRoundDone]);

  /* ---------- actions ---------- */
  const reveal = useCallback(() => {
    if (qState !== "hidden") return;
    sfx.advance();
    setQState("live");
  }, [qState]);

  const startTimer = useCallback(() => {
    if (qState !== "live" || running) return;
    sfx.roundStart();
    setRunning(true);
  }, [qState, running]);

  const showAnswer = useCallback(() => {
    if (qState !== "live") return;
    sfx.select();
    setRunning(false);
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
    const nextQ = round.questions[qIndex + 1];
    const nextSeconds = nextQ && nextQ.seconds > 0 ? nextQ.seconds : round.def.seconds;
    setQIndex((i) => i + 1);
    setQState("hidden");
    setAwardSet([]);
    setLeft(nextSeconds);
    leftRef.current = nextSeconds;
    setRunning(timerMode === "auto");
    appliedRef.current = false;
    if (awardSet.length === 0) sfx.advance();
  }, [qState, awardSet, onAward, qIndex, pointsFor, round.def.seconds, round.questions, timerMode]);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (roundDone) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (qState === "hidden") reveal();
        else if (qState === "live") {
          // manual mode inserts a "read it, then start the clock" step
          if (!running) startTimer();
          else showAnswer();
        } else confirmNext();
        return;
      }
      if (qState === "revealed") {
        const n = parseInt(e.key);
        if (n >= 1 && n <= 9) {
          const t = bySeat(n); // hotkeys follow fixed seat numbers, not rank position
          if (t) toggleAward(t.contestant.id);
        } else if (e.key.toLowerCase() === "c") {
          setAwardSet([]);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundDone, qState, reveal, showAnswer, confirmNext, toggleAward, teams, running, startTimer]);

  /* ---------- derived ---------- */
  const frac = left / secondsFor;
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

      {/* team strip — hides while the question is live, returns on reveal */}
      <motion.div
        animate={{
          height: qState === "live" ? 0 : "auto",
          opacity: qState === "live" ? 0 : 1,
          marginTop: qState === "live" ? 0 : 16,
        }}
        transition={{ duration: 0.45, ease }}
        style={{ overflow: "hidden" }}
        className="w-full"
      >
      <div
        className="grid w-full gap-2 px-4 md:px-8"
        style={{
          gridTemplateColumns: `repeat(${teamColumns}, minmax(0, 1fr))`,
          maxHeight: showAllTeams ? undefined : "9.5rem",
          overflowY: showAllTeams ? undefined : "auto",
        }}
      >
        {ordered.map((t) => {
          const inAward = awardSet.includes(t.contestant.id);
          const interactive = qState === "revealed";
          return (
            <motion.button
              key={t.contestant.id}
              layout
              transition={{ duration: 0.55, ease }}
              onClick={() => interactive && toggleAward(t.contestant.id)}
              disabled={!interactive}
              className={cn(
                "glass relative flex items-center gap-2 rounded-xl px-2 py-2 text-left transition md:px-2.5",
                inAward
                  ? "!border-[var(--tc)]"
                  : interactive
                    ? "hover:hl-b hover:hl-strong"
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
              {t.contestant.seat <= 9 && (
                <span className="hidden shrink-0 rounded hl-strong px-1.5 py-0.5 font-mono text-[9px] font-bold text-fog/70 lg:block" title={`Press ${t.contestant.seat} to toggle award`}>
                  {t.contestant.seat}
                </span>
              )}
              <motion.span
                key={t.total}
                initial={{ scale: 1.45, opacity: 0.4 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.35, ease }}
                className="font-mono text-[13px] font-bold tabular-nums md:text-[15px]"
                style={{ color: t.contestant.color }}
              >
                {t.total}
              </motion.span>
              {inAward && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-1.5 -top-1.5 z-20 grid h-5 w-5 place-items-center rounded-full bg-lime text-ink"
                >
                  <Check className="h-3 w-3" strokeWidth={3.5} />
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
        {needsOverflow && (
          <button
            onClick={() => setShowAllTeams((v) => !v)}
            className="mx-auto mt-2 flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 font-mono text-[9px] tracking-[0.2em] text-fog transition hover:hl-b hover:text-paper"
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform", showAllTeams && "rotate-180")} />
            {showAllTeams ? "SHOW FEWER" : `+${teams.length - teamColumns * 2} MORE`}
          </button>
        )}
      </motion.div>

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
              className="glass group flex min-h-[22rem] w-full max-w-7xl flex-col items-center justify-center rounded-3xl transition hover:hl-b md:min-h-[26rem]"
            >
              <span className="font-mono text-[11px] tracking-[0.35em] text-fog md:text-[13px]">
                QUESTION {String(qIndex + 1).padStart(2, "0")}
                <span className="mx-2 hl-text">|</span>
                <span style={{ color: round.def.color }}>{pointsFor} PT{pointsFor > 1 ? "S" : ""} · {secondsFor}S</span>
                {isOpen && <span className="ml-2 text-violet">· OPEN ANSWER</span>}
                {question.image && <span className="ml-2 text-sky">· 🖼 IMAGE</span>}
              </span>
              {question.qtype && (
                <span className="mt-5">
                  <QuestionTypeBadge type={question.qtype} size="md" />
                </span>
              )}
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
                    ? !running
                      ? "READ THE QUESTION — THEN START THE CLOCK"
                      : timeUp ? "TIME'S UP — REVEAL THE ANSWER" : "TEAMS ANSWER NOW"
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
                      {timeUp && qState !== "revealed"
                        ? <Hourglass className="h-5 w-5 md:h-6 md:w-6" />
                        : qState === "revealed"
                          ? <Clock className="h-5 w-5 text-fog md:h-6 md:w-6" />
                          : Math.ceil(left)}
                    </span>
                  </div>
                </div>
              </div>

              {/* question-type badge from the sheet */}
              {question.qtype && (
                <motion.div
                  key={`qtype-${qIndex}`}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, ease }}
                  className="mt-5 md:mt-6"
                >
                  <QuestionTypeBadge type={question.qtype} size="lg" />
                </motion.div>
              )}

              {/* the question — auto-sized to fill the available stage area */}
              <AutoFitText
                key={`q-text-${qIndex}-${qState}`}
                text={question.text}
                min={question.text.length > 260 ? 18 : 22}
                max={160}
                lineHeight={1.06}
                className="mt-4 flex w-full max-w-[92rem] items-center justify-center md:mt-6"
                style={{
                  // long statements / paragraphs get a taller box so they stay readable
                  height:
                    qState === "revealed"
                      ? question.image
                        ? "clamp(3rem, 8vh, 5.5rem)"
                        : question.text.length > 140
                          ? "clamp(5rem, 15vh, 10rem)"
                          : "clamp(4rem, 11vh, 7.5rem)"
                      : question.image
                        ? "clamp(4rem, 12vh, 8rem)" // image takes the spotlight
                        : question.text.length > 260
                          ? "clamp(10rem, 38vh, 30rem)"
                          : question.text.length > 140
                            ? "clamp(9rem, 34vh, 26rem)"
                            : isOpen
                              ? "clamp(9rem, 32vh, 24rem)"
                              : "clamp(8rem, 27vh, 19rem)",
                  transition: "height 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
                textClassName={cn(
                  "type-qa q-text text-center transition-opacity duration-500",
                  qState === "revealed" ? "opacity-60" : "opacity-100"
                )}
              />

              {/* guess-the-image */}
              {question.image && (
                <div className="mt-5 w-full md:mt-6">
                  <QuestionImage src={question.image} alt={`Question ${qIndex + 1} image`} />
                </div>
              )}

              {/* MCQ options — on reveal only the correct one remains, zoomed & centered */}
              {!isOpen && (
                <div
                  className={cn(
                    "mt-8 grid w-full gap-3 md:mt-12 md:gap-4",
                    qState === "revealed"
                      ? "max-w-3xl grid-cols-1 place-items-center"
                      : "max-w-5xl sm:grid-cols-2"
                  )}
                >
                  <AnimatePresence mode="popLayout">
                    {question.options.map((opt, i) => {
                      const revealed = qState === "revealed";
                      // Unresolved answer → no option is marked, but ALL stay visible
                      const unresolved = question.answerIndex < 0;
                      const isCorrect = !unresolved && i === question.answerIndex;
                      if (revealed && !isCorrect && !unresolved) return null;
                      return (
                        <motion.div
                          key={i}
                          layout
                          initial={{ opacity: 0, y: 14 }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            scale: revealed && isCorrect ? 1.12 : 1,
                          }}
                          exit={{ opacity: 0, scale: 0.88, filter: "blur(6px)", transition: { duration: 0.35, ease } }}
                          transition={{
                            duration: revealed ? 0.6 : 0.4,
                            delay: revealed ? 0.12 : 0.12 + i * 0.05,
                            ease,
                          }}
                          className={cn(
                            "relative flex items-center gap-4 rounded-2xl border text-left transition-colors duration-300",
                            revealed && isCorrect
                              ? "glass-col !border-lime/70 w-full justify-center px-8 py-7 shadow-[0_0_70px_rgba(184,255,60,0.35)] md:px-10 md:py-9"
                              : "glass px-5 py-4 md:px-6 md:py-5"
                          )}
                        >
                          {/* check badge — upper-left corner, letter stays intact */}
                          {revealed && isCorrect && (
                            <motion.span
                              initial={{ scale: 0, rotate: -40 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ duration: 0.45, delay: 0.45, ease }}
                              className="absolute -left-3 -top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-lime text-ink shadow-[0_0_24px_rgba(184,255,60,0.7)] md:-left-4 md:-top-4 md:h-11 md:w-11"
                            >
                              <Check className="h-5 w-5 md:h-6 md:w-6" strokeWidth={3.5} />
                            </motion.span>
                          )}
                          <span
                            className={cn(
                              "grid shrink-0 place-items-center rounded-lg font-mono font-bold transition-all",
                              revealed && isCorrect
                                ? "h-12 w-12 bg-lime text-ink text-xl md:h-14 md:w-14 md:text-2xl"
                                : "h-10 w-10 hl-soft text-fog text-base md:h-12 md:w-12 md:text-lg"
                            )}
                          >
                            {LETTERS[i]}
                          </span>
                          <span
                            className={cn("type-qa leading-snug", revealed && isCorrect ? "text-paper" : "text-paper/75")}
                            style={{
                              fontSize: revealed && isCorrect
                                ? "clamp(1.5rem, 3vw, 2.5rem)"
                                : "clamp(1rem, 1.8vw, 1.45rem)",
                            }}
                          >
                            {opt}
                          </span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
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

              {/* start-the-clock (manual mode) */}
              {qState === "live" && !running && (
                <motion.button
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.3, ease }}
                  onClick={startTimer}
                  className="sheen group mt-10 flex items-center gap-3 rounded-2xl bg-sky px-10 py-5 font-mono text-sm font-bold tracking-[0.2em] text-ink shadow-[0_0_50px_rgba(92,210,255,0.35)] transition active:scale-[0.98] md:mt-14 md:text-base"
                >
                  <PlayCircle className="h-5 w-5 transition-transform group-hover:scale-110" />
                  START {secondsFor}s TIMER
                </motion.button>
              )}

              {/* reveal answer button */}
              {qState === "live" && running && (
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
                  {(isOpen || question.answerUnresolved) && (
                    <div
                      className="glass-col !border-lime/40 w-full max-w-4xl rounded-3xl px-6 py-7 md:py-9"
                      style={{ fontFamily: "var(--font-sans)" }}
                    >
                      <p className="font-mono text-[11px] tracking-[0.4em] text-fog md:text-[12px]">
                        {question.answerText ? "THE ANSWER IS" : "NO ANSWER IN THE SHEET"}
                      </p>
                      {question.answerText ? (
                        <AutoFitText
                          text={question.answerText}
                          min={24}
                          max={120}
                          lineHeight={1.04}
                          className="mt-4 flex w-full items-center justify-center"
                          style={{ height: "clamp(4.5rem, 16vh, 9rem)" }}
                          textClassName="type-qa text-center text-lime"
                        />
                      ) : (
                        <p className="mt-4 text-center font-mono text-[13px] tracking-[0.2em] text-fog">
                          HOST DECIDES · AWARD POINTS BELOW
                        </p>
                      )}
                      {question.answerUnresolved && (
                        <p className="mt-4 text-center font-mono text-[10px] leading-relaxed tracking-[0.15em] text-amber">
                          SHOWN EXACTLY AS WRITTEN — DIDN’T MATCH AN OPTION
                        </p>
                      )}
                    </div>
                  )}
                  {question.explanation && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.15, ease }}
                      className="glass mt-5 w-full max-w-4xl rounded-2xl px-5 py-4 text-left md:px-6 md:py-5"
                    >
                      <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-amber">
                        <Lightbulb className="h-3.5 w-3.5" />
                        EXPLANATION
                      </p>
                      <p
                        className="mt-2 max-h-[22vh] overflow-y-auto leading-relaxed text-paper/90"
                        style={{
                          fontSize: "clamp(0.95rem, 1.5vw, 1.25rem)",
                          whiteSpace: "pre-line",
                        }}
                      >
                        {question.explanation}
                      </p>
                    </motion.div>
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
                              inAward ? "text-ink" : "border-line text-fog hover:hl-b hover:text-paper"
                            )}
                            style={inAward ? { background: t.contestant.color, borderColor: t.contestant.color } : undefined}
                          >
                            {inAward && <Check className="h-4 w-4" strokeWidth={3} />}
                            {t.contestant.name}
                            <span className={cn("tabular-nums", inAward ? "opacity-70" : "text-fog/60")}>
                              {t.total}
                            </span>
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
