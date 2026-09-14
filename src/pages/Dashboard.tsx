import { GlassBackdrop, GlassLogo, GlassPanel, GlassPill, LiveWaveform, VerdictBadge } from "@/components/glass";
import { ScamAcademy } from "@/components/ScamAcademy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { useVoiceScanner, type VoiceFeatures } from "@/hooks/use-voice-scanner";
import {
  analyzeFeaturesClient,
  type ScanFeatures,
  type ScanResult,
} from "@/lib/analysis";
import { pressureTier, scanRedFlags } from "@/lib/scamPatterns";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  AudioLines,
  CheckCircle2,
  Download,
  FileText,
  Fingerprint,
  History,
  KeyRound,
  Loader2,
  Mic,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                 */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "primary" | "ok" | "warn" | "bad";
}) {
  const tones = {
    primary: "text-primary",
    ok: "text-emerald-600",
    warn: "text-amber-600",
    bad: "text-rose-600",
  } as const;
  return (
    <GlassPanel className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", tones[tone])}>
        {value}
      </p>
    </GlassPanel>
  );
}

function ResultCard({ result }: { result: ScanResult }) {
  return (
    <GlassPanel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <VerdictBadge verdict={result.verdict} />
          <span className="text-xs text-muted-foreground">
            {result.engine === "ai"
              ? "AI transcript analysis"
              : "Spectral analysis"}
          </span>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          Confidence {result.confidence}%
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
            <span className="text-muted-foreground">Human-likeness</span>
            <span className="tabular-nums text-foreground">
              {result.score}/100
            </span>
          </div>
          <Progress value={result.score} className="h-2" />
        </div>
        <p className="text-sm leading-6 text-foreground/90">{result.summary}</p>
      </div>

      {result.signals.length > 0 && (
        <div className="mt-4 space-y-2">
          {result.signals.map((s) => {
            const dot =
              s.status === "ok"
                ? "bg-emerald-500"
                : s.status === "suspicious"
                  ? "bg-rose-500"
                  : "bg-slate-400";
            return (
              <div
                key={s.label}
                className="glass-inset flex items-start gap-3 rounded-xl px-3 py-2.5"
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", dot)} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{s.label}</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {s.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Safe Word Vault                                                     */
/* ------------------------------------------------------------------ */

function SafeWordVaultPanel() {
  const safeWords = useQuery(api.safewords.listMine);
  const add = useMutation(api.safewords.add);
  const remove = useMutation(api.safewords.remove);
  const [label, setLabel] = useState("");
  const [word, setWord] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!label.trim() || !word.trim()) return;
    setBusy(true);
    try {
      await add({ label: label.trim(), word: word.trim() });
      setLabel("");
      setWord("");
      toast.success("Safe word added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add safe word");
    } finally {
      setBusy(false);
    }
  };

  const list = safeWords ?? [];

  return (
    <GlassPanel className="p-5 sm:p-6">
      <GlassPill>
        <KeyRound className="size-3" /> Safe Word Vault
      </GlassPill>
      <h3 className="mt-3 text-lg font-semibold">Secrets a clone can't know</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Agree on a challenge phrase with the people you trust. When "Mom" calls,
        ask for the safe word — the voice may be perfect, the memory isn't.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Protects… e.g. Mom, CFO"
          className="border-white/50 bg-white/40"
        />
        <Input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="Secret phrase"
          className="border-white/50 bg-white/40"
        />
        <Button
          onClick={submit}
          disabled={busy || !label.trim() || !word.trim()}
          className="shrink-0"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Add"}
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {list.length === 0 && (
          <p className="glass-inset rounded-xl px-3 py-3 text-sm text-muted-foreground">
            No safe words yet. Add your first — a phrase only you and the real
            person would know.
          </p>
        )}
        {list.map((sw) => (
          <div
            key={sw._id}
            className="glass-inset flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <KeyRound className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{sw.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {revealed[sw._id] ? sw.word : "••••••••"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground"
                onClick={() =>
                  setRevealed((r) => ({ ...r, [sw._id]: !r[sw._id] }))
                }
              >
                {revealed[sw._id] ? "Hide" : "Reveal"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={async () => {
                  try {
                    await remove({ id: sw._id });
                  } catch {
                    toast.error("Could not remove safe word");
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Red-flag highlighter                                                */
/* ------------------------------------------------------------------ */

function RedFlagPanel({ text }: { text: string }) {
  const scan = useMemo(() => scanRedFlags(text), [text]);

  if (text.trim().length < 12) return null;

  const tier = pressureTier(scan.pressureScore);

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GlassPill>
          <ShieldAlert className="size-3" /> Red-flag scanner
        </GlassPill>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-sm",
            tier.cls,
          )}
        >
          Pressure {scan.pressureScore}/100 · {tier.label}
        </span>
      </div>

      {scan.hits.length > 0 ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from(
              scan.hits.reduce((m, h) => {
                const entry = m.get(h.patternId) ?? { label: h.label, n: 0 };
                entry.n += 1;
                m.set(h.patternId, entry);
                return m;
              }, new Map<string, { label: string; n: number }>()),
            ).map(([id, { label, n }]) => {
              const p = scan.hits.find((h) => h.patternId === id)!;
              return (
                <span
                  key={id}
                  title={p.why}
                  className="inline-flex cursor-help items-center gap-1.5 rounded-full border border-rose-300/50 bg-rose-400/15 px-3 py-1 text-xs font-medium text-rose-700"
                >
                  <AlertTriangle className="size-3" />
                  {label}
                  {n > 1 && <span className="tabular-nums">×{n}</span>}
                </span>
              );
            })}
          </div>
          <div className="mt-3 space-y-2">
            {scan.hits.slice(0, 6).map((h, i) => (
              <div
                key={`${h.start}-${i}`}
                className="glass-inset rounded-xl px-3 py-2.5"
              >
                <p className="text-sm font-medium text-foreground">
                  &ldquo;{h.excerpt}&rdquo;
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {h.why}
                </p>
              </div>
            ))}
            {scan.hits.length > 6 && (
              <p className="text-xs text-muted-foreground">
                +{scan.hits.length - 6} more flagged phrase
                {scan.hits.length - 6 === 1 ? "" : "s"}
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="glass-inset mt-3 rounded-xl px-3 py-3 text-sm text-muted-foreground">
          No known scam phrases detected. The AI transcript analysis below still
          checks for subtler synthetic-speech tells.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Voice Shield panel (live mic scan)                                  */
/* ------------------------------------------------------------------ */

function VoiceShieldPanel() {
  const voiceprints = useQuery(api.voiceprints.listMine) ?? [];
  const record = useMutation(api.scans.record);
  const [result, setResult] = useState<ScanResult | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const handleFeatures = useCallback(
    async (features: VoiceFeatures) => {
      const scanFeatures: ScanFeatures = {
        f0Hz: features.f0Hz,
        jitterPct: features.jitterPct,
        shimmerPct: features.shimmerPct,
        spectralFlatness: features.spectralFlatness,
        spectralCentroidHz: features.spectralCentroidHz,
        zeroCrossingRate: features.zeroCrossingRate,
        meanEnergyDb: features.meanEnergyDb,
        durationSec: features.durationSec,
        frameCount: features.frameCount,
      };
      const r = analyzeFeaturesClient(scanFeatures, voiceprints.length);
      setResult(r);
      try {
        await record({
          source: "live",
          verdict: r.verdict,
          confidence: r.confidence,
          score: r.score,
          features: scanFeatures,
          signals: r.signals,
          summary: r.summary,
          engine: r.engine,
        });
      } catch (e) {
        console.error("Failed to save scan:", e);
        toast.error("Scan completed but could not be saved to history.");
      }
    },
    [record, voiceprints.length],
  );

  const scanner = useVoiceScanner(handleFeatures);
  const recording = scanner.phase === "recording";

  return (
    <GlassPanel className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <GlassPill>
            <Mic className="size-3" /> Live voice shield
          </GlassPill>
          <h3 className="mt-3 text-lg font-semibold">Scan a live voice</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Record up to 30 seconds. Audio is analyzed in your browser — only the
            numeric voice profile is kept, never the recording.
          </p>
        </div>
        <span className="glass-inset hidden rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground sm:block">
          {voiceprints.length} voiceprint{voiceprints.length === 1 ? "" : "s"}{" "}
          enrolled
        </span>
      </div>

      <div className="mt-6 flex flex-col items-center gap-4">
        <div className="relative">
          {recording && (
            <>
              <span
                className="absolute inset-0 rounded-full bg-rose-400/40"
                style={{ animation: "pulse-ring 1.6s ease-out infinite" }}
              />
              <span
                className="absolute inset-0 rounded-full bg-rose-400/30"
                style={{ animation: "pulse-ring 1.6s ease-out 0.5s infinite" }}
              />
            </>
          )}
          <button
            type="button"
            onClick={recording ? scanner.stop : scanner.start}
            disabled={
              scanner.phase === "requesting" || scanner.phase === "analyzing"
            }
            className={cn(
              "relative flex size-24 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-60",
              recording
                ? "bg-rose-500 shadow-rose-500/40"
                : "bg-gradient-to-br from-sky-500 to-indigo-500 shadow-sky-500/30",
            )}
            aria-label={recording ? "Stop recording" : "Start recording"}
          >
            {scanner.phase === "requesting" || scanner.phase === "analyzing" ? (
              <Loader2 className="size-8 animate-spin" />
            ) : recording ? (
              <Square className="size-7" />
            ) : (
              <Mic className="size-8" />
            )}
          </button>
        </div>

        <LiveWaveform active={recording} level={scanner.level} />

        <p className="text-xs tabular-nums text-muted-foreground">
          {recording
            ? `Recording… ${scanner.elapsed.toFixed(1)}s / 30.0s — tap to stop`
            : scanner.phase === "analyzing"
              ? "Analyzing spectral profile…"
              : scanner.phase === "requesting"
                ? "Waiting for microphone…"
                : "Tap the mic and speak naturally"}
        </p>

        {scanner.error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-300/50 bg-rose-400/15 px-3 py-2 text-sm text-rose-700 backdrop-blur-sm">
            <AlertTriangle className="size-4 shrink-0" />
            {scanner.error}
          </div>
        )}
      </div>

      {result && (
        <div ref={resultRef} className="mt-6">
          <ExportableResult result={result} exportRef={resultRef} />
        </div>
      )}
    </GlassPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Exportable result wrapper                                           */
/* ------------------------------------------------------------------ */

function ExportableResult({
  result,
  exportRef,
}: {
  result: ScanResult;
  exportRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [exporting, setExporting] = useState(false);

  const exportPng = async () => {
    const node = exportRef.current;
    if (!node) return;
    setExporting(true);
    try {
      const { snapdom } = await import("@zumer/snapdom");
      const canvas = await snapdom.toCanvas(node, { fast: true });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `echoguard-scan-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      toast.success("Report downloaded");
    } catch (e) {
      console.error("Export failed:", e);
      toast.error("Could not export the report image");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative">
      <ResultCard result={result} />
      <Button
        variant="outline"
        size="sm"
        onClick={exportPng}
        disabled={exporting}
        className="absolute right-3 top-3 gap-1.5 border-white/50 bg-white/50 text-xs"
      >
        {exporting ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        PNG
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Transcript analyzer (AI + safe word + red flags)                    */
/* ------------------------------------------------------------------ */

const SAMPLE_SCRIPT =
  "Hi, it's Mom. I'm in a bit of trouble and I need you to wire me $2,500 right now. " +
  "I can't talk long — the lawyer needs the payment in the next hour. Don't call me " +
  "back on this number, just send it to the account I texted you. Please don't tell Dad yet.";

function TranscriptPanel() {
  const record = useMutation(api.scans.record);
  const analyze = useAction(api.ai.analyzeTranscript);
  const safeWords = useQuery(api.safewords.listMine);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  // Local safe-word verification against the pasted transcript. The words
  // themselves stay in the vault; we check client-side for the panel display,
  // and the backend checkTranscript query provides the same logic server-side.
  const safeWordHit = useMemo(() => {
    if (!safeWords || safeWords.length === 0 || !text) return null;
    const lower = text.toLowerCase();
    const hit = safeWords.find(
      (sw) => sw.word.length >= 3 && lower.includes(sw.word.toLowerCase()),
    );
    return hit ?? null;
  }, [safeWords, text]);

  const run = async () => {
    if (text.trim().length < 10) {
      toast.error("Paste at least a short excerpt of the call transcript.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const r = await analyze({ transcript: text });
      const score =
        r.verdict === "authentic"
          ? Math.round(85 - r.confidence * 0.2)
          : r.verdict === "synthetic"
            ? Math.round(20 + (100 - r.confidence) * 0.25)
            : 50;
      const display: ScanResult = {
        verdict: r.verdict,
        confidence: r.confidence,
        score: Math.max(0, Math.min(100, score)),
        signals: r.signals,
        summary: r.summary,
        engine: r.engine,
      };
      setResult(display);
      try {
        await record({
          source: "transcript",
          verdict: r.verdict,
          confidence: r.confidence,
          score: display.score,
          transcript: text.slice(0, 2000),
          signals: r.signals,
          summary: r.summary,
          engine: r.engine,
        });
      } catch (e) {
        console.error("Failed to save scan:", e);
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "AI analysis failed. Please try again.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassPanel className="p-5 sm:p-6">
      <GlassPill>
        <FileText className="size-3" /> Transcript analyzer
      </GlassPill>
      <h3 className="mt-3 text-lg font-semibold">
        Check a suspicious call script
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste a transcript or voicemail text. Instant red-flag scanning runs in
        your browser; AI reviews it for clone-scam pressure tactics and
        unnatural phrasing.
      </p>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`e.g. "Hi, it's the bank. Your account is locked. Confirm your PIN and one-time code right now or funds will be frozen…"`}
        className="mt-4 min-h-36 resize-y border-white/50 bg-white/40 focus-visible:ring-primary/40"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={run} disabled={busy} className="gap-2">
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {busy ? "Analyzing…" : "Analyze transcript"}
        </Button>
        <Button
          variant="outline"
          onClick={() => setText(SAMPLE_SCRIPT)}
          disabled={busy}
          className="border-white/50 bg-white/30"
        >
          Load sample scam script
        </Button>
        {text && !busy && (
          <Button
            variant="ghost"
            onClick={() => {
              setText("");
              setResult(null);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {safeWords && safeWords.length > 0 && (
        <div className="mt-4">
          {safeWordHit ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-400/50 bg-emerald-400/15 px-3.5 py-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-800">
                  Safe word present — &ldquo;{safeWordHit.label}&rdquo; phrase
                  found
                </p>
                <p className="mt-0.5 text-xs text-emerald-700/80">
                  The speaker used one of your agreed challenge phrases. If this
                  is the person you think it is, verification passed.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/50 bg-amber-400/15 px-3.5 py-3">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  No safe word in this transcript
                </p>
                <p className="mt-0.5 text-xs text-amber-700/80">
                  You have {safeWords.length} safe word
                  {safeWords.length === 1 ? "" : "s"} in your vault — ask the
                  caller for it before trusting this voice.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <RedFlagPanel text={text} />

      {result && (
        <div ref={resultRef} className="mt-5">
          <ExportableResult result={result} exportRef={resultRef} />
        </div>
      )}
    </GlassPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Threat trends chart                                                 */
/* ------------------------------------------------------------------ */

function ThreatTrendsPanel() {
  const trend = useQuery(api.scans.dailyTrend, { days: 14 });

  if (trend === undefined) {
    return (
      <GlassPanel className="p-5">
        <Skeleton className="h-5 w-40 bg-white/50" />
        <Skeleton className="mt-4 h-36 w-full rounded-xl bg-white/40" />
      </GlassPanel>
    );
  }

  const max = Math.max(1, ...trend.map((d) => d.total));
  const weekTotal = trend.reduce((s, d) => s + d.total, 0);
  const weekFlagged = trend.reduce((s, d) => s + d.flagged, 0);

  return (
    <GlassPanel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GlassPill>
          <TrendingUp className="size-3" /> Threat trends
        </GlassPill>
        <span className="text-xs text-muted-foreground">
          {weekTotal} scan{weekTotal === 1 ? "" : "s"} ·{" "}
          <span className={weekFlagged > 0 ? "font-medium text-rose-600" : ""}>
            {weekFlagged} flagged
          </span>{" "}
          · last 14 days
        </span>
      </div>
      <h3 className="mt-3 text-lg font-semibold">Your verification activity</h3>

      {weekTotal === 0 ? (
        <p className="glass-inset mt-4 rounded-xl px-3 py-3 text-sm text-muted-foreground">
          No scans in the last two weeks. Run a scan and your trend chart will
          build here.
        </p>
      ) : (
        <div className="mt-4">
          <div className="flex h-36 items-end gap-1.5">
            {trend.map((d) => {
              const totalH = Math.max(4, (d.total / max) * 100);
              const flaggedH =
                d.total > 0 ? (d.flagged / d.total) * totalH : 0;
              return (
                <div
                  key={d.day}
                  className="group relative flex min-w-0 flex-1 flex-col items-center"
                  title={`${d.day}: ${d.total} scan${d.total === 1 ? "" : "s"}, ${d.flagged} flagged`}
                >
                  <div className="relative w-full max-w-6 overflow-hidden rounded-t-md bg-sky-400/40 transition-colors group-hover:bg-sky-400/60" style={{ height: `${totalH}%` }}>
                    <div
                      className="absolute inset-x-0 bottom-0 rounded-t-md bg-rose-500/80"
                      style={{ height: `${(flaggedH / totalH) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] tabular-nums text-muted-foreground">
            <span>{trend[0]?.day}</span>
            <span>{trend[trend.length - 1]?.day}</span>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-sky-400/60" /> scans
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-rose-500/80" /> flagged
              (clone or inconclusive)
            </span>
          </div>
        </div>
      )}
    </GlassPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Voiceprints                                                         */
/* ------------------------------------------------------------------ */

function VoiceprintsPanel() {
  const voiceprints = useQuery(api.voiceprints.listMine);
  const enroll = useMutation(api.voiceprints.enroll);
  const remove = useMutation(api.voiceprints.remove);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!label.trim()) return;
    setBusy(true);
    try {
      await enroll({ label: label.trim() });
      setLabel("");
      toast.success("Voiceprint enrolled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not enroll voiceprint");
    } finally {
      setBusy(false);
    }
  };

  const list = voiceprints ?? [];

  return (
    <GlassPanel className="p-5 sm:p-6">
      <GlassPill>
        <Fingerprint className="size-3" /> Voiceprints
      </GlassPill>
      <h3 className="mt-3 text-lg font-semibold">Known voices</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Register the voices you trust (yours, family, close colleagues). We store
        only the label — never audio.
      </p>

      <div className="mt-4 flex gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
          placeholder="e.g. Mom, Me, CFO"
          className="border-white/50 bg-white/40"
        />
        <Button
          onClick={add}
          disabled={busy || !label.trim()}
          className="shrink-0"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Enroll"}
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {list.length === 0 && (
          <p className="glass-inset rounded-xl px-3 py-3 text-sm text-muted-foreground">
            No voiceprints yet. Enroll your first trusted voice above.
          </p>
        )}
        {list.map((vp) => (
          <div
            key={vp._id}
            className="glass-inset flex items-center justify-between rounded-xl px-3 py-2.5"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Fingerprint className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">{vp.label}</p>
                <p className="text-xs text-muted-foreground">
                  Enrolled {new Date(vp.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={async () => {
                try {
                  await remove({ id: vp._id });
                } catch {
                  toast.error("Could not remove voiceprint");
                }
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

function HistoryPanel() {
  const scans = useQuery(api.scans.listRecent, { limit: 25 });
  const deleteScan = useMutation(api.scans.deleteScan);

  if (scans === undefined) {
    return (
      <GlassPanel className="p-5">
        <div className="space-y-3">
          <Skeleton className="h-5 w-40 bg-white/50" />
          <Skeleton className="h-14 w-full rounded-xl bg-white/40" />
          <Skeleton className="h-14 w-full rounded-xl bg-white/40" />
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="p-5 sm:p-6">
      <GlassPill>
        <History className="size-3" /> History
      </GlassPill>
      <h3 className="mt-3 text-lg font-semibold">Recent scans</h3>

      <ScrollArea className="mt-4 max-h-96 pr-2">
        <div className="space-y-2">
          {scans.length === 0 && (
            <p className="glass-inset rounded-xl px-3 py-3 text-sm text-muted-foreground">
              No scans yet. Run a live voice scan or analyze a transcript.
            </p>
          )}
          {scans.map((scan: Doc<"scans">) => (
            <div key={scan._id} className="glass-inset rounded-xl px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <VerdictBadge verdict={scan.verdict} />
                  <span className="text-xs text-muted-foreground">
                    {scan.source === "live" ? (
                      <span className="inline-flex items-center gap-1">
                        <AudioLines className="size-3" /> live
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <FileText className="size-3" /> transcript
                      </span>
                    )}
                    {" · "}
                    {new Date(scan.createdAt).toLocaleString()}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    try {
                      await deleteScan({ id: scan._id });
                    } catch {
                      toast.error("Could not delete scan");
                    }
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {scan.summary}
              </p>
              {scan.transcript && (
                <p className="mt-1 truncate text-xs text-muted-foreground/70">
                  &ldquo;{scan.transcript}&rdquo;
                </p>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </GlassPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const stats = useQuery(api.scans.stats);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen">
      <GlassBackdrop />
      <header className="sticky top-0 z-20 px-4 pt-4">
        <GlassPanel className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <GlassLogo />
            <div>
              <p className="text-sm font-semibold leading-tight">EchoGuard</p>
              <p className="text-xs text-muted-foreground">Voice clone shield</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user?.email || user?.name ? (
              <span className="hidden text-xs text-muted-foreground sm:block">
                {user.email ?? user.name}
              </span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="border-white/50 bg-white/30"
            >
              Sign out
            </Button>
          </div>
        </GlassPanel>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome{user?.name ? `, ${user.name}` : ""} — stay clone-safe
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Scan voices, check transcripts, train your instincts, and track
              every verification you run.
            </p>
          </div>
          {stats && stats.total > 0 && (
            <Badge variant="secondary" className="bg-white/40">
              {stats.total} total scan{stats.total === 1 ? "" : "s"}
            </Badge>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total scans" value={stats?.total ?? "—"} tone="primary" />
          <StatCard label="Authentic" value={stats?.authentic ?? "—"} tone="ok" />
          <StatCard
            label="Inconclusive"
            value={stats?.inconclusive ?? "—"}
            tone="warn"
          />
          <StatCard
            label="Likely clones"
            value={stats?.synthetic ?? "—"}
            tone="bad"
          />
        </div>

        <Tabs defaultValue="shield" className="mt-8">
          <TabsList className="glass-soft h-11 w-full justify-start gap-1 rounded-2xl p-1.5 sm:w-fit">
            <TabsTrigger
              value="shield"
              className="rounded-xl px-4 py-2 data-[state=active]:bg-white/70 data-[state=active]:shadow-sm"
            >
              <ShieldCheck className="size-4" /> Voice Shield
            </TabsTrigger>
            <TabsTrigger
              value="transcript"
              className="rounded-xl px-4 py-2 data-[state=active]:bg-white/70 data-[state=active]:shadow-sm"
            >
              <FileText className="size-4" /> Transcript
            </TabsTrigger>
            <TabsTrigger
              value="vault"
              className="rounded-xl px-4 py-2 data-[state=active]:bg-white/70 data-[state=active]:shadow-sm"
            >
              <KeyRound className="size-4" /> Safe Words
            </TabsTrigger>
            <TabsTrigger
              value="academy"
              className="rounded-xl px-4 py-2 data-[state=active]:bg-white/70 data-[state=active]:shadow-sm"
            >
              <Sparkles className="size-4" /> Scam Academy
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-xl px-4 py-2 data-[state=active]:bg-white/70 data-[state=active]:shadow-sm"
            >
              <History className="size-4" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="shield" className="mt-4 grid gap-5 lg:grid-cols-2">
            <VoiceShieldPanel />
            <VoiceprintsPanel />
          </TabsContent>
          <TabsContent value="transcript" className="mt-4">
            <TranscriptPanel />
          </TabsContent>
          <TabsContent value="vault" className="mt-4 grid gap-5 lg:grid-cols-2">
            <SafeWordVaultPanel />
            <ThreatTrendsPanel />
          </TabsContent>
          <TabsContent value="academy" className="mt-4">
            <ScamAcademy />
          </TabsContent>
          <TabsContent value="history" className="mt-4 grid gap-5 lg:grid-cols-2">
            <HistoryPanel />
            <ThreatTrendsPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
