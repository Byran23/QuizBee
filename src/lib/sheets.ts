import { Question, QuizData, FetchResult } from "./types";
import { buildRounds } from "./rounds";

/* ------------------------------------------------------------------ */
/*  URL parsing                                                        */
/* ------------------------------------------------------------------ */

export interface SheetRef {
  id: string;
  gid: string | null;
}

export function parseSheetInput(input: string): SheetRef | null {
  const raw = input.trim();
  if (!raw) return null;
  // full URL
  const urlMatch = raw.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) {
    const gid = raw.match(/[#?&]gid=(\d+)/)?.[1] ?? null;
    return { id: urlMatch[1], gid };
  }
  // bare ID
  if (/^[a-zA-Z0-9-_]{20,}$/.test(raw)) return { id: raw, gid: null };
  return null;
}

/* ------------------------------------------------------------------ */
/*  Fetching (gviz CSV first, opensheet JSON fallback)                 */
/* ------------------------------------------------------------------ */

async function fetchWithTimeout(url: string, ms = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchCsv(ref: SheetRef, tab?: string): Promise<string> {
  let url = `https://docs.google.com/spreadsheets/d/${ref.id}/gviz/tq?tqx=out:csv`;
  if (tab?.trim()) url += `&sheet=${encodeURIComponent(tab.trim())}`;
  else if (ref.gid) url += `&gid=${ref.gid}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Google returned ${res.status}`);
  const text = await res.text();
  if (/^\s*<!doctype html/i.test(text) || text.includes("accounts.google.com"))
    throw new Error("Sheet is private");
  return text;
}

async function fetchJson(ref: SheetRef, tab?: string): Promise<Record<string, string>[]> {
  const tabName = tab?.trim() || "1";
  const url = `https://opensheet.elk.sh/${ref.id}/${encodeURIComponent(tabName)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Fallback returned ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error("Unexpected response");
  return json;
}

/** Main entry: fetch a sheet and normalize into QuizData */
export async function fetchQuizFromSheet(ref: SheetRef, tab?: string): Promise<FetchResult> {
  let csvError: string | null = null;
  try {
    const csv = await fetchCsv(ref, tab);
    const rows = parseCsv(csv);
    if (rows.length < 2) throw new Error("Sheet appears to be empty");
    const data = normalizeRows(rows, "Google Sheet");
    return { data, via: "csv" };
  } catch (e) {
    csvError = e instanceof Error ? e.message : String(e);
    if (csvError === "Sheet is private") {
      throw new SheetFetchError(
        "This sheet is private. Share it as “Anyone with the link · Viewer”, then try again."
      );
    }
  }
  // JSON fallback
  try {
    const json = await fetchJson(ref, tab);
    if (json.length === 0) throw new Error("Sheet appears to be empty");
    const data = normalizeObjects(json, "Google Sheet");
    return { data, via: "json" };
  } catch {
    throw new SheetFetchError(
      "Couldn’t read that sheet. Make sure the link is correct and the sheet is shared publicly (“Anyone with the link · Viewer”)."
    );
  }
}

export class SheetFetchError extends Error {}

/* ------------------------------------------------------------------ */
/*  CSV parsing (RFC-4180-ish)                                         */
/* ------------------------------------------------------------------ */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/* ------------------------------------------------------------------ */
/*  Normalization                                                      */
/* ------------------------------------------------------------------ */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const MATCHERS = {
  question: /^(q|question|questiontext|prompt|item|query)$/i,
  answer: /^(answer|correct|correctanswer|correctoption|key|ans|solution)$/i,
  round: /^(round|difficulty|level|category|type|stage|group|section)$/i,
  points: /^(points|pts|score|value|weight)$/i,
  explanation: /^(explanation|why|explain|solutiontext|note|notes|rationale|hint)$/i,
  optionsCombined: /^(options|choices|choiceslist)$/i,
  optionIndexed: /^([a-f])$/i,
  optionLong: /^(option|choice|choice|opt|a)([a-f]|[1-6])$/i,
};

function letterColIndex(header: string): number | null {
  const h = norm(header);
  // "optiona" "option1" "choiceb" "opta" "a"
  const m1 = h.match(/^(?:option|choice|opt)([a-f])$/);
  if (m1) return m1[1].charCodeAt(0) - 97;
  const m2 = h.match(/^(?:option|choice|opt)([1-6])$/);
  if (m2) return parseInt(m2[1]) - 1;
  const m3 = h.match(/^([a-f])$/);
  if (m3) return m3[1].charCodeAt(0) - 97;
  return null;
}

function resolveAnswerIndex(raw: string, options: string[]): number {
  const a = raw.trim();
  // letter  "B"  / "b"  / "B)" / "B."
  const lm = a.match(/^([A-Fa-f])[).:;]?\s*$/);
  if (lm) {
    const idx = lm[1].toUpperCase().charCodeAt(0) - 65;
    if (idx < options.length) return idx;
  }
  // number "1"-"6"
  const nm = a.match(/^([1-6])\)?\s*$/);
  if (nm) {
    const idx = parseInt(nm[1]) - 1;
    if (idx < options.length) return idx;
  }
  // strip leading letter prefix "B) Some text"
  const prefixed = a.match(/^([A-Fa-f])[).:;]\s+(.+)$/);
  if (prefixed) {
    const idx = prefixed[1].toUpperCase().charCodeAt(0) - 65;
    if (options[idx] && normSimilar(options[idx], prefixed[2])) return idx;
  }
  // exact-ish text match
  const clean = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const ci = options.findIndex((o) => clean(o) === clean(a));
  if (ci >= 0) return ci;
  const fi = options.findIndex((o) => clean(o).includes(clean(a)) || clean(a).includes(clean(o)));
  if (fi >= 0 && clean(a).length > 2) return fi;
  return -1;
}

function normSimilar(a: string, b: string): boolean {
  const clean = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return clean(a) === clean(b);
}

interface RawRow {
  question: string;
  options: string[];
  answerRaw: string;
  round: string;
  points: number | null;
  explanation: string;
}

export function normalizeRows(rows: string[][], sourceLabel: string): QuizData {
  const header = rows[0].map((h) => norm(h));
  const col: Record<string, number> = {};
  const optionCols: { index: number; order: number }[] = [];

  header.forEach((h, i) => {
    if (MATCHERS.question.test(h)) col.question = i;
    else if (MATCHERS.answer.test(h)) col.answer = i;
    else if (MATCHERS.round.test(h)) col.round = i;
    else if (MATCHERS.points.test(h) && col.points === undefined) col.points = i;
    else if (MATCHERS.explanation.test(h)) col.explanation = i;
    else if (MATCHERS.optionsCombined.test(h)) col.options = i;
    else {
      const li = letterColIndex(h);
      if (li !== null) optionCols.push({ index: i, order: li });
    }
  });

  if (col.question === undefined) {
    throw new SheetFetchError(
      "No “Question” column found. Add a header row with columns like: Question, A, B, C, D, Answer."
    );
  }

  const raw: RawRow[] = [];
  let skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const get = (i: number | undefined) => (i === undefined ? "" : cells[i] ?? "");
    const question = get(col.question).trim();
    if (!question) {
      skipped++;
      continue;
    }
    let options: string[] = [];
    if (optionCols.length >= 2) {
      options = optionCols
        .sort((a, b) => a.order - b.order)
        .map((o) => get(o.index).trim())
        .filter((s) => s !== "");
    } else if (col.options !== undefined) {
      options = splitOptions(get(col.options));
    }
    const answerRaw = get(col.answer).trim();
    // multiple choice needs 2+ options; otherwise it's an open question
    // (open questions only require an answer text)
    if (options.length < 2 && !answerRaw) {
      skipped++;
      continue;
    }
    const ptsParsed = parseFloat(get(col.points));
    raw.push({
      question,
      options: options.length >= 2 ? options : [],
      answerRaw,
      round: get(col.round).trim(),
      points: Number.isFinite(ptsParsed) && ptsParsed > 0 ? ptsParsed : null,
      explanation: get(col.explanation).trim(),
    });
  }

  return buildQuizData(raw, skipped, sourceLabel);
}

export function normalizeObjects(objs: Record<string, string>[], sourceLabel: string): QuizData {
  const keys = objs[0] ? Object.keys(objs[0]) : [];
  const header = keys.map((k) => norm(k));
  const rows: string[][] = [header, ...objs.map((o) => keys.map((k) => String(o[k] ?? "")))];
  return normalizeRows(rows, sourceLabel);
}

function splitOptions(raw: string): string[] {
  if (!raw.trim()) return [];
  const parts = raw
    .split(/[|;•]|\n/)
    .map((s) => s.replace(/^[A-Fa-f][).:;]\s*/, "").trim())
    .filter(Boolean);
  return parts;
}

/** Recompute totalPoints / estimatedSeconds after round defs are tuned. */
export function recomputeTotals(data: QuizData): QuizData {
  const totalPoints = data.rounds.reduce(
    (sum, rd) =>
      sum + rd.questions.reduce((s, q) => s + (q.points > 0 ? q.points : rd.def.points), 0),
    0
  );
  const estimatedSeconds = data.rounds.reduce(
    (sum, rd) => sum + rd.questions.length * (rd.def.seconds + 6),
    0
  );
  return { ...data, totalPoints, estimatedSeconds };
}

export function buildQuizData(raw: RawRow[], skipped: number, sourceLabel: string): QuizData {
  if (raw.length === 0) {
    throw new SheetFetchError(
      "Found a header row but no usable questions. Each row needs a question, at least 2 options, and an answer."
    );
  }

  const questions: Question[] = [];
  let droppedBadAnswers = 0;

  raw.forEach((r, i) => {
    const isMcq = r.options.length >= 2;
    let answerIndex = -1;
    let answerText: string | undefined;
    if (isMcq) {
      answerIndex = r.answerRaw ? resolveAnswerIndex(r.answerRaw, r.options) : 0;
      if (r.answerRaw && answerIndex === -1) {
        droppedBadAnswers++;
        answerIndex = 0; // keep the question, first option becomes key
      }
      if (!r.answerRaw) answerIndex = 0;
    } else {
      answerText = r.answerRaw.trim();
    }
    questions.push({
      id: `q-${i}-${questions.length}`,
      text: r.question,
      kind: isMcq ? "mcq" : "open",
      options: r.options,
      answerIndex,
      answerText,
      round: r.round,
      points: r.points ?? 0, // 0 => use round default
      explanation: r.explanation || undefined,
    });
  });

  const rounds = buildRounds(questions);
  const totalPoints = rounds.reduce(
    (sum, rd) =>
      sum + rd.questions.reduce((s, q) => s + (q.points > 0 ? q.points : rd.def.points), 0),
    0
  );
  const estimatedSeconds = rounds.reduce(
    (sum, rd) => sum + rd.questions.length * (rd.def.seconds + 6),
    0
  );

  return {
    rounds,
    totalQuestions: questions.length,
    totalPoints,
    estimatedSeconds,
    skippedRows: skipped + droppedBadAnswers,
    sourceLabel,
  };
}
