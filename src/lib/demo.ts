import { QuizData } from "./types";
import { buildQuizData, parseSheetInput, fetchQuizFromSheet } from "./sheets";

/** The demo set is pulled from this sheet when it's publicly shared. */
export const DEMO_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1Gi8t36BZH5Bqwfhqu9vvA_ZqfFSuWlvieveArvzMFEA";

/**
 * Load the demo from the Google Sheet above.
 * Falls back to the built-in set if the sheet isn't shared / is unreachable.
 */
export async function loadDemoQuiz(): Promise<{ data: QuizData; fromSheet: boolean }> {
  const ref = parseSheetInput(DEMO_SHEET_URL);
  if (ref) {
    try {
      const res = await fetchQuizFromSheet(ref);
      return { data: { ...res.data, sourceLabel: "Demo Sheet" }, fromSheet: true };
    } catch {
      /* private or offline — fall through to the bundled set */
    }
  }
  return { data: demoQuiz(), fromSheet: false };
}

const DEMO_ROWS = [
  // ---- EASY (1 pt · 15s) ----
  { question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Mercury"], answerRaw: "B", round: "Easy", points: null, explanation: "Mars appears red because of iron oxide — rust — on its surface." },
  { question: "What is the chemical symbol for gold?", options: ["Ag", "Go", "Au", "Gd"], answerRaw: "Au", round: "Easy", points: null, explanation: "Au comes from the Latin word “aurum”, meaning shining dawn." },
  { question: "How many sides does a hexagon have?", options: ["5", "6", "7", "8"], answerRaw: "6", round: "Easy", points: null, explanation: "“Hexa” is Greek for six." },
  { question: "What famous landmark is shown in the image?", options: ["Eiffel Tower", "Big Ben", "Statue of Liberty", "Sydney Opera House"], answerRaw: "A", round: "Easy", points: null, explanation: "The Eiffel Tower in Paris, France — completed in 1889.", image: "https://images.pexels.com/photos/29667766/pexels-photo-29667766.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" },
  // ---- AVERAGE (2 pts · 20s) ----
  { question: "Which scientist proposed the theory of general relativity?", options: ["Isaac Newton", "Niels Bohr", "Albert Einstein", "Max Planck"], answerRaw: "C", round: "Average", points: null, explanation: "Einstein published general relativity in 1915, redefining gravity as curved spacetime." },
  { question: "The Fibonacci sequence begins 0, 1, 1, 2, 3 — what comes next?", options: ["4", "5", "6", "8"], answerRaw: "5", round: "Average", points: null, explanation: "Each term is the sum of the two before it: 2 + 3 = 5." },
  { question: "Which is the smallest prime number?", options: ["0", "1", "2", "3"], answerRaw: "2", round: "Average", points: null, explanation: "1 is not prime, and 2 is the only even prime number." },
  // ---- DIFFICULT (3 pts · 25s) ----
  { question: "In computing, what does “HTTP” stand for?", options: ["HyperText Transfer Protocol", "High Throughput Transmission Process", "HyperText Terminal Program", "Host Text Transfer Protocol"], answerRaw: "A", round: "Difficult", points: null, explanation: "HTTP has powered the web since Tim Berners-Lee introduced it in 1991." },
  { question: "Which organelle is known as the powerhouse of the cell?", options: ["Nucleus", "Ribosome", "Golgi apparatus", "Mitochondrion"], answerRaw: "D", round: "Difficult", points: null, explanation: "Mitochondria generate most of the cell’s ATP — its usable energy." },
  { question: "Which year did the Chernobyl disaster occur?", options: ["1979", "1984", "1986", "1991"], answerRaw: "1986", round: "Difficult", points: null, explanation: "Reactor No. 4 exploded on April 26, 1986, in Soviet Ukraine." },
  { question: "What is 15% of 200?", options: [], answerRaw: "30", round: "Average", points: null, explanation: "15% × 200 = 0.15 × 200 = 30. An open-answer question — no options needed." },
  // ---- CLINCHER (5 pts · 30s) ----
  { question: "What is the square root of 324?", options: ["16", "18", "20", "22"], answerRaw: "B", round: "Clincher", points: null, explanation: "18 × 18 = 324." },
  { question: "Which mathematical constant equals approximately 2.71828?", options: ["π (pi)", "φ (golden ratio)", "e (Euler’s number)", "γ (Euler–Mascheroni)"], answerRaw: "C", round: "Clincher", points: null, explanation: "Euler’s number e is the base of natural logarithms, central to growth and decay." },
  { question: "The Rosetta Stone was key to deciphering which writing system?", options: ["Cuneiform", "Mayan glyphs", "Linear B", "Egyptian hieroglyphs"], answerRaw: "D", round: "Clincher", points: null, explanation: "Decoded by Champollion in 1822, it carried the same decree in three scripts." },
  { question: "Name the largest desert on Earth.", options: [], answerRaw: "Antarctic Desert", round: "Clincher", points: null, explanation: "Deserts are defined by dryness, not heat — Antarctica’s polar desert is the largest. The Sahara is the largest hot desert." },
  { question: "What animal is shown in the image?", options: [], answerRaw: "Philippine Tarsier", round: "Difficult", points: null, explanation: "The Philippine tarsier — one of the world's smallest primates, famous for its enormous eyes. An open image-guess question.", image: "https://images.pexels.com/photos/4086737/pexels-photo-4086737.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" },
  { question: "A train leaves at 2:15 PM travelling 80 km/h and arrives 3 hours 45 minutes later. How far did it travel?", options: ["260 km", "280 km", "300 km", "320 km"], answerRaw: "C", round: "Clincher", points: null, seconds: 90, explanation: "80 km/h × 3.75 h = 300 km. This question gets 90 seconds from the sheet's Time column.", image: undefined },
];

export function demoQuiz(): QuizData {
  return buildQuizData(DEMO_ROWS, 0, "Arena Demo Set");
}
