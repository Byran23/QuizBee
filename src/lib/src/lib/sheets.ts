import { Question, QuizData, FetchResult } from "./types";
import { buildRounds } from "./rounds";
import { typeIsTrueFalse } from "./qtypes";

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
  // Optional plurals + common real-world variants so ordinary headers match.
  question: /^(q|qs|questions?|questiontext|questiontexts|prompts?|items?|queries|tanong|quizquestion)$/i,
  answer: /^(answers?|correct|correctanswers?|correctoptions?|key|keyanswer|keys|ans|solution|solutions?|sagot)$/i,
  // NOTE: "type" belongs to the question-type column, not the round column.
  round: /^(rounds?|difficulty|difficulties|levels?|category|categories|stage|stages?|groups?|sections?)$/i,
  qtype: /^(type|types|typeofquestion|typeofquestions|questiontype|questiontypes|qtype|format|kind|itemtype)$/i,
  points: /^(points?|pts|score|scores?|value|values?|weight|weights?)$/i,
  explanation: /^(explanations?|why|explain|solutiontext|notes?|rationale|hints?)$/i,
  image: /^(images?|imageurls?|imgs?|imgurls?|pictures?|pictureurls?|photos?|photourls?|imagelinks?|imagelink)$/i,
  seconds: /^(times?|timers?|seconds?|secs?|sec|timelimits?|durations?|countdowns?|timeallotments?|allotments?)$/i,
  optionsCombined: /^(options?|choices?|choiceslist)$/i,
  // numbering / ID columns are recognised so they're never mistaken for content
  numbering: /^(no|nos|number|numbers?|num|#|itemno|itemnumber|qno|questionno|questionnumber|id|seq|row|order)$/i,
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

/** Strip noise commonly typed into answer cells: "Answer: B", "Ans - True", "(C)". */
export function cleanAnswerCell(raw: string): string {
  return raw
    .replace(/^\s*(?:correct\s*)?(?:answer|ans|sagot|key)\s*[:=\-–]\s*/i, "")
    .replace(/^\s*[([{]\s*/, "")
    .replace(/\s*[)\]}]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveAnswerIndex(rawInput: string, options: string[]): number {
  const a = cleanAnswerCell(rawInput);

  // True/False shorthand: T / F / yes / no / tama / mali
  const isTF =
    options.length === 2 &&
    /^(true|false)$/i.test(options[0]) &&
    /^(true|false)$/i.test(options[1]);
  if (isTF) {
    const truthy = /^(t|true|yes|y|tama|totoo|1)$/i.test(a);
    const falsy = /^(f|false|no|n|mali|0)$/i.test(a);
    if (truthy || falsy) {
      const wantTrue = truthy;
      const idx = options.findIndex((o) => /^true$/i.test(o));
      const trueIdx = idx >= 0 ? idx : 0;
      return wantTrue ? trueIdx : trueIdx === 0 ? 1 : 0;
    }
  }
  const clean0 = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  // An exact option-text match always wins — critical when the options are
  // themselves letters or numbers (e.g. answer "4" with options 3/4/5/6).
  const exact = options.findIndex((o) => clean0(o) === clean0(a));
  if (exact >= 0) return exact;

  // letter  "B"  / "b"  / "B)" / "B."
  const lm = a.match(/^([A-Fa-f])[).:;]?\s*$/);
  if (lm) {
    const idx = lm[1].toUpperCase().charCodeAt(0) - 65;
    if (idx < options.length) return idx;
  }
  // number "1"-"6" (positional, only when no option literally equals it)
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
  qtype?: string;
  points: number | null;
  /** per-question seconds; null => use the round default */
  seconds?: number | null;
  explanation: string;
  image?: string;
}

export function normalizeRows(rows: string[][], sourceLabel: string): QuizData {
  // Find the header row: the FIRST row that reads like a header.
  // Only completely blank / decorative lead-in rows are skipped before it.
  // If nothing looks like a header we default to row 1 — we never scan past
  // data rows, because that would swallow questions.
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = rows[i].map((c) => norm(c));
    if (cells.filter((c) => c !== "").length === 0) continue; // fully blank only
    const looksLikeHeader = cells.some(
      (c) =>
        MATCHERS.question.test(c) ||
        MATCHERS.answer.test(c) ||
        MATCHERS.round.test(c) ||
        MATCHERS.points.test(c) ||
        MATCHERS.explanation.test(c) ||
        MATCHERS.image.test(c) ||
        MATCHERS.seconds.test(c) ||
        MATCHERS.optionsCombined.test(c) ||
        letterColIndex(c) !== null
    );
    if (looksLikeHeader) {
      headerIdx = i;
      break;
    }
  }

  // No recognizable header anywhere → treat EVERY row as data so nothing is
  // swallowed, and fall back to positional columns (col 1 = question, col 2 = answer).
  const hasHeader = headerIdx >= 0;
  const header = hasHeader
    ? rows[headerIdx].map((h) => norm(h))
    : rows[0].map(() => ""); // no labels — columns are matched positionally below
  const body = hasHeader ? rows.slice(headerIdx + 1) : rows;
  const col: Record<string, number | undefined> = {};
  const optionCols: { index: number; order: number }[] = [];

  header.forEach((h, i) => {
    if (MATCHERS.question.test(h)) col.question = i;
    else if (MATCHERS.answer.test(h)) col.answer = i;
    else if (MATCHERS.qtype.test(h)) col.qtype = i;
    else if (MATCHERS.round.test(h)) col.round = i;
    else if (MATCHERS.points.test(h) && col.points === undefined) col.points = i;
    else if (MATCHERS.explanation.test(h)) col.explanation = i;
    else if (MATCHERS.image.test(h)) col.image = i;
    else if (MATCHERS.seconds.test(h) && col.seconds === undefined) col.seconds = i;
    else if (MATCHERS.numbering.test(h)) col.numbering = i; // claimed, never content
    else if (MATCHERS.optionsCombined.test(h)) col.options = i;
    else {
      const li = letterColIndex(h);
      if (li !== null) optionCols.push({ index: i, order: li });
    }
  });

  const widest = Math.max(
    header.length,
    body.reduce((m, rw) => Math.max(m, rw.length), 0),
    1
  );

  /** Rows carrying real text in a column. */
  const coverage = (i: number) =>
    body.reduce((n, rw) => n + ((rw[i]?.trim() ?? "") !== "" ? 1 : 0), 0);
  const textWeight = (i: number) =>
    body.reduce((s, rw) => s + (rw[i]?.trim().length ?? 0), 0);

  const claimedCols = () =>
    new Set<number>(
      [
        col.answer, col.round, col.qtype, col.points, col.explanation, col.image,
        col.seconds, col.options, col.numbering,
        ...optionCols.map((o) => o.index),
      ].filter((v): v is number => v !== undefined)
    );

  // A labelled column that turns out to be empty would blank every question,
  // so verify it actually holds content before trusting it.
  if (col.question !== undefined && coverage(col.question) === 0) {
    col.question = undefined;
  }

  // Headerless sheet: column 1 is the question, column 2 the answer.
  if (!hasHeader) {
    if (col.question === undefined) col.question = 0;
    if (col.answer === undefined && widest >= 2) col.answer = 1;
  }

  // No usable Question header → infer it from content. Coverage wins first
  // (questions fill nearly every row), then total text length breaks ties.
  if (col.question === undefined) {
    const claimed = claimedCols();
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < widest; i++) {
      if (claimed.has(i)) continue;
      const score = coverage(i) * 100000 + textWeight(i);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best >= 0) col.question = best;
  }

  if (col.question === undefined && col.image === undefined) {
    throw new SheetFetchError(
      "Couldn’t find any question content in this sheet. Add a header row with columns like: Question, A, B, C, D, Answer."
    );
  }

  const raw: RawRow[] = [];
  const stats = { blank: 0, recoveredQuestion: 0, noAnswer: 0 };

  for (let r = 0; r < body.length; r++) {
    const cells = body[r];
    // Resilience: when a row has MORE cells than the header, the question text
    // contained commas but wasn't quoted (raw CSV pasted in, not exported by
    // Sheets). Re-join the fragments around the question column so the
    // sentence isn't truncated mid-way.
    let effectiveCells = cells;
    const headerWidth = rows[headerIdx]?.length ?? 0;
    const overflow = cells.length - headerWidth;
    if (headerWidth > 0 && overflow > 0 && col.question !== undefined) {
      const qIdx = col.question;
      effectiveCells = cells
        .slice(0, qIdx)
        .concat([cells.slice(qIdx, qIdx + overflow + 1).join(",")])
        .concat(cells.slice(qIdx + overflow + 1));
    }

    const get = (i: number | undefined) => (i === undefined ? "" : effectiveCells[i] ?? "");
    let question = (col.question === undefined ? "" : effectiveCells[col.question] ?? "").trim();

    let options: string[] = [];
    if (optionCols.length >= 2) {
      options = optionCols
        .sort((a, b) => a.order - b.order)
        .map((o) => get(o.index).trim())
        .filter((s) => s !== "");
    } else if (col.options !== undefined) {
      options = splitOptions(get(col.options));
    }

    // The answer cell is kept EXACTLY as written — nothing is stripped or
    // rewritten. A separate cleaned copy is used only for matching options.
    const answerRaw = get(col.answer).trim();
    const qtype = get(col.qtype).trim();
    const explanation = get(col.explanation).trim();
    const image = normalizeImageUrl(get(col.image));

    // Never drop a row that carries content. If the Question cell is blank,
    // recover the text from wherever it actually lives in that row.
    if (!question) {
      // Recover from another cell, but never from the answer or option
      // columns — that would show the answer twice instead of a question.
      const skipCols = new Set([
        col.image, col.round, col.qtype, col.points, col.seconds,
        col.explanation, col.numbering, col.answer,
        ...optionCols.map((o) => o.index),
      ].filter((v): v is number => v !== undefined));

      const fallback = cells
        .map((c, i) => ({ c: c?.trim() ?? "", i }))
        .filter(({ c, i }) => c !== "" && !skipCols.has(i))
        .sort((a, b) => b.c.length - a.c.length)[0]?.c;

      if (fallback) {
        question = fallback;
        stats.recoveredQuestion++;
      } else if (image) {
        question = "What is shown in the image?";
        stats.recoveredQuestion++;
      } else if (answerRaw || options.length > 0) {
        // Row has content but no question text anywhere — keep it, labelled.
        question = `(No question text in row ${r + (hasHeader ? headerIdx + 2 : 1)} — answer shown below)`;
        stats.recoveredQuestion++;
      } else {
        stats.blank++; // genuinely empty row — nothing to show
        continue;
      }
    }

    // A True/False type with no options → auto-build the two choices.
    if (options.length < 2 && typeIsTrueFalse(qtype)) {
      options = ["True", "False"];
    }

    if (!answerRaw) stats.noAnswer++;

    const isOpen = options.length < 2;
    const ptsParsed = parseFloat(get(col.points));
    raw.push({
      question,
      options: isOpen ? [] : options,
      answerRaw,
      round: get(col.round).trim(),
      qtype: qtype || undefined,
      points: Number.isFinite(ptsParsed) && ptsParsed > 0 ? ptsParsed : null,
      seconds: parseSeconds(get(col.seconds)), // blank → null → round default
      explanation,
      image,
    });
  }

  const warnings: string[] = [];
  if (stats.recoveredQuestion > 0) {
    warnings.push(
      `${stats.recoveredQuestion} row${stats.recoveredQuestion > 1 ? "s" : ""} had an empty Question cell — the question text was recovered from the rest of the row so nothing was lost.`
    );
  }
  if (stats.noAnswer > 0) {
    warnings.push(
      `${stats.noAnswer} row${stats.noAnswer > 1 ? "s" : ""} had no Answer — kept as is; the host can read the question and award points manually.`
    );
  }
  if (stats.blank > 0) {
    warnings.push(`${stats.blank} completely empty row${stats.blank > 1 ? "s" : ""} ignored.`);
  }

  return buildQuizData(raw, stats.blank, sourceLabel, warnings);
}

