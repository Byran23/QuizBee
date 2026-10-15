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

/** Hard ceiling on how many questions a single quiz can hold. */
export const MAX_QUESTIONS = 300;

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
  image: /^(image|imageurl|img|imgurl|picture|pictureurl|photo|photourl|imagelink)$/i,
  seconds: /^(time|timer|seconds|secs|sec|timelimit|duration|countdown|timeallotment|allotment)$/i,
  optionsCombined: /^(options|choices|choiceslist)$/i,
  optionIndexed: /^([a-f])$/i,
  optionLong: /^(option|choice|choice|opt|a)([a-f]|[1-6])$/i,
};

/** Parse a time cell: "45", "45s", "90 sec", "1:30" (mm:ss) → seconds. Blank → null. */
export function parseSeconds(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  // mm:ss
  const clock = s.match(/^(\d{1,2}):([0-5]?\d)$/);
  if (clock) {
    const total = parseInt(clock[1]) * 60 + parseInt(clock[2]);
    return total > 0 ? total : null;
  }
  // "1m 30s" / "2 min"
  const mm = s.match(/(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?\b/);
  const ss = s.match(/(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?\b/);
  if (mm || ss) {
    const total = (mm ? parseFloat(mm[1]) * 60 : 0) + (ss ? parseFloat(ss[1]) : 0);
    return total > 0 ? Math.round(total) : null;
  }
  // bare number
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/** Normalize an image cell into a displayable URL (handles =IMAGE() + Drive share links). */
export function normalizeImageUrl(raw: string): string | undefined {
  let s = raw.trim();
  if (!s) return undefined;
  // =IMAGE("https://...") formula → extract inner URL
  const formula = s.match(/=IMAGE\s*\(\s*"([^"]+)"/i) || s.match(/=IMAGE\s*\(\s*'([^']+)'/i);
  if (formula) s = formula[1].trim();
  // strip surrounding quotes
  s = s.replace(/^["']|["']$/g, "").trim();
  if (!s) return undefined;
  // Google Drive share link → direct image
  const driveId = s.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?[^#]*[?&]id=)([a-zA-Z0-9_-]+)/)?.[1]
    || (s.match(/^[a-zA-Z0-9_-]{25,}$/) && s.length < 60 ? s : null);
  if (driveId && (s.includes("drive.google.com") || /^[a-zA-Z0-9_-]{25,}$/.test(s))) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w2000`;
  }
  // Dropbox share → direct
  if (s.includes("dropbox.com")) {
    s = s.replace(/([?&])dl=0/, "$1raw=1");
    if (!s.includes("raw=1")) s += (s.includes("?") ? "&" : "?") + "raw=1";
    return s;
  }
  if (/^https?:\/\//i.test(s)) return s;
  return undefined;
}

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
  /** per-question seconds; null => use the round default */
  seconds?: number | null;
  explanation: string;
  image?: string;
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
    else if (MATCHERS.image.test(h)) col.image = i;
    else if (MATCHERS.seconds.test(h) && col.seconds === undefined) col.seconds = i;
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
    let question = get(col.question).trim();
    const image = normalizeImageUrl(get(col.image));
    if (!question && !image) {
      skipped++;
      continue;
    }
    // image-only row → sensible default prompt
    if (!question && image) question = "What is shown in the image?";
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
      seconds: parseSeconds(get(col.seconds)), // blank → null → round default
      explanation: get(col.explanation).trim(),
      image,
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
    (sum, rd) =>
      sum + rd.questions.reduce((s, q) => s + (q.seconds > 0 ? q.seconds : rd.def.seconds) + 6, 0),
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

  // enforce the 300-question ceiling — keep the first 300, report the rest
  const truncatedRows = Math.max(0, raw.length - MAX_QUESTIONS);
  if (truncatedRows > 0) raw = raw.slice(0, MAX_QUESTIONS);

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
      seconds: r.seconds ?? 0, // 0 => use round default
      explanation: r.explanation || undefined,
      image: r.image,
    });
  });

  const rounds = buildRounds(questions);
  const totalPoints = rounds.reduce(
    (sum, rd) =>
      sum + rd.questions.reduce((s, q) => s + (q.points > 0 ? q.points : rd.def.points), 0),
    0
  );
  const estimatedSeconds = rounds.reduce(
    (sum, rd) =>
      sum + rd.questions.reduce((s, q) => s + (q.seconds > 0 ? q.seconds : rd.def.seconds) + 6, 0),
    0
  );

  return {
    rounds,
    totalQuestions: questions.length,
    totalPoints,
    estimatedSeconds,
    skippedRows: skipped + droppedBadAnswers,
    truncatedRows,
    sourceLabel,
  };
}
