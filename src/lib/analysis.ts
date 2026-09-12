export interface ScanFeatures {
  f0Hz: number;
  jitterPct: number;
  shimmerPct: number;
  spectralFlatness: number;
  spectralCentroidHz: number;
  zeroCrossingRate: number;
  meanEnergyDb: number;
  durationSec: number;
  frameCount: number;
}

export interface ScanSignal {
  label: string;
  status: "ok" | "suspicious" | "unknown";
  weight: number;
  detail: string;
}

export interface ScanResult {
  verdict: "authentic" | "inconclusive" | "synthetic";
  confidence: number;
  score: number;
  signals: ScanSignal[];
  summary: string;
  engine: "heuristic" | "ai";
}

/**
 * Score spectral features in the browser using the same thresholds as the
 * server. Keeps the instant feel of the live scan while the backend mirrors
 * the logic for saved scans.
 */
export function analyzeFeaturesClient(
  f: ScanFeatures,
  enrollments: number,
): ScanResult {
  const signals: ScanSignal[] = [];

  if (f.f0Hz > 0 && f.jitterPct > 0) {
    const suspicious = f.jitterPct < 0.15 || f.jitterPct > 4.5;
    signals.push({
      label: "Pitch micro-variation (jitter)",
      status: suspicious ? "suspicious" : "ok",
      weight: suspicious ? 30 : 12,
      detail: suspicious
        ? `${f.jitterPct.toFixed(2)}% jitter is outside the natural 0.2-2% band.`
        : `${f.jitterPct.toFixed(2)}% jitter sits in the natural range.`,
    });
  }

  if (f.shimmerPct > 0) {
    const suspicious = f.shimmerPct < 0.8 || f.shimmerPct > 8;
    signals.push({
      label: "Amplitude irregularity (shimmer)",
      status: suspicious ? "suspicious" : "ok",
      weight: suspicious ? 26 : 10,
      detail: suspicious
        ? `${f.shimmerPct.toFixed(2)}% shimmer is outside the natural 1-5% band.`
        : `${f.shimmerPct.toFixed(2)}% shimmer is consistent with natural voicing.`,
    });
  }

  if (f.spectralFlatness > 0) {
    const suspicious = f.spectralFlatness > 0.42;
    signals.push({
      label: "Harmonic spectral structure",
      status: suspicious ? "suspicious" : "ok",
      weight: suspicious ? 28 : 12,
      detail: suspicious
        ? `Flatness ${f.spectralFlatness.toFixed(2)} suggests vocoder artifacts.`
        : `Flatness ${f.spectralFlatness.toFixed(2)} shows clear harmonic peaks.`,
    });
  }

  if (f.zeroCrossingRate > 0) {
    const suspicious = f.zeroCrossingRate < 0.03 && f.f0Hz > 0;
    signals.push({
      label: "Consonant transient energy",
      status: suspicious ? "suspicious" : "ok",
      weight: suspicious ? 14 : 6,
      detail: suspicious
        ? "Very low zero-crossing rate - consonants sound over-smoothed."
        : "Consonant transients are present and unprocessed.",
    });
  }

  signals.push({
    label: "Voiceprint match",
    status: "unknown",
    weight: 0,
    detail:
      enrollments > 0
        ? `Compared against ${enrollments} enrolled voiceprint${enrollments === 1 ? "" : "s"}.`
        : "No voiceprints enrolled yet - enroll one to unlock match alerts.",
  });

  const totalWeight = signals.reduce((s, x) => s + x.weight, 0);
  const suspiciousWeight = signals
    .filter((s) => s.status === "suspicious")
    .reduce((s, x) => s + x.weight, 0);
  const raw = totalWeight > 0 ? (suspiciousWeight / totalWeight) * 100 : 0;

  const confidence = Math.min(88, Math.max(35, Math.round(raw + 30)));
  const score = Math.round(100 - raw);

  const verdict: ScanResult["verdict"] =
    raw >= 45 ? "synthetic" : raw >= 20 ? "inconclusive" : "authentic";

  const summary =
    verdict === "synthetic"
      ? "Multiple spectral markers deviate from natural voicing. Treat this audio as a likely clone and verify the speaker out-of-band."
      : verdict === "inconclusive"
        ? "Some markers are borderline. Ask the speaker a dynamic question or request a live callback before trusting the audio."
        : "Spectral markers fall within natural human ranges. No strong evidence of synthesis detected.";

  return {
    verdict,
    confidence,
    score,
    signals: signals.map((s) => ({ ...s, weight: Math.round(s.weight) })),
    summary,
    engine: "heuristic",
  };
}
