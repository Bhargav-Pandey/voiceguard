import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

/** Enroll a labeled voiceprint for the signed-in user (metadata only). */
export const enroll = mutation({
  args: { label: v.string() },
  handler: async (ctx, { label }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const trimmed = label.trim().slice(0, 60);
    if (!trimmed) throw new Error("Give this voice a name");

    const existing = await ctx.db
      .query("voiceprints")
      .withIndex("by_user_label", (q) =>
        q.eq("userId", userId).eq("label", trimmed),
      )
      .first();
    if (existing) throw new Error("You already enrolled a voice with this name");

    const id = await ctx.db.insert("voiceprints", {
      userId,
      label: trimmed,
      createdAt: Date.now(),
    });
    return id;
  },
});

/** List the signed-in user's enrolled voiceprints. */
export const listMine = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("voiceprints")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/** Remove a voiceprint (owner only). */
export const remove = mutation({
  args: { id: v.id("voiceprints") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const vp = await ctx.db.get(id);
    if (!vp || vp.userId !== userId) throw new Error("Voiceprint not found");
    await ctx.db.delete(id);
  },
});
