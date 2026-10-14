import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, Trash2, Swords, ArrowLeft, Keyboard, ListChecks, Trophy, Timer } from "lucide-react";
import { cn } from "../../utils/cn";
import { QuizData, Contestant } from "../../lib/types";
import { TEAM_PALETTE, MAX_TEAMS, makeContestant, loadTeams, saveTeams } from "../../lib/contestants";

const ease = [0.22, 1, 0.36, 1] as const;

interface Props {
  data: QuizData;
  onBegin: (teams: Contestant[]) => void;
  onBack: () => void;
}

interface Row {
  name: string;
  colorIdx: number;
}

const DEFAULT_NAMES = ["Team Alpha", "Team Bravo", "Team Charlie", "Team Delta"];

export default function ContestantsSetup({ data, onBegin, onBack }: Props) {
  const [rows, setRows] = useState<Row[]>(() => {
    const saved = loadTeams().filter((r) => r.name.trim());
    if (saved.length >= 2) return saved;
    return DEFAULT_NAMES.map((name, i) => ({ name, colorIdx: i }));
  });

  const validRows = rows.filter((r) => r.name.trim().length > 0);
  const canBegin = validRows.length >= 2;

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const addRow = () => {
    if (rows.length >= MAX_TEAMS) return;
    const usedIdx = new Set(rows.map((r) => r.colorIdx));
    const free = TEAM_PALETTE.findIndex((_, i) => !usedIdx.has(i));
    setRows((rs) => [...rs, { name: "", colorIdx: free >= 0 ? free : rs.length % TEAM_PALETTE.length }]);
  };

  const removeRow = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  const begin = () => {
    if (!canBegin) return;
    saveTeams(rows);
    onBegin(validRows.map((r, i) => makeContestant(r.name.trim(), r.colorIdx ?? i, i + 1)));
  };

  const mins = Math.round(data.estimatedSeconds / 60);

  return (
    <div className="relative flex min-h-screen flex-col items-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease }}
        className="flex items-center gap-2 rounded-full border border-sky/30 bg-sky/5 px-4 py-1.5 font-mono text-[11px] tracking-[0.25em] text-sky"
      >
        <Swords className="h-3.5 w-3.5" />
        COMPETITION MODE
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.08, ease }}
        className="mt-6 text-center font-display text-4xl font-extrabold tracking-tight md:text-6xl"
        style={{ fontWeight: 800 }}
      >
        WHO&apos;S <span className="text-sky">COMPETING?</span>
      </motion.h1>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="mt-4 flex flex-wrap justify-center gap-3 font-mono text-[11px] tracking-wider text-fog"
      >
        <span className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5">
          <ListChecks className="h-3 w-3 text-lime" /> {data.totalQuestions} QUESTIONS
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5">
          <Trophy className="h-3 w-3 text-amber" /> {data.totalPoints} PTS
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5">
          <Timer className="h-3 w-3 text-sky" /> ~{mins} MIN
        </span>
      </motion.div>

      {/* roster */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease }}
        className="glass mt-12 w-full max-w-2xl rounded-3xl p-6 md:p-8"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.25em] text-fog">
            <Users className="h-4 w-4 text-sky" />
            ROSTER · <span className={cn("tabular-nums", canBegin ? "text-lime" : "text-amber")}>{validRows.length}/{MAX_TEAMS}</span>
          </span>
          <span className="font-mono text-[10px] tracking-wider text-fog/60">MIN 2 TEAMS</span>
        </div>

        <div className="mt-5 space-y-2.5">
          <AnimatePresence initial={false}>
            {rows.map((row, i) => {
              const p = TEAM_PALETTE[row.colorIdx % TEAM_PALETTE.length];
              return (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
                  transition={{ duration: 0.35, ease, delay: i * 0.05 }}
                  className="glass group flex items-center gap-3 rounded-xl p-2.5 pl-3.5 transition focus-within:hl-b"
                >
                  <span className="font-mono text-[11px] font-bold text-fog/60 tabular-nums">{i + 1}</span>
                  <button
                    onClick={() => update(i, { colorIdx: (row.colorIdx + 1) % TEAM_PALETTE.length })}
                    title="Cycle team color"
                    className="h-8 w-8 shrink-0 rounded-lg transition hover:scale-110 active:scale-95"
                    style={{ background: p.color, boxShadow: `0 0 16px ${p.glow}` }}
                  />
                  <input
                    value={row.name}
                    onChange={(e) => update(i, { name: e.target.value.slice(0, 24) })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (i === rows.length - 1 && rows.length < MAX_TEAMS) addRow();
                      }
                    }}
                    placeholder={`Contestant / team name…`}
                    className="min-w-0 flex-1 bg-transparent font-mono text-[14px] font-medium text-paper placeholder:text-fog/40"
                  />
                  {i < 9 && (
                    <span
                      className="hidden shrink-0 rounded px-2 py-1 font-mono text-[9px] tracking-[0.2em] sm:block"
                      style={{ color: p.color, background: `${p.color}14` }}
                    >
                      KEY {i + 1}
                    </span>
                  )}
                  <button
                    onClick={() => removeRow(i)}
                    disabled={rows.length <= 2}
                    title="Remove team"
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fog transition hover:bg-rose/10 hover:text-rose",
                      rows.length <= 2 && "cursor-not-allowed opacity-30 hover:bg-transparent hover:text-fog"
                    )}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <button
          onClick={addRow}
          disabled={rows.length >= MAX_TEAMS}
          className={cn(
            "mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3.5 font-mono text-[11px] tracking-[0.2em] text-fog transition",
            rows.length < MAX_TEAMS ? "hover:border-sky/50 hover:text-paper" : "cursor-not-allowed opacity-40"
          )}
        >
          <Plus className="h-4 w-4" />
          ADD TEAM {rows.length < MAX_TEAMS ? `(${MAX_TEAMS - rows.length} SLOTS LEFT)` : "(FULL)"}
        </button>

        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-line/70 hl-strong px-4 py-3">
          <Keyboard className="mt-0.5 h-4 w-4 shrink-0 text-fog" />
          <p className="text-[12px] leading-relaxed text-fog">
            Up to <span className="text-paper">{MAX_TEAMS} teams</span>. Host controls during play —{" "}
            <span className="text-paper">Space</span> reveals the question, then the answer after the countdown.{" "}
            <span className="text-paper">Keys 1–9</span> (or taps anywhere) award points to the teams that got it right.{" "}
            <span className="text-paper">F</span> toggles fullscreen for projection.
          </p>
        </div>
      </motion.div>

      {/* ctas */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.4, ease }}
        className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
      >
        <button
          onClick={begin}
          disabled={!canBegin}
          className={cn(
            "sheen group flex items-center gap-3 rounded-xl px-10 py-5 font-mono text-sm font-bold tracking-[0.2em] transition active:scale-[0.98]",
            canBegin
              ? "bg-sky text-ink hover:shadow-[0_0_50px_rgba(92,210,255,0.4)]"
              : "cursor-not-allowed bg-panel-2 text-fog"
          )}
        >
          <Swords className="h-4 w-4 transition-transform group-hover:rotate-12" />
          START COMPETITION
        </button>
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl border border-line px-8 py-5 font-mono text-[12px] tracking-[0.2em] text-fog transition hover:border-rose/40 hover:text-paper"
        >
          <ArrowLeft className="h-4 w-4" />
          BACK
        </button>
      </motion.div>
    </div>
  );
}
