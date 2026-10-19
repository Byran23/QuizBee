/**
 * Question-type labels come from the sheet's "Type of Question" column
 * and are shown as a badge beside the question.
 */

export type QTone = "amber" | "sky" | "violet" | "lime" | "rose" | "fog";

export interface QTypeInfo {
  /** text shown in the badge */
  label: string;
  tone: QTone;
  /** true when the type means a True/False item */
  isTrueFalse: boolean;
}

const RULES: { re: RegExp; label: string; tone: QTone; tf?: boolean }[] = [
  { re: /true\s*(?:or|\/|,|-)?\s*false|^\s*t\s*\/\s*f\s*$|tama\s*(?:o|\/)\s*mali|totoo\s*(?:o|\/)\s*mali/i, label: "True or False", tone: "amber", tf: true },
  { re: /fill[-\s]*in[-\s]*the[-\s]*blanks?|fill[-\s]*in|punan\s+ang\s+patlang|blanks?/i, label: "Fill in the Blanks", tone: "sky" },
  { re: /identification|identify|pagkilala/i, label: "Identification", tone: "violet" },
  { re: /multiple\s*choice|mcq?$|^\s*mc\s*$/i, label: "Multiple Choice", tone: "sky" },
  { re: /enumerations?|enumerate/i, label: "Enumeration", tone: "lime" },
  { re: /matching(\s*type)?|match\s+the/i, label: "Matching Type", tone: "rose" },
  { re: /problem\s*solving|computation|solve|math/i, label: "Problem Solving", tone: "lime" },
  { re: /essay|explain|discussion/i, label: "Essay", tone: "violet" },
  { re: /picture|image|photo|visual/i, label: "Picture Round", tone: "sky" },
  { re: /audio|sound|music/i, label: "Audio Round", tone: "rose" },
];

/** Title-case an unrecognised label so it still reads well in the badge. */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase()))
    .join(" ");
}

/** Normalize a raw "Type of Question" cell. Blank → null (no badge). */
export function parseQType(raw: string | undefined): QTypeInfo | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  for (const r of RULES) {
    if (r.re.test(s)) return { label: r.label, tone: r.tone, isTrueFalse: Boolean(r.tf) };
  }
  // unknown but present — show it as typed
  return { label: titleCase(s).slice(0, 28), tone: "fog", isTrueFalse: false };
}

/** True when the type column marks this as a True/False item. */
export function typeIsTrueFalse(raw: string | undefined): boolean {
  return parseQType(raw)?.isTrueFalse ?? false;
}

export const TONE_VAR: Record<QTone, string> = {
  amber: "--color-amber",
  sky: "--color-sky",
  violet: "--color-violet",
  lime: "--color-lime",
  rose: "--color-rose",
  fog: "--color-fog",
};
