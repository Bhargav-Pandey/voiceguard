/**
 * Red-flag phrase detection for call transcripts.
 *
 * Voice-clone scams follow well-documented social-engineering scripts. This
 * library scans pasted transcripts for those pressure patterns entirely in
 * the browser — no network, no storage — and highlights exactly which
 * sentences triggered each pattern so the user can see the anatomy of the
 * manipulation.
 */

export interface RedFlagPattern {
  id: string;
  label: string;
  /** Short explanation of why this pattern is a scam signal. */
  why: string;
  weight: number;
  regex: RegExp;
}

export interface RedFlagHit {
  patternId: string;
  label: string;
  why: string;
  /** The matching sentence fragment from the transcript. */
  excerpt: string;
  start: number;
  end: number;
}

export const RED_FLAG_PATTERNS: RedFlagPattern[] = [
  {
    id: "urgency",
    label: "Manufactured urgency",
    why: "Scammers compress your decision time so you cannot verify. A real bank will still be a real bank in an hour.",
    weight: 22,
    regex:
      /\b(right now|immediately|within (?:the next )?\d+ ?(?:minutes?|seconds?|hours?)|in the next \d+|before it'?s too late|act (?:now|fast)|don'?t (?:wait|hang up)|time.?sensitive|asap|urgent(?:ly)?)\b/gi,
  },
  {
    id: "otp",
    label: "Code / PIN request",
    why: "No legitimate service will ever ask you to read back a one-time code. This is the account-takeover step.",
    weight: 28,
    regex:
      /\b(one.?time (?:code|password)|verification code|security code|pin(?: number)?|otp|\bcode we (?:just )?(?:texted|sent)|read (?:me|back) the code|confirm the code)\b/gi,
  },
  {
    id: "payment",
    label: "Money transfer pressure",
    why: "Wire transfers, gift cards, and crypto are irreversible by design — that is why scammers ask for them.",
    weight: 26,
    regex:
      /\b(wire (?:the )?(?:money|transfer|funds)|gift cards?|bitcoin|crypto(?:currency)?|transfer \$?\d[\d,.]*|send \$?\d[\d,.]*|\$\d[\d,.]{2,}(?: ?(?:dollars|usd))?)\b/gi,
  },
  {
    id: "secrecy",
    label: "Secrecy demand",
    why: "\"Don't tell anyone\" isolates you from the person who would spot the scam.",
    weight: 24,
    regex:
      /\b(don'?t tell (?:dad|mom|anyone|your (?:wife|husband|parents|boss))|keep this (?:between us|confidential|quiet)|not a word to|this call is (?:being )?(?:monitored|recorded) by|can'?t discuss (?:this|details) (?:with|over))\b/gi,
  },
  {
    id: "authority",
    label: "Authority impersonation",
    why: "Claims to be your bank, the IRS, police, or a lawyer exploit reflexive obedience to institutions.",
    weight: 18,
    regex:
      /\b(this is (?:your )?bank|fraud department|internal revenue|irs|federal agent|police department|my (?:lawyer|attorney)|legal department|bank'?s security team|head (?:of )?security)\b/gi,
  },
  {
    id: "emotion",
    label: "Emotional hijack",
    why: "Panic, tears, or a family 'emergency' short-circuit rational verification. This is the classic grandparent-scam lever.",
    weight: 20,
    regex:
      /\b(i'?ve been (?:arrested|in an accident|kidnapped)|i'?m in (?:jail|prison|trouble|danger)|emergency|hospital|i'?m scared|please help me|something terrible)\b/gi,
  },
  {
    id: "callback",
    label: "Callback suppression",
    why: "Scammers block you from calling the number on your card, because a real call would end the scam.",
    weight: 22,
    regex:
      /\b(don'?t call (?:me |us |the )?(?:bank|back|the number)|stay on the line|do not hang up|can'?t receive (?:incoming )?calls|this (?:line|number) (?:is|will be) (?:going away|disconnected)|no time to call back)\b/gi,
  },
  {
    id: "verification",
    label: "Fake verification",
    why: "They 'verify' you by reading back info they stole elsewhere, then ask you to confirm the rest.",
    weight: 16,
    regex:
      /\b(for (?:verification|security) (?:purposes|reasons)|confirm your (?:identity|details|account)|verify (?:your|the) (?:identity|account|pin|ssn)|last four (?:digits|of your)|social security number|date of birth)\b/gi,
  },
];

/** Split a transcript into sentence-ish fragments with absolute offsets. */
function splitSentences(text: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = [];
  const re = /[^.!?\n]+[.!?]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    if (raw.trim().length > 0) {
      out.push({ text: raw, start: m.index });
    }
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return out;
}

export interface RedFlagScan {
  hits: RedFlagHit[];
  /** 0-100 normalized pressure score. */
  pressureScore: number;
  /** Total weight of distinct patterns found. */
  distinctPatterns: number;
}

/**
 * Scan a transcript for red-flag scam patterns. Purely local — nothing is
 * uploaded. Repeated hits of the same pattern add diminishing extra weight.
 */
export function scanRedFlags(text: string): RedFlagScan {
  if (!text || text.trim().length < 8) {
    return { hits: [], pressureScore: 0, distinctPatterns: 0 };
  }

  const sentences = splitSentences(text);
  const hits: RedFlagHit[] = [];
  const patternHitCounts = new Map<string, number>();

  for (const pattern of RED_FLAG_PATTERNS) {
    // Reset lastIndex because the patterns use the /g flag.
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(text)) !== null) {
      // Find the containing sentence for a human-readable excerpt.
      const containing = sentences.find(
        (s) => match!.index >= s.start && match!.index < s.start + s.text.length,
      );
      const excerpt = (containing?.text ?? match[0]).trim().slice(0, 160);
      const count = patternHitCounts.get(pattern.id) ?? 0;
      patternHitCounts.set(pattern.id, count + 1);
      hits.push({
        patternId: pattern.id,
        label: pattern.label,
        why: pattern.why,
        excerpt,
        start: match.index,
        end: match.index + match[0].length,
      });
      // Hard cap to keep the UI bounded on pathological input.
      if (hits.length >= 60) {
        pattern.regex.lastIndex = 0;
        break;
      }
    }
    pattern.regex.lastIndex = 0;
  }

  // Pressure score: sum each pattern's weight once, plus a small bonus per
  // extra occurrence (max +4 per pattern), normalized to 100.
  let score = 0;
  for (const p of RED_FLAG_PATTERNS) {
    const n = patternHitCounts.get(p.id) ?? 0;
    if (n > 0) {
      score += p.weight + Math.min(4, (n - 1) * 2);
    }
  }

  return {
    hits,
    pressureScore: Math.min(100, Math.round(score)),
    distinctPatterns: patternHitCounts.size,
  };
}

/** A tier for displaying pressure-score severity. */
export function pressureTier(score: number): {
  label: string;
  cls: string;
  tone: "ok" | "warn" | "bad";
} {
  if (score >= 60) {
    return {
      label: "Classic scam script",
      cls: "bg-rose-400/20 text-rose-700 border-rose-300/50",
      tone: "bad",
    };
  }
  if (score >= 25) {
    return {
      label: "Manipulation present",
      cls: "bg-amber-400/20 text-amber-700 border-amber-300/50",
      tone: "warn",
    };
  }
  return {
    label: "No pressure tactics",
    cls: "bg-emerald-400/20 text-emerald-700 border-emerald-300/50",
    tone: "ok",
  };
}
