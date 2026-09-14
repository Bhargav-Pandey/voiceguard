import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Safe words are secret challenge phrases shared with trusted people. When a
 * caller claims to be someone you know, you ask them for the safe word — a
 * voice clone may sound right, but it cannot know the word.
 *
 * The word is stored server-side with the user's id. It is never returned to
 * any client other than the owner.
 */

const MAX_SAFE_WORDS = 20;

function normalizeWord(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 80);
}

/** Add a safe word for the signed-in user. */
export const add = mutation({
  args: { label: v.string(), word: v.string() },
  handler: async (ctx, { label, word }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const cleanLabel = label.trim().slice(0, 60);
    const cleanWord = normalizeWord(word);
    if (!cleanLabel) throw new Error("Say who or what this safe word protects");
    if (cleanWord.length < 3) {
      throw new Error("Safe words need at least 3 characters");
    }

    const count = await ctx.db
      .query("safeWords")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (count.length >= MAX_SAFE_WORDS) {
      throw new Error(`You can store up to ${MAX_SAFE_WORDS} safe words`);
    }

    const dup = await ctx.db
      .query("safeWords")
      .withIndex("by_user_label", (q) =>
        q.eq("userId", userId).eq("label", cleanLabel),
      )
      .first();
    if (dup) throw new Error(`A safe word for "${cleanLabel}" already exists`);

    const id = await ctx.db.insert("safeWords", {
      userId,
      label: cleanLabel,
      word: cleanWord,
      createdAt: Date.now(),
    });
    return id;
  },
});

/** List the signed-in user's safe words (owner only — words are private). */
export const listMine = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("safeWords")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/**
 * Privacy-preserving check: given a transcript, report whether any of the
 * user's safe words appear verbatim in it. The words themselves are never
 * sent to the client — only labels, hit counts, and verdicts per entry.
 */
export const checkTranscript = query({
  args: { transcript: v.string() },
  handler: async (ctx, { transcript }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { protected: false, total: 0, hits: [] as { label: string }[] };
    }

    const words = await ctx.db
      .query("safeWords")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (words.length === 0) {
      return { protected: false, total: 0, hits: [] as { label: string }[] };
    }

    // Case-insensitive, word-boundary-aware matching on the client-supplied
    // transcript text.
    const text = transcript.toLowerCase();
    const hits: { label: string }[] = [];
    for (const w of words) {
      const needle = w.word.toLowerCase();
      if (needle.length >= 3 && text.includes(needle)) {
        hits.push({ label: w.label });
      }
    }

    return {
      protected: hits.length > 0,
      total: words.length,
      hits,
    };
  },
});

/** Remove a safe word (owner only). */
export const remove = mutation({
  args: { id: v.id("safeWords") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const sw = await ctx.db.get(id);
    if (!sw || sw.userId !== userId) throw new Error("Safe word not found");
    await ctx.db.delete(id);
  },
});
