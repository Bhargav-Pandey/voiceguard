"use node";

import { v } from "convex/values";
import { vly } from "../lib/vly-integrations";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

interface AiSignal {
  label?: string;
  status?: string;
  detail?: string;
}

interface AiResponse {
  verdict?: string;
  confidence?: number;
  signals?: AiSignal[];
  summary?: string;
}

/**
 * AI analysis of a pasted transcript for social-engineering and
 * clone-script patterns. Uses the Vly AI gateway (server-side only).
 */
export const analyzeTranscript = action({
  args: { transcript: v.string() },
  handler: async (ctx, { transcript }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const trimmed = transcript.trim();
    if (trimmed.length < 10) {
      throw new Error("Transcript is too short to analyze (minimum 10 characters).");
    }

    const result = await vly.ai.completion({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert voice-forensics analyst for an anti-voice-cloning product. " +
            "You review transcripts of voice calls and voicemails for signs that the speaker is an AI " +
            "voice clone deployed in a social-engineering or scam scenario. " +
            'Respond ONLY with minified JSON: {"verdict":"authentic|inconclusive|synthetic",' +
            '"confidence":0-100,"signals":[{"label":string,"status":"ok|suspicious","detail":string}],' +
            '"summary":string}. ' +
            "signals must contain 3-5 entries covering: urgency or pressure tactics, requests for money, " +
            "credentials or codes, identity verification claims, unnatural phrasing or emotional flatness, " +
            "and internal consistency. Each detail under 140 chars. Summary max 220 chars.",
        },
        {
          role: "user",
          content: `TRANSCRIPT:\n"""\n${trimmed.slice(0, 4000)}\n"""`,
        },
      ],
      temperature: 0.2,
      maxTokens: 600,
    });

    if (!result.success || !result.data) {
      if (/unauthorized|invalid token|401/i.test(result.error ?? "")) {
        throw new Error(
          "The AI gateway rejected this deployment's integration key (401 Unauthorized). " +
            "Refresh VLY_INTEGRATION_KEY in the project's Keys/API keys settings and try again.",
        );
      }
      throw new Error(result.error || "AI analysis failed");
    }

    const raw = result.data.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI returned an unreadable response");

    let parsed: AiResponse;
    try {
      parsed = JSON.parse(match[0]) as AiResponse;
    } catch {
      throw new Error("AI returned an unreadable response");
    }

    const verdict =
      parsed.verdict === "synthetic"
        ? ("synthetic" as const)
        : parsed.verdict === "authentic"
          ? ("authentic" as const)
          : ("inconclusive" as const);

    const signals = (parsed.signals ?? [])
      .slice(0, 6)
      .map((s) => ({
        label: String(s.label ?? "Signal").slice(0, 60),
        status: (s.status === "suspicious" ? "suspicious" : "ok") as
          | "suspicious"
          | "ok",
        weight: s.status === "suspicious" ? 20 : 8,
        detail: String(s.detail ?? "").slice(0, 200),
      }));

    return {
      verdict,
      confidence: Math.max(0, Math.min(100, Math.round(parsed.confidence ?? 50))),
      signals,
      summary: String(parsed.summary ?? "").slice(0, 400),
      engine: "ai" as const,
    };
  },
});
