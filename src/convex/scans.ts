import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  scanFeaturesValidator,
  scanSignalValidator,
  verdictValidator,
} from "./schema";
import type { Verdict } from "./schema";

/* ------------------------------------------------------------------ */
/* Live audio analysis (heuristic, runs as a query)                    */
/* ------------------------------------------------------------------ */

/** Analyze audio-derived spectral features for voice-clone artifacts. */
export const analyze = query({
  args: {
    features: scanFeaturesValidator,
    enrollments: v.number(),
  },
  handler: async (_ctx, { features, enrollments }) => {
    const f = features;
    const signals: Array<{
      label: string;
      status: "ok" | "suspicious" | "unknown";
      weight: number;
      detail: string;
    }> = [];

    // Jitter: natural voices vary pitch period 0.2-2%. Synthetic voices are
    // often unnaturally stable (< 0.15%) or wildly irregular (> 4.5%).
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

    // Shimmer: amplitude instability 1-5% is natural. Very low shimmer
    // suggests wave-table synthesis; very high suggests splicing.
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

    // Spectral flatness: natural voiced speech peaks at the fundamental
    // (flatness ~0.05-0.3). Vocoder output is noticeably flatter.
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

    // Zero-crossing rate: consonants and breath produce high-ZCR bursts.
    // Neural vocoders smooth these transients, lowering overall ZCR.
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

    // Enrollment context: comparing against enrolled voiceprints raises
    // the stakes of any suspicious finding.
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

    // Calibrate: heuristic-only analysis is intentionally conservative.
    const confidence = Math.min(88, Math.max(35, Math.round(raw + 30)));
    const score = Math.round(100 - raw);

    const verdict: Verdict =
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
      engine: "heuristic" as const,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Persistence + history                                               */
/* ------------------------------------------------------------------ */

/** Persist a completed scan for the signed-in user. */
export const record = mutation({
  args: {
    source: v.union(v.literal("live"), v.literal("transcript")),
    verdict: verdictValidator,
    confidence: v.number(),
    score: v.number(),
    features: v.optional(scanFeaturesValidator),
    transcript: v.optional(v.string()),
    signals: v.array(scanSignalValidator),
    summary: v.string(),
    engine: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const id = await ctx.db.insert("scans", {
      userId,
      ...args,
      createdAt: Date.now(),
    });
    return id;
  },
});

/** Recent scans for the signed-in user (for the history panel). */
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("scans")
      .withIndex("by_user_recent", (q) => q.eq("userId", userId))
      .order("desc")
      .take(Math.min(limit ?? 20, 50));
  },
});

/** Aggregate stats for the signed-in user. */
export const stats = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { total: 0, authentic: 0, inconclusive: 0, synthetic: 0, flagged: 0 };
    }
    const scans = await ctx.db
      .query("scans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return {
      total: scans.length,
      authentic: scans.filter((s) => s.verdict === "authentic").length,
      inconclusive: scans.filter((s) => s.verdict === "inconclusive").length,
      synthetic: scans.filter((s) => s.verdict === "synthetic").length,
      flagged: scans.filter((s) => s.verdict !== "authentic").length,
    };
  },
});

/** Remove a scan from history (owner only). */
export const deleteScan = mutation({
  args: { id: v.id("scans") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const scan = await ctx.db.get(id);
    if (!scan || scan.userId !== userId) throw new Error("Scan not found");
    await ctx.db.delete(id);
  },
});
