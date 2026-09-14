"use node";

import { v } from "convex/values";
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

// xAI API configuration. The API key lives in the backend environment
// (XAI_API_KEY) and is never sent to the client or logged.
const XAI_API_URL = "https://api.x.ai/v1/chat/completions";
const XAI_MODEL = "grok-4.6";
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Returns the configured xAI API key, throwing a clear error when it is
 * missing. The value itself is never logged or returned to the client.
 */
function getXaiApiKey(): string {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "XAI_API_KEY is not configured on this deployment. " +
        "Add it in the project's Keys/API keys settings and try again.",
    );
  }
  return key;
}

interface XaiChatCompletion {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

/**
 * AI analysis of a pasted transcript for social-engineering and
 * clone-script patterns. Calls the xAI (Grok) API directly, server-side only.
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

    // Fail fast with a clear message when the key is missing, instead of the
    // API returning an opaque 401.
    const apiKey = getXaiApiKey();

    let response: Response;
    try {
      response = await fetch(XAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: XAI_MODEL,
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
          max_tokens: 2000,
          stream: false,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/abort|timeout/i.test(message)) {
        throw new Error("The AI analysis request timed out. Please try again.");
      }
      throw new Error("AI analysis failed: " + message);
    }

    if (!response.ok) {
      // Read the error body for a message, but never include the auth header.
      let detail = "";
      try {
        const body = (await response.json()) as XaiChatCompletion;
        detail = body?.error?.message ?? "";
      } catch {
        detail = "";
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "The xAI API rejected this deployment's API key (" +
            response.status +
            "). Verify XAI_API_KEY in the project's Keys/API keys settings, then try again.",
        );
      }
      if (response.status === 429) {
        throw new Error(
          "The xAI API rate limit was reached. Please wait a moment and try again.",
        );
      }
      throw new Error(
        `AI analysis failed (HTTP ${response.status})` +
          (detail ? `: ${detail.slice(0, 200)}` : ""),
      );
    }

    const data = (await response.json()) as XaiChatCompletion;
    const raw = data.choices?.[0]?.message?.content ?? "";
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
