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
/*  Fetching: explicit pub output → gviz CSV → gviz table JSON         */
/* ------------------------------------------------------------------ */

export class SheetFetchError extends Error {}

async function fetchText(url: string, ms = 15000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const via = body.includes("serviceLogin") || body.includes("accounts.google")
        ? " (private — share as “Anyone with the link”)"
        : "";
      throw new SheetFetchError(`HTTP ${res.status}${via}`);
    }
    return await res.text();
  } catch (e) {
    if (e instanceof SheetFetchError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new SheetFetchError("Request timed out — Google is slow, retry in a moment");
    }
    throw new SheetFetchError("Network error — check your connection");
  } finally {
    clearTimeout(t);
  }
}

/** /pub?output=csv — works for “Published to the web” and generally for sheet links. */
async function fetchPubCsv(ref: SheetRef, tab?: string): Promise<string[][]> {
  let url = `https://docs.google.com/spreadsheets/d/${ref.id}/pub?output=csv`;
  if (tab?.trim()) url += `&sheet=${encodeURIComponent(tab.trim())}`;
  else if (ref.gid) url += `&gid=${ref.gid}`;
  const text = await fetchText(url);
  if (/^\s*<!doctype html/i.test(text) || text.includes("<html"))
    throw new SheetFetchError("Not published — publish via File → Share (“Anyone with the link”), or use a plain sheet + ID");
  return parseCsv(text);
}

/** gviz CSV — rock solid for “Anyone with the link” sheets when id/gid are explicit. */
async function fetchGvizCsv(ref: SheetRef, tab?: string): Promise<string[][]> {
  let url = `https://docs.google.com/spreadsheets/d/${ref.id}/gviz/tq?tqx=out:csv`;
  if (tab?.trim()) url += `&sheet=${encodeURIComponent(tab.trim())}`;
  else if (ref.gid) url += `&gid=${ref.gid}`;
  const text = await fetchText(url);
  if (/^\s*<!doctype html/i.test(text)) throw new SheetFetchError("Sheet is private or not shared via link");
  return parseCsv(text);
}

/** gviz table JSON — works even when output=csv is blocked for a given sheet. */
async function fetchGvizJson(ref: SheetRef, tab?: string): Promise<string[][]> {
  let url = `https://docs.google.com/spreadsheets/d/${ref.id}/gviz/tq?headers=1&tqx=responseHandler:_h`;
  if (tab?.trim()) url += `&sheet=${encodeURIComponent(tab.trim())}`;
  else if (ref.gid) url += `&gid=${ref.gid}`;
  const text = await fetchText(url);
  const jsonText = extractJsonP(text);
  const j = JSON.parse(jsonText);
  if (j?.status === "error") {
    const reasons = (j.errors || []).map((e: any) => e.detailed_message || e.message).join("; ");
    throw new SheetFetchError(`Google rejected the read: ${reasons || "unknown"}`);
  }
  const table = j?.table;
  if (!table) throw new SheetFetchError("No table data returned");
  const cols: string[] = (table.cols || []).map((c: any) => (c?.label || c?.id || "").toString());
  const rows: string[][] = (table.rows || []).map((r: any) =>
    (cols.length ? cols : Array.from({ length: (r.c || []).length }, () => "")).map(
      (_: string, ci: number) => {
        const cell = r.c?.[ci];
        if (!cell) return "";
        return String(cell.f ?? cell.v ?? "");
      }
    )
  );
  return [cols, ...rows];
}

function extractJsonP(text: string): string {
  const isJsonP = text.indexOf("_h(") > -1;
  const start = isJsonP ? text.indexOf("(", text.indexOf("_h")) : text.indexOf("{");
  const end = text.lastIndexOf(isJsonP ? ")" : "}");
  if (start === -1 || end <= start) throw new SheetFetchError("Unexpected Google response");
  return text.slice(start + 1, end);
}

const FETCHERS: { name: string; fn: (ref: SheetRef, tab?: string) => Promise<string[][]> }[] = [
  { name: "pub", fn: fetchPubCsv },
  { name: "gviz-csv", fn: fetchGvizCsv },
  { name: "gviz-json", fn: fetchGvizJson },
];

/** Main entry: try each engine, keep the first one with real rows. */
export async function fetchQuizFromSheet(ref: SheetRef, tab?: string): Promise<FetchResult> {
  const failures: string[] = [];
  for (const { name, fn } of FETCHERS) {
    try {
      const rows = await fn(ref, tab);
      if (rows.length < 2) {
        failures.push(`${name}: sheet has no data rows`);
        continue;
      }
      const data = normalizeRows(rows, "Google Sheet");
      return { data, via: name === "pub" ? "csv" : "json" };
    } catch (e) {
      failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new SheetFetchError(
    `Couldn’t read that sheet. ${failures.join(" · ")}. Fix: open Sheets → File → Share → “Anyone with the link · Viewer” (or File → Share → “Publish to the web” → entire document → CSV), then paste the link again.`
  );
}

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
    // MC needs 2+ options; open questions just need an answer text.
    // If there's exactly one option, treat it as open with the option as fallback answer.
    const isOpen = options.length < 2;
    if (isOpen && !answerRaw && options.length === 0) {
      skipped++; // no answer at all → drop the row
      continue;
    }
    const ptsParsed = parseFloat(get(col.points));
    raw.push({
      question,
      options: isOpen ? [] : options,
      answerRaw: answerRaw || (isOpen ? options[0] : ""), // fallback: lone option = answer
      round: get(col.round).trim(),
      points: Number.isFinite(ptsParsed) && ptsParsed > 0 ? ptsParsed : null,
      explanation: get(col.explanation).trim(),
    });
  }

  return buildQuizData(raw, skipped, sourceLabel);
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
      "Found a header row but no usable questions. Rows need a Question + Answer (for open questions) or Question + 2+ options + Answer (for multiple choice)."
    );
  }

  const questions: Question[] = [];
  let droppedBadAnswers = 0;

  raw.forEach((r, i) => {
    const isMcq = r.options.length >= 2;
    let answerIndex = -1;
    let answerText: string | undefined;
    if (isMcq) {
      answerIndex = r.answerRaw ? resolveAnswerIndex(r.answerRaw, r.options) : -1;
      if (answerIndex === -1) {
        // unresolvable or blank answer → default to option A, count as skipped-detail
        if (r.answerRaw) droppedBadAnswers++;
        answerIndex = 0;
      }
    } else {
      answerText = r.answerRaw.trim();
      if (!answerText) {
        droppedBadAnswers++;
        answerText = "—"; // marker so the row doesn't disappear
      }
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
