export interface Question {
  id: string;
  text: string;
  /** "mcq" = multiple choice, "open" = free answer */
  kind: "mcq" | "open";
  options: string[];
  /** mcq: index of correct option; open: -1 */
  answerIndex: number;
  /** open questions: the expected answer text */
  answerText?: string;
  /** the answer cell exactly as written in the sheet — shown verbatim */
  answerRaw?: string;
  /**
   * True when this is an MCQ whose answer cell didn't match any option.
   * The raw answer is then displayed instead of guessing an option.
   */
  answerUnresolved?: boolean;
  round: string;
  /** raw "Type of Question" label from the sheet (e.g. "Identification") */
  qtype?: string;
  points: number;
  /** per-question time limit in seconds; 0 => use the round default */
  seconds: number;
  explanation?: string;
  /** optional image to display with the question (guess-the-image) */
  image?: string;
}

export interface RoundDef {
  key: string;
  label: string;
  points: number;
  seconds: number;
  color: string;
  glow: string;
  order: number;
}

export interface QuizRound {
  def: RoundDef;
  questions: Question[];
}

export interface QuizData {
  rounds: QuizRound[];
  totalQuestions: number;
  totalPoints: number;
  estimatedSeconds: number;
  skippedRows: number;
  /** total non-blank data rows found below the header */
  rowsRead: number;
  /** human-readable notes explaining any unusual row, in plain language */
  warnings: string[];
  /** rows dropped because the 300-question cap was reached */
  truncatedRows: number;
  sourceLabel: string;
}

export interface AnswerRecord {
  question: Question;
  selectedIndex: number | null;
  correct: boolean;
  timedOut: boolean;
  pointsEarned: number;
  timeLeft: number;
}

export interface FetchResult {
  data: QuizData;
  via: "csv" | "json" | "demo";
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  maxScore: number;
  accuracy: number;
  date: number;
  source: string;
}

export type QuizMode = "solo" | "contest";

export interface Contestant {
  id: string;
  name: string;
  color: string;
  glow: string;
  seat: number;
}

export interface AwardEvent {
  contestantId: string;
  roundIndex: number;
  questionIndex: number;
  points: number;
}

export interface TeamScore {
  contestant: Contestant;
  total: number;
  perRound: number[];
  rank: number;
}
