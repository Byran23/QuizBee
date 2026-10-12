import { Crown } from "lucide-react";
import { cn } from "../utils/cn";

const MEDALS: Record<number, { bg: string; text: string; glow: string; ring: string }> = {
  1: { bg: "linear-gradient(135deg,#FFEDB0,#F7BC3A 55%,#C97E1F)", text: "#2A1C05", glow: "rgba(255,209,102,0.55)", ring: "rgba(255,236,180,0.8)" },
  2: { bg: "linear-gradient(135deg,#FAFBFD,#C6CEDA 55%,#8E99A8)", text: "#20252E", glow: "rgba(220,228,240,0.45)", ring: "rgba(245,247,250,0.7)" },
  3: { bg: "linear-gradient(135deg,#F6C9A0,#CE8B52 55%,#96602F)", text: "#2B1607", glow: "rgba(228,170,112,0.5)", ring: "rgba(244,198,150,0.7)" },
};

interface Props {
  rank: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const DIMS = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-[12px]",
  lg: "h-12 w-12 text-base",
};

export default function RankBadge({ rank, size = "md", className }: Props) {
  const s = MEDALS[rank];
  const dim = DIMS[size];

  if (!s) {
    return (
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full border border-line bg-white/5 font-mono font-bold text-fog",
          dim, className
        )}
      >
        {rank}
      </span>
    );
  }

  return (
    <span className={cn("relative inline-grid shrink-0", className)}>
      {rank === 1 && size !== "sm" && (
        <Crown
          className="absolute -top-3 left-1/2 z-10 h-4 w-4 -translate-x-1/2 text-[#FFD166]"
          style={{ filter: "drop-shadow(0 0 6px rgba(255,209,102,0.8))" }}
          strokeWidth={2.2}
          fill="#FFD166"
        />
      )}
      <span
        className={cn(
          "grid place-items-center rounded-full font-mono font-bold",
          dim
        )}
        style={{
          background: s.bg,
          color: s.text,
          boxShadow: `0 0 0 2px ${s.ring}, 0 2px 10px rgba(0,0,0,0.45), 0 0 18px ${s.glow}`,
        }}
      >
        {rank}
      </span>
    </span>
  );
}
