import { GlassPanel, GlassPill } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  BrainCircuit,
  CheckCircle2,
  GraduationCap,
  RotateCcw,
  XCircle,
} from "lucide-react";import { useState } from "react";

interface QuizQuestion {
  scenario: string;
  question: string;
  options: { text: string; correct: boolean; explain: string }[];
  teach: string;
}

const QUESTIONS: QuizQuestion[] = [
  {
    scenario: '"Mom" calls: "I\'m at the Apple store, my wallet was stolen!',
    question: "The voice sounds exactly like her. What do you do first?",
    options: [
      {
        text: "Send the $900 she asks for via Zelle",
        correct: false,
        explain:
          "Payment is irreversible. Never move money on the strength of a voice alone.",
      },
      {
        text: "Ask her a question only the real Mom would know",
        correct: true,
        explain:
          "Voice clones copy the voice, not the shared history. A personal challenge question is free, instant, and clone-proof.",
      },
      {
        text: "Trust it — the voice is unmistakably hers",
        correct: false,
        explain:
          "3 seconds of audio is enough to clone a voice. Sounding right is the entire point of the scam.",
      },
    ],
    teach:
      "Your safe word beats any clone: the voice can be perfect, but the clone has no access to your shared secrets.",
  },
  {
    scenario:
      '"Bank security": "We detected fraud. Read me the code we just texted you."',
    question: "Which detail proves this is a scam?",
    options: [
      {
        text: "The caller knows your name and last 4 digits",
        correct: false,
        explain:
          "Breach data makes that trivial. It is not proof of legitimacy.",
      },
      {
        text: "The bank asks you to read back a one-time code",
        correct: true,
        explain:
          "No legitimate institution will ever ask for your OTP. Reading it back is the final step of account takeover.",
      },
      {
        text: "The caller sounds slightly robotic",
        correct: false,
        explain:
          "Modern clones don't sound robotic. The tell is the request, not the tone.",
      },
    ],
    teach:
      "OTP requests are the universal scam fingerprint. Hang up and call the number printed on your card.",
  },
  {
    scenario:
      '"Your CFO": "I\'m in a meeting abroad, can\'t talk — wire $40k to close the deal today."',
    question: "What is the safest next move?",
    options: [
      {
        text: "Wire it — execs make urgent requests all the time",
        correct: false,
        explain:
          "BEC (business email compromise) style voice scams exploit exactly this deference.",
      },
      {
        text: "Call the CFO back on their known number",
        correct: true,
        explain:
          "Callback verification on a known-good number defeats the entire attack chain.",
      },
      {
        text: "Ask them to email the details instead",
        correct: false,
        explain:
          "Emails can be spoofed in the same compromise. Out-of-band voice, on a known number, is the standard.",
      },
    ],
    teach:
      "Trust the callback, not the caller. A 60-second call to a known number breaks every clone script.",
  },
  {
    scenario:
      '"Grandson": "I\'ve been arrested, please don\'t tell Mom, bail is $2,000."',
    question: "Which combination is the classic grandparent-scam signature?",
    options: [
      {
        text: "Emotion + secrecy + fast money",
        correct: true,
        explain:
          "Panic, isolation, and irreversible payment — the three levers every family-scam pulls.",
      },
      {
        text: "A caller ID that shows a local number",
        correct: false,
        explain:
          "Caller ID is trivially spoofed and means nothing in either direction.",
      },
      {
        text: "The caller has a slight accent",
        correct: false,
        explain:
          "Accent is irrelevant; the levers are behavioral, not acoustic.",
      },
    ],
    teach:
      "When you hear emotion + secrecy + urgency to pay, you are inside a script. Disengage and verify out-of-band.",
  },
  {
    scenario:
      'A recorded voice: "This is the IRS. Pay now to avoid arrest."',
    question: "Real IRS/bank/police calls never do which of these?",
    options: [
      {
        text: "Use an autodialer to reach you",
        correct: false,
        explain:
          "Collections and legitimate robocalls exist; this alone is not the tell.",
      },
      {
        text: "Demand immediate payment to avoid arrest",
        correct: true,
        explain:
          "Real agencies never demand instant payment, never threaten arrest for a first contact, and never take gift cards.",
      },
      {
        text: "Know your address",
        correct: false,
        explain:
          "Public-record data. Not evidence either way.",
      },
    ],
    teach:
      "Institutions correspond in writing first. Any 'pay now or else' call is a scam by definition.",
  },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function ScamAcademy() {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  // Fresh 3-question draw per drill. Kept in state so a restart can deal a
  // genuinely new set explicitly instead of relying on a memo re-roll.
  const [questions, setQuestions] = useState(() =>
    shuffle(QUESTIONS).slice(0, 3),
  );

  const current = questions[index];
  const progress = done ? 100 : (index / questions.length) * 100;

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (current.options[i].correct) setCorrectCount((c) => c + 1);
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      setDone(true);
    } else {
      setIndex((i) => i + 1);
      setPicked(null);
    }
  };

  const restart = () => {
    setQuestions(shuffle(QUESTIONS).slice(0, 3));
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
    setDone(false);
  };

  return (
    <GlassPanel className="p-5 sm:p-6">
      <GlassPill>
        <GraduationCap className="size-3" /> Scam Academy
      </GlassPill>
      <h3 className="mt-3 text-lg font-semibold">Spot the clone</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Short drills built from real voice-scam playbooks. Learn the tells before
        the call comes.
      </p>

      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key={`done-${questions[0]?.scenario ?? "d"}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6"
          >
            <div className="glass-inset flex flex-col items-center rounded-2xl px-4 py-8 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-500/30">
                <Award className="size-7" />
              </span>
              <p className="mt-4 text-2xl font-bold tabular-nums">
                {correctCount}/{questions.length}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {correctCount === questions.length
                  ? "Flawless. You are a hard target."
                  : correctCount >= 2
                    ? "Solid instincts. Review the misses below."
                    : "Worth another pass — these levers are used every day."}
              </p>
              {questions.map((q, qi) => (
                <p key={qi} className="mt-3 max-w-md text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Tip:</span>{" "}
                  {q.teach}
                </p>
              ))}
              <Button onClick={restart} variant="outline" className="mt-5 gap-2 border-white/50 bg-white/30">
                <RotateCcw className="size-4" /> New drill
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`${questions[0]?.scenario ?? "q"}-${index}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mt-5"
          >
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>
                Drill {index + 1} of {questions.length}
              </span>
              <span className="tabular-nums">
                Score {correctCount}
              </span>
            </div>
            <Progress value={progress} className="mt-2 h-1.5" />

            <div className="glass-inset mt-4 rounded-xl px-4 py-3">
              <p className="flex items-start gap-2 text-sm font-medium text-foreground">
                <BrainCircuit className="mt-0.5 size-4 shrink-0 text-primary" />
                {current.scenario}
              </p>
            </div>
            <p className="mt-3 text-sm font-medium">{current.question}</p>

            <div className="mt-3 space-y-2">
              {current.options.map((opt, i) => {
                const isPicked = picked === i;
                const reveal = picked !== null;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pick(i)}
                    disabled={reveal}
                    className={cn(
                      "glass-inset w-full rounded-xl px-4 py-3 text-left text-sm transition-all",
                      !reveal && "hover:bg-white/50 active:scale-[0.99]",
                      reveal &&
                        opt.correct &&
                        "border border-emerald-400/60 bg-emerald-400/15",
                      reveal &&
                        isPicked &&
                        !opt.correct &&
                        "border border-rose-400/60 bg-rose-400/15",
                    )}
                  >
                    <span className="flex items-start gap-2.5">
                      {reveal && opt.correct ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      ) : reveal && isPicked ? (
                        <XCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
                      ) : (
                        <span className="mt-0.5 size-4 shrink-0 rounded-full border border-foreground/25" />
                      )}
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">
                          {opt.text}
                        </span>
                        {reveal && (
                          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                            {opt.explain}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={next} disabled={picked === null} size="sm">
                {index + 1 >= questions.length ? "Finish" : "Next drill"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassPanel>
  );
}
