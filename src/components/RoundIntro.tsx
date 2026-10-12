import { useEffect } from "react";
import { motion } from "framer-motion";
import { Timer, Target } from "lucide-react";
import { RoundDef } from "../lib/types";

const ease = [0.22, 1, 0.36, 1] as const;

interface Props {
  round: RoundDef;
  count: number;
  total: number;
  onDone: () => void;
}

export default function RoundIntro({ round, count, total, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      onClick={onDone}
      className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-ink/95 backdrop-blur-xl"
    >
      {/* radial accent wash */}
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.18 }}
        transition={{ duration: 1, ease }}
        className="absolute h-[42rem] w-[42rem] rounded-full blur-[100px]"
        style={{ background: round.color }}
      />
      {/* ring burst */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ scale: 0.2, opacity: 0.5 }}
          animate={{ scale: 2.4 + i * 0.8, opacity: 0 }}
          transition={{ duration: 2, delay: 0.2 + i * 0.25, ease: "easeOut" }}
          className="absolute h-72 w-72 rounded-full border"
          style={{ borderColor: round.color }}
        />
      ))}

      <div className="relative flex flex-col items-center px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 24, letterSpacing: "0.6em" }}
          animate={{ opacity: 1, y: 0, letterSpacing: "0.4em" }}
          transition={{ duration: 0.7, ease }}
          className="font-mono text-xs font-semibold text-fog"
        >
          ROUND {round.order} OF {total}
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, scale: 0.8, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.12, ease }}
          className="mt-4 font-display text-5xl font-extrabold tracking-tight md:text-8xl"
          style={{ color: round.color, textShadow: `0 0 60px ${round.glow}`, fontWeight: 800 }}
        >
          {round.label.toUpperCase()}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease }}
          className="mt-8 flex items-center gap-3 font-mono text-[11px] tracking-[0.2em] text-fog"
        >
          <span className="flex items-center gap-2 rounded-full border border-line bg-panel/70 px-4 py-2">
            <Target className="h-3.5 w-3.5" style={{ color: round.color }} />
            {round.points} PT{round.points > 1 ? "S" : ""} EACH
          </span>
          <span className="flex items-center gap-2 rounded-full border border-line bg-panel/70 px-4 py-2">
            <Timer className="h-3.5 w-3.5" style={{ color: round.color }} />
            {round.seconds}S CLOCK
          </span>
          <span className="hidden items-center gap-2 rounded-full border border-line bg-panel/70 px-4 py-2 sm:flex">
            {count} QUESTION{count !== 1 ? "S" : ""}
          </span>
        </motion.div>
      </div>

      {/* bottom progress shimmer */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 2.6, ease: "linear" }}
        className="absolute bottom-0 left-0 h-[3px] w-full origin-left"
        style={{ background: round.color }}
      />
    </motion.div>
  );
}
