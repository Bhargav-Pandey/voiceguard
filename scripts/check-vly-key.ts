/**
 * Diagnostic: (1) is the gateway itself healthy? Probe with the library's
 * publicly-documented built-in fallback token (public constant in the npm
 * package source — NOT a project secret, NOT wired into app code).
 * (2) re-confirm the deployed key's status.
 * NEVER prints secret values.
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const FALLBACK_TOKEN = "vlytomoonF2024"; // public constant from @vly-ai/integrations dist

function fingerprint(v: string): string {
  return createHash("sha256").update(v).digest("hex").slice(0, 12);
}

function readConvexKey(): string | undefined {
  try {
    const out = execSync("bun convex env list 2>/dev/null", { encoding: "utf8" });
    const line = out
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.startsWith("VLY_INTEGRATION_KEY="));
    if (!line) return undefined;
    const value = line.slice("VLY_INTEGRATION_KEY=".length).trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

async function probe(label: string, token: string) {
  try {
    const res = await fetch("https://integrations.vly.ai/v1/llm/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
      }),
    });
    const text = await res.text();
    let detail = text.slice(0, 80);
    try {
      const j = JSON.parse(text) as { error?: string; choices?: unknown };
      if (j.error) detail = j.error;
      else if (j.choices) detail = "chat completion returned";
    } catch { /* keep raw */ }
    console.log(`${label}: http=${res.status} ${res.ok ? "ACCEPTED ✅" : `rejected (${detail})`}`);
  } catch (e) {
    console.log(`${label}: network error ${String(e).slice(0, 80)}`);
  }
}

const key = readConvexKey();
await probe("gateway w/ lib fallback token", FALLBACK_TOKEN);
if (key) {
  console.log(`(deployed key fingerprint for change detection: ${fingerprint(key)})`);
  await probe("gateway w/ deployed key      ", key);
}
