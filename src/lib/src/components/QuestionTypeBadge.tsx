import { parseQType, TONE_VAR } from "../lib/qtypes";
import { cn } from "../utils/cn";

interface Props {
  /** raw value from the sheet's "Type of Question" column */
  type?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "text-[9px] px-2 py-1 tracking-[0.18em]",
  md: "text-[11px] px-3 py-1.5 tracking-[0.2em]",
  lg: "text-[13px] px-4 py-2 tracking-[0.2em]",
};

/** Badge showing the question format, e.g. TRUE OR FALSE / IDENTIFICATION. */
export default function QuestionTypeBadge({ type, size = "md", className }: Props) {
  const info = parseQType(type);
  if (!info) return null;
  const v = TONE_VAR[info.tone];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-mono font-bold uppercase",
        SIZES[size],
        className
      )}
      style={{
        background: `color-mix(in srgb, var(${v}) 16%, transparent)`,
        color: `var(${v})`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(${v}) 45%, transparent)`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: `var(${v})`, boxShadow: `0 0 8px var(${v})` }}
      />
      {info.label}
    </span>
  );
}