function splitOptions(raw: string): string[] {
  if (!raw.trim()) return [];
  // Split on the delimiter only — the text itself is kept EXACTLY as written,
  // so symbols, punctuation and prefixes like "e.g." or "C.S." are untouched.
  return raw
    .split(/[|;•]|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
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

export function buildQuizData(
  raw: RawRow[],
  skipped: number,
  sourceLabel: string,
  warnings: string[] = []
): QuizData {
  if (raw.length === 0) {
    throw new SheetFetchError(
      "Found a header row but no usable questions. Rows need a Question + Answer (for open questions) or Question + 2+ options + Answer (for multiple choice)."
    );
  }

  // enforce the 300-question ceiling — keep the first 300, report the rest
  const truncatedRows = Math.max(0, raw.length - MAX_QUESTIONS);
  if (truncatedRows > 0) raw = raw.slice(0, MAX_QUESTIONS);

  const questions: Question[] = [];
  const notes = [...warnings];
  let unmatchedAnswers = 0;

  raw.forEach((r, i) => {
    const hasOptions = r.options.length >= 2;
    // The cleaned copy is used ONLY to locate the matching option.
    const resolved = hasOptions && r.answerRaw ? resolveAnswerIndex(cleanAnswerCell(r.answerRaw), r.options) : -1;
    // Options are ALWAYS kept — a question is a selection whenever it has them.
    // If the answer matches no option we don't guess: the options still show
    // and the answer is displayed exactly as written.
    const isMcq = hasOptions;
    const unresolved = hasOptions && resolved < 0;
    if (unresolved) unmatchedAnswers++;

    questions.push({
      id: `q-${i}-${questions.length}`,
      text: r.question,
      kind: isMcq ? "mcq" : "open",
      options: isMcq ? r.options : [],
      answerIndex: isMcq ? resolved : -1,
      answerText: r.answerRaw || undefined,
      answerRaw: r.answerRaw || undefined,
      answerUnresolved: unresolved ? true : undefined,
      round: r.round,
      qtype: r.qtype,
      points: r.points ?? 0, // 0 => use round default
      seconds: r.seconds ?? 0, // 0 => use round default
      explanation: r.explanation || undefined,
      image: r.image,
    });
  });

  if (unmatchedAnswers > 0) {
    notes.push(
      `${unmatchedAnswers} multiple-choice answer${unmatchedAnswers > 1 ? "s" : ""} didn’t match any option, so the answer is shown exactly as written rather than guessed.`
    );
  }

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

  if (truncatedRows > 0) {
    notes.push(
      `The sheet has more than ${MAX_QUESTIONS} questions — the first ${MAX_QUESTIONS} are used and the last ${truncatedRows} were left out.`
    );
  }

  return {
    rounds,
    totalQuestions: questions.length,
    totalPoints,
    estimatedSeconds,
    // only genuinely empty rows count as skipped — nothing with content is dropped
    skippedRows: skipped,
    rowsRead: raw.length + skipped,
    truncatedRows,
    warnings: notes,
    sourceLabel,
  };
}
