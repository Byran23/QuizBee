import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Backdrop from "./components/Backdrop";
import SetupScreen from "./components/SetupScreen";
import BriefingScreen from "./components/BriefingScreen";
import RoundIntro from "./components/RoundIntro";
import QuizScreen from "./components/QuizScreen";
import ResultsScreen from "./components/ResultsScreen";
import ContestantsSetup from "./components/contest/ContestantsSetup";
import HostGame from "./components/contest/HostGame";
import PodiumBoard from "./components/contest/PodiumBoard";
import { AnswerRecord, AwardEvent, Contestant, FetchResult, QuizMode, TeamScore } from "./lib/types";
import { recomputeTotals } from "./lib/sheets";
import { sfx } from "./lib/sound";
import FullscreenToggle from "./components/FullscreenToggle";

type View =
  | "setup" | "briefing" | "round-intro" | "quiz" | "results"
  | "contestants" | "contest-play" | "standings" | "podium";

export default function App() {
  const [view, setView] = useState<View>("setup");
  const [result, setResult] = useState<FetchResult | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<QuizMode>("solo");

  /* solo state */
  const [roundIndex, setRoundIndex] = useState(0);
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  /* contest state */
  const [teams, setTeams] = useState<Contestant[]>([]);
  const [awards, setAwards] = useState<AwardEvent[]>([]);

  const resetSolo = useCallback(() => {
    setRoundIndex(0);
    setRecords([]);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
  }, []);

  const resetContest = useCallback(() => {
    setRoundIndex(0);
    setAwards([]);
  }, []);

  useEffect(() => {
    setBestStreak((b) => Math.max(b, streak));
  }, [streak]);

  /* ---------------- shared flow ---------------- */

  const handleReady = useCallback((res: FetchResult, url: string | null) => {
    setResult(res);
    setSourceUrl(url);
    resetSolo();
    setAwards([]);
    setView("briefing");
    window.scrollTo({ top: 0 });
  }, [resetSolo]);

  const handleModeStart = useCallback((m: QuizMode) => {
    setMode(m);
    if (m === "solo") {
      resetSolo();
      sfx.roundStart();
      setView("round-intro");
    } else {
      resetContest();
      setView("contestants");
    }
    window.scrollTo({ top: 0 });
  }, [resetSolo, resetContest]);

  /* ---------------- solo flow ---------------- */

  const handleQuestionResult = useCallback((rec: AnswerRecord) => {
    setRecords((r) => [...r, rec]);
    setScore((s) => s + rec.pointsEarned);
    setStreak((st) => (rec.correct ? st + 1 : 0));
  }, []);

  const handleRoundDone = useCallback(() => {
    if (!result) return;
    if (roundIndex < result.data.rounds.length - 1) {
      setRoundIndex((i) => i + 1);
      sfx.roundStart();
      setView("round-intro");
    } else {
      setView("results");
    }
    window.scrollTo({ top: 0 });
  }, [result, roundIndex]);

  /* ---------------- contest flow ---------------- */

  const handleRoster = useCallback((list: Contestant[]) => {
    setTeams(list);
    resetContest();
    sfx.roundStart();
    setView("round-intro");
    window.scrollTo({ top: 0 });
  }, [resetContest]);

  const handleAward = useCallback((teamId: string, questionIndex: number, points: number) => {
    setAwards((a) => [...a, { contestantId: teamId, roundIndex, questionIndex, points }]);
  }, [roundIndex]);

  const handleContestRoundDone = useCallback(() => {
    if (!result) return;
    if (roundIndex < result.data.rounds.length - 1) setView("standings");
    else setView("podium");
    window.scrollTo({ top: 0 });
  }, [result, roundIndex]);

  const standings: TeamScore[] = useMemo(() => {
    if (!result) return [];
    const n = result.data.rounds.length;
    const table = teams.map((c) => {
      const mine = awards.filter((a) => a.contestantId === c.id);
      const perRound = Array.from({ length: n }, (_, i) =>
        mine.filter((a) => a.roundIndex === i).reduce((s, a) => s + a.points, 0)
      );
      return { contestant: c, total: perRound.reduce((s, v) => s + v, 0), perRound, rank: 0 };
    });
    table.sort((a, b) => b.total - a.total);
    let prev = -1, prevRank = 0;
    table.forEach((t, i) => {
      if (t.total === prev) t.rank = prevRank;
      else { t.rank = i + 1; prev = t.total; prevRank = t.rank; }
    });
    return table;
  }, [teams, awards, result]);

  const accent = useMemo(() => {
    if (!result) return "#B8FF3C";
    if (view === "quiz" || view === "round-intro" || view === "contest-play")
      return result.data.rounds[roundIndex]?.def.color ?? "#B8FF3C";
    if (view === "contestants") return "#5CD2FF";
    if (view === "standings" || view === "podium") return "#FFB84D";
    return "#B8FF3C";
  }, [view, result, roundIndex]);

  const handleUpdateRound = useCallback((roundKey: string, patch: { points?: number; seconds?: number }) => {
    setResult((prev) => {
      if (!prev) return prev;
      const rounds = prev.data.rounds.map((r) =>
        r.def.key === roundKey ? { ...r, def: { ...r.def, ...patch } } : r
      );
      return { ...prev, data: recomputeTotals({ ...prev.data, rounds }) };
    });
  }, []);

  const enterNextContestRound = useCallback(() => {
    setRoundIndex((i) => i + 1);
    sfx.roundStart();
    setView("round-intro");
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <div className="grain relative min-h-screen">
      <Backdrop accent={accent} />
      <FullscreenToggle />

      <AnimatePresence mode="wait">
        {view === "setup" && (
          <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}>
            <SetupScreen onReady={handleReady} />
          </motion.div>
        )}

        {view === "briefing" && result && (
          <motion.div key="briefing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}>
            <BriefingScreen
              data={result.data}
              sourceUrl={sourceUrl}
              via={result.via}
              onStart={handleModeStart}
              onBack={() => setView("setup")}
              onUpdateRound={handleUpdateRound}
            />
          </motion.div>
        )}

        {view === "round-intro" && result && (
          <motion.div key="rintro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <RoundIntro
              round={result.data.rounds[roundIndex].def}
              count={result.data.rounds[roundIndex].questions.length}
              total={result.data.rounds.length}
              onDone={() => setView(mode === "solo" ? "quiz" : "contest-play")}
            />
          </motion.div>
        )}

        {view === "quiz" && result && (
          <motion.div key={`quiz-${roundIndex}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}>
            <QuizScreen
              round={result.data.rounds[roundIndex]}
              roundIndex={roundIndex}
              totalRounds={result.data.rounds.length}
              score={score}
              streak={streak}
              onQuestionResult={handleQuestionResult}
              onRoundDone={handleRoundDone}
              onQuit={() => { resetSolo(); setView("setup"); }}
            />
          </motion.div>
        )}

        {view === "results" && result && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
            <ResultsScreen
              data={result.data}
              records={records}
              score={score}
              bestStreak={bestStreak}
              sourceLabel={result.data.sourceLabel}
              onReplay={() => { resetSolo(); sfx.roundStart(); setView("round-intro"); }}
              onNewSheet={() => { resetSolo(); setView("setup"); }}
            />
          </motion.div>
        )}

        {view === "contestants" && result && (
          <motion.div key="contestants" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}>
            <ContestantsSetup
              data={result.data}
              onBegin={handleRoster}
              onBack={() => setView("briefing")}
            />
          </motion.div>
        )}

        {view === "contest-play" && result && (
          <motion.div key={`contest-${roundIndex}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}>
            <HostGame
              round={result.data.rounds[roundIndex]}
              roundIndex={roundIndex}
              totalRounds={result.data.rounds.length}
              teams={standings}
              onAward={handleAward}
              onRoundDone={handleContestRoundDone}
              onQuit={() => { setView("podium"); }}
            />
          </motion.div>
        )}

        {view === "standings" && result && (
          <motion.div key="standings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }}>
            <PodiumBoard
              standings={standings}
              rounds={result.data.rounds}
              final={false}
              playedRounds={roundIndex + 1}
              onNextRound={enterNextContestRound}
              onNewSheet={() => setView("setup")}
            />
          </motion.div>
        )}

        {view === "podium" && result && (
          <motion.div key="podium" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
            <PodiumBoard
              standings={standings}
              rounds={result.data.rounds}
              final
              playedRounds={result.data.rounds.length}
              onReplay={() => { resetContest(); sfx.roundStart(); setView("round-intro"); }}
              onEditRoster={() => setView("contestants")}
              onNewSheet={() => setView("setup")}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
