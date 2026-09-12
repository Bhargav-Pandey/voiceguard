import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

export const verdictValidator = v.union(
  v.literal("authentic"),
  v.literal("inconclusive"),
  v.literal("synthetic"),
);
export type Verdict = Infer<typeof verdictValidator>;

export const signalStatusValidator = v.union(
  v.literal("ok"),
  v.literal("suspicious"),
  v.literal("unknown"),
);

export const scanFeaturesValidator = v.object({
  f0Hz: v.number(),
  jitterPct: v.number(),
  shimmerPct: v.number(),
  spectralFlatness: v.number(),
  spectralCentroidHz: v.number(),
  zeroCrossingRate: v.number(),
  meanEnergyDb: v.number(),
  durationSec: v.number(),
  frameCount: v.number(),
});
export type ScanFeatures = Infer<typeof scanFeaturesValidator>;

export const scanSignalValidator = v.object({
  label: v.string(),
  status: signalStatusValidator,
  weight: v.number(),
  detail: v.string(),
});
export type ScanSignal = Infer<typeof scanSignalValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Enrolled voice profiles the user claims as their own (labels only —
    // no raw audio is ever stored).
    voiceprints: defineTable({
      userId: v.id("users"),
      label: v.string(),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_label", ["userId", "label"]),

    // Completed authenticity scans (live mic or pasted transcript).
    scans: defineTable({
      userId: v.id("users"),
      source: v.union(v.literal("live"), v.literal("transcript")),
      verdict: verdictValidator,
      confidence: v.number(), // 0..100
      score: v.number(), // 0..100, higher = more human
      features: v.optional(scanFeaturesValidator),
      transcript: v.optional(v.string()),
      signals: v.array(scanSignalValidator),
      summary: v.string(),
      engine: v.string(), // "ai" or "heuristic"
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_recent", ["userId", "createdAt"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
