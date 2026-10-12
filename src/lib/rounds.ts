import { Question, QuizRound, RoundDef } from "./types";

type RoundBase = Omit<RoundDef, "key" | "label" | "order"> & { order: number };

export const ROUND_LIBRARY: Record<string, RoundBase> = {
  easy: { points: 1, seconds: 15, color: "#B8FF3C", glow: "rgba(184,255,60,0.35)", order: 1 },
  average: { points: 2, seconds: 20, color: "#5CD2FF", glow: "rgba(92,210,255,0.35)", order: 2 },
  difficult: { points: 3, seconds: 25, color: "#FFB84D", glow: "rgba(255,184,77,0.35)", order: 3 },
  clincher: { points: 5, seconds: 30, color: "#FF5C8A", glow: "rgba(255,92,138,0.4)", order: 4 },
};

const ORDER_KEYS = Object.keys(ROUND_LIBRARY);

function classifyRound(raw: string, appearanceIndex: number): RoundDef {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) {
    const base = ROUND_LIBRARY.easy;
    return { key: "general", label: "General Round", points: base.points, seconds: base.seconds, color: base.color, glow: base.glow, order: 1 };
  }
  // direct / fuzzy match against known round names
  for (const key of ORDER_KEYS) {
    if (cleaned.includes(key)) {
      const base = ROUND_LIBRARY[key];
      return { key, label: cap(cleaned), points: base.points, seconds: base.seconds, color: base.color, glow: base.glow, order: base.order };
    }
  }
  // "round 1", "level 2", "stage 3" ...
  const num = cleaned.match(/(?:round|r|level|lvl|stage)[\s-]*(\d+)/)?.[1];
  if (num) {
    const idx = Math.min(Math.max(parseInt(num), 1), 4);
    const key = ["easy", "average", "difficult", "clincher"][idx - 1];
    const base = ROUND_LIBRARY[key];
    return { key: `${key}-${num}`, label: cap(cleaned), points: base.points, seconds: base.seconds, color: base.color, glow: base.glow, order: idx };
  }
  // unknown round names get a consistent identity by order of appearance
  const base = ROUND_LIBRARY[ORDER_KEYS[Math.min(appearanceIndex, ORDER_KEYS.length - 1)]];
  return { key: cleaned, label: cap(cleaned), points: base.points, seconds: base.seconds, color: base.color, glow: base.glow, order: 10 + appearanceIndex };
}

const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** Group questions into ordered round blocks. */
export function buildRounds(questions: Question[]): QuizRound[] {
  const defs = new Map<string, RoundDef>();
  let appearance = 0;

  for (const q of questions) {
    const normKey = q.round.trim().toLowerCase() || "general";
    if (!defs.has(normKey)) {
      defs.set(normKey, classifyRound(q.round, appearance));
      appearance++;
    }
  }

  const map = new Map<string, QuizRound>();
  for (const q of questions) {
    const nk = q.round.trim().toLowerCase() || "general";
    if (!map.has(nk)) map.set(nk, { def: defs.get(nk)!, questions: [] });
    map.get(nk)!.questions.push(q);
  }

  const rounds = [...map.values()].sort((a, b) => a.def.order - b.def.order);
  rounds.forEach((r, i) => (r.def = { ...r.def, order: i + 1 }));
  return rounds;
}
