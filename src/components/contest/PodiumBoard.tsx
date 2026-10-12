import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Crown, TrendingUp, ArrowRight, RotateCcw, ArrowLeftRight, Users,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { TeamScore, QuizRound } from "../../lib/types";
import { fireConfetti } from "../../lib/confetti";
import { sfx } from "../../lib/sound";
import RankBadge from "../RankBadge";

const ease = [0.22, 1, 0.36, 1] as const;

interface Props {
  standings: TeamScore[];
  rounds: QuizRound[];
  final: boolean;
  playedRounds: number;
  onNextRound?: () => void;
  onReplay?: () => void;
  onNewSheet?: () => void;
  onEditRoster?: () => void;
}

const ordinal = (n: number) => (n === 1 ? "1ST" : n === 2 ? "2ND" : n === 3 ? "3RD" : `${n}TH`);

export default function PodiumBoard({ standings, rounds, final, playedRounds, onNextRound, onReplay, onNewSheet, onEditRoster }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maxPts = Math.max(...standings.map((s) => s.total), 1);
  const champion = standings[0];

  useEffect(() => {
    if (final && canvasRef.current) {
      sfx.fanfare();
      const cancel = fireConfetti(canvasRef.current, 240);
      const t2 = setTimeout(() => canvasRef.current && fireConfetti(canvasRef.current, 140), 1000);
      return () => { cancel(); clearTimeout(t2); };
    }
  }, [final]);

  const podiumGroups = [1, 2, 3]
    .map((r) => standings.filter((s) => s.rank === r))
    .filter((g) => g.length > 0);

  return (
    <div className="relative flex min-h-screen flex-col items-center px-6 py-16">
      {final && <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-40 h-full w-full" />}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease }}
        className="flex items-center gap-2 rounded-full border border-amber/30 bg-amber/5 px-4 py-1.5 font-mono text-[11px] tracking-[0.25em] text-amber"
      >
        <TrendingUp className="h-3.5 w-3.5" />
        {final ? "COMPETITION COMPLETE" : "STANDINGS UPDATE"}
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1, ease }}
        className="mt-6 text-center font-display text-4xl font-extrabold tracking-tight md:text-6xl"
        style={{ fontWeight: 800 }}
      >
        {final ? (
          <>
            <Crown className="mr-3 inline h-9 w-9 -translate-y-1 text-amber md:h-12 md:w-12" />
            <span style={{ color: champion?.contestant.color, textShadow: `0 0 70px ${champion?.contestant.glow}` }}>
              {champion?.contestant.name.toUpperCase()}
            </span>
          </>
        ) : (
          <>CURRENT <span className="text-amber">STANDINGS</span></>
        )}
      </motion.h1>
      {final && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-3 font-mono text-[11px] tracking-[0.5em] text-amber"
        >
          QUIZ BEE CHAMPION{standings.filter((s) => s.rank === 1).length > 1 ? "S (TIE)" : ""}
        </motion.p>
      )}

      {/* podium bars */}
      <div className="mt-12 flex w-full max-w-3xl items-end justify-center gap-3 md:gap-6">
        {podiumGroups.map((group, gi) => {
          const rank = group[0].rank;
          const heights = ["h-44 md:h-60", "h-32 md:h-44", "h-24 md:h-32"];
          return (
            <motion.div
              key={rank}
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.25 + gi * 0.15, ease }}
              className="flex w-full max-w-52 flex-col items-center"
            >
              <RankBadge rank={rank} size="lg" />
              <div className="mt-4 text-center">
                {group.map((s) => (
                  <p
                    key={s.contestant.id}
                    className="truncate font-display text-base font-bold md:text-xl"
                    style={{ color: s.contestant.color, fontSize: "clamp(0.95rem, 1.8vw, 1.35rem)" }}
                  >
                    {s.contestant.name}
                  </p>
                ))}
                <p className="mt-2 font-mono text-sm font-bold tabular-nums text-paper md:text-base">
                  {group[0].total}
                  <span className="text-fog/60"> PTS</span>
                </p>
              </div>
              <div
                className={cn("mt-3 w-full rounded-t-xl border border-b-0 border-line bg-gradient-to-b to-transparent", heights[gi] ?? "h-16")}
                style={{ backgroundImage: `linear-gradient(to bottom, ${group[0].contestant.color}33, transparent)` }}
              >
                <div className="glass-col flex h-full flex-col items-center justify-start pt-4">
                  <span className={cn("font-display text-2xl font-extrabold md:text-3xl", rank > 3 ? "text-outline" : "")} style={rank <= 3 ? { color: group[0].contestant.color, textShadow: `0 0 24px ${group[0].contestant.glow}`, fontWeight: 800 } : { fontWeight: 800 }}>
                    {ordinal(rank)}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* full classification table */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease }}
        className="glass mt-10 w-full max-w-5xl overflow-x-auto rounded-3xl"
      >
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="border-b border-line font-mono text-[10px] tracking-[0.25em] text-fog">
              <th className="px-5 py-3.5 font-medium">RK</th>
              <th className="px-3 py-3.5 font-medium">TEAM</th>
              {rounds.slice(0, playedRounds).map((r) => (
                <th key={r.def.key} className="px-3 py-3.5 text-center font-medium" style={{ color: r.def.color }}>
                  {r.def.label.toUpperCase().slice(0, 5)}
                </th>
              ))}
              <th className="px-5 py-3.5 text-right font-medium">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <motion.tr
                key={s.contestant.id}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.6 + i * 0.07, ease }}
                className={cn("border-b border-line/50 last:border-0", s.rank === 1 && "bg-white/[0.02]")}
              >
                <td className="px-5 py-3.5">
                  <RankBadge rank={s.rank} size="sm" />
                </td>
                <td className="px-3 py-3.5">
                  <span className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.contestant.color, boxShadow: `0 0 8px ${s.contestant.glow}` }} />
                    <span className="truncate text-[14px] font-semibold text-paper md:text-[15px]">{s.contestant.name}</span>
                    {s.rank === 1 && <Crown className="h-4 w-4 shrink-0 text-amber" />}
                  </span>
                </td>
                {s.perRound.slice(0, playedRounds).map((p, ri) => (
                  <td key={ri} className="px-3 py-3.5 text-center font-mono text-[12px] tabular-nums text-fog">
                    {p}
                  </td>
                ))}
                <td className="px-5 py-3.5 text-right font-mono text-[14px] font-bold tabular-nums" style={{ color: s.contestant.color }}>
                  {s.total}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {/* visual bars */}
        <div className="space-y-2.5 border-t border-line px-5 py-5">
          {standings.map((s, i) => (
            <motion.div key={s.contestant.id} className="flex items-center gap-3">
              <span className="w-24 truncate text-right font-mono text-[10px] text-fog">{s.contestant.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(s.total / maxPts) * 100}%` }}
                  transition={{ duration: 1, delay: 0.7 + i * 0.08, ease }}
                  className="h-full rounded-full"
                  style={{ background: s.contestant.color, boxShadow: `0 0 10px ${s.contestant.glow}` }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.8, ease }}
        className="mt-12 flex flex-col items-center gap-4 sm:flex-row"
      >
        {!final && onNextRound && (
          <button
            onClick={onNextRound}
            className="sheen group flex items-center gap-3 rounded-xl bg-amber px-10 py-5 font-mono text-sm font-bold tracking-[0.2em] text-ink transition hover:shadow-[0_0_50px_rgba(255,184,77,0.4)] active:scale-[0.98]"
          >
            NEXT ROUND
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        )}
        {final && onReplay && (
          <button
            onClick={onReplay}
            className="sheen group flex items-center gap-3 rounded-xl bg-lime px-10 py-5 font-mono text-sm font-bold tracking-[0.2em] text-ink transition hover:shadow-[0_0_50px_rgba(184,255,60,0.35)] active:scale-[0.98]"
          >
            <RotateCcw className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-180" />
            REMATCH
          </button>
        )}
        {final && onEditRoster && (
          <button
            onClick={onEditRoster}
            className="flex items-center gap-2 rounded-xl border border-line px-8 py-5 font-mono text-[12px] tracking-[0.2em] text-fog transition hover:border-sky/50 hover:text-paper"
          >
            <Users className="h-4 w-4" />
            EDIT ROSTER
          </button>
        )}
        {onNewSheet && (
          <button
            onClick={onNewSheet}
            className="flex items-center gap-2 rounded-xl border border-line px-8 py-5 font-mono text-[12px] tracking-[0.2em] text-fog transition hover:border-rose/40 hover:text-paper"
          >
            <ArrowLeftRight className="h-4 w-4" />
            NEW SHEET
          </button>
        )}
      </motion.div>
    </div>
  );
}
