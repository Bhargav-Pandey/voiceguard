import { useCallback, useEffect, useRef, useState } from "react";

export interface VoiceFeatures {
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

export type ScannerPhase =
  | "idle"
  | "requesting"
  | "recording"
  | "analyzing"
  | "error";

const MAX_DURATION_MS = 30_000;
const RMS_GATE = 0.008;
const PITCH_DOWNSAMPLE = 3;

interface Frame {
  rms: number;
  zcr: number;
  f0: number;
  centroid: number;
  flatness: number;
}

/** Normalized autocorrelation pitch estimate. Returns 0 for unvoiced frames. */
function detectF0(buf: Float32Array, sampleRate: number): number {
  let energy = 0;
  for (let i = 0; i < buf.length; i++) energy += buf[i] * buf[i];
  if (energy / buf.length < RMS_GATE * RMS_GATE) return 0;

  const step = PITCH_DOWNSAMPLE;
  const n = Math.floor(buf.length / step);
  const small = new Float32Array(n);
  for (let i = 0; i < n; i++) small[i] = buf[i * step];
  const sr = sampleRate / step;

  const minLag = Math.max(2, Math.floor(sr / 400));
  const maxLag = Math.min(n - 2, Math.floor(sr / 60));
  if (maxLag <= minLag) return 0;

  const window = n - maxLag;
  let winEnergy = 0;
  for (let i = 0; i < window; i++) winEnergy += small[i] * small[i];
  if (winEnergy < 1e-9) return 0;

  let bestLag = -1;
  let bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let lagEnergy = 0;
    for (let i = 0; i < window; i++) {
      corr += small[i] * small[i + lag];
      lagEnergy += small[i + lag] * small[i + lag];
    }
    const denom = Math.sqrt(winEnergy * lagEnergy);
    const c = denom > 1e-9 ? corr / denom : 0;
    if (c > bestCorr) {
      bestCorr = c;
      bestLag = lag;
    }
  }
  if (bestLag < 0 || bestCorr < 0.55) return 0;
  return sr / bestLag;
}

function analyzeFrame(
  time: Float32Array,
  freqDb: Float32Array,
  sampleRate: number,
): Frame {
  // Time-domain stats
  let sumSq = 0;
  let crossings = 0;
  for (let i = 0; i < time.length; i++) {
    sumSq += time[i] * time[i];
    if (i > 0 && (time[i] >= 0) !== (time[i - 1] >= 0)) crossings++;
  }
  const rms = Math.sqrt(sumSq / time.length);
  const zcr = crossings / (time.length - 1);
  const f0 = detectF0(time, sampleRate);

  // Frequency-domain stats over the speech band
  const binHz = sampleRate / (freqDb.length * 2);
  const lowBin = Math.max(1, Math.floor(80 / binHz));
  const highBin = Math.min(freqDb.length - 1, Math.floor(8000 / binHz));
  let magSum = 0;
  let logSum = 0;
  let weighted = 0;
  let count = 0;
  for (let i = lowBin; i <= highBin; i++) {
    const db = freqDb[i];
    if (!Number.isFinite(db)) continue;
    const mag = Math.pow(10, db / 20) + 1e-9;
    magSum += mag;
    logSum += Math.log(mag);
    weighted += mag * i * binHz;
    count++;
  }
  const centroid = count > 0 && magSum > 0 ? weighted / magSum : 0;
  const geomean = count > 0 ? Math.exp(logSum / count) : 0;
  const arithmean = count > 0 ? magSum / count : 0;
  const flatness = arithmean > 0 ? geomean / arithmean : 0;

  return { rms, zcr, f0, centroid, flatness };
}

function computeFeatures(frames: Frame[], durationSec: number): VoiceFeatures | null {
  const voiced = frames.filter((f) => f.f0 > 0);
  if (voiced.length < 8) return null;

  const meanF0 = voiced.reduce((s, f) => s + f.f0, 0) / voiced.length;
  const meanRmsVoiced =
    voiced.reduce((s, f) => s + f.rms, 0) / voiced.length;

  // Jitter/shimmer over consecutive voiced frames (period-to-period perturbation)
  let jitterSum = 0;
  let jitterCount = 0;
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].f0 > 0 && frames[i - 1].f0 > 0) {
      jitterSum += Math.abs(frames[i].f0 - frames[i - 1].f0);
      jitterCount++;
    }
  }
  const jitterPct =
    jitterCount > 0 && meanF0 > 0 ? (jitterSum / jitterCount / meanF0) * 100 : 0;

  let shimmerSum = 0;
  let shimmerCount = 0;
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].f0 > 0 && frames[i - 1].f0 > 0) {
      shimmerSum += Math.abs(frames[i].rms - frames[i - 1].rms);
      shimmerCount++;
    }
  }
  const shimmerPct =
    shimmerCount > 0 && meanRmsVoiced > 0
      ? (shimmerSum / shimmerCount / meanRmsVoiced) * 100
      : 0;

  const flatFrames = voiced.filter((f) => f.flatness > 0);
  const spectralFlatness =
    flatFrames.length > 0
      ? flatFrames.reduce((s, f) => s + f.flatness, 0) / flatFrames.length
      : 0;
  const centroidFrames = voiced.filter((f) => f.centroid > 0);
  const spectralCentroidHz =
    centroidFrames.length > 0
      ? centroidFrames.reduce((s, f) => s + f.centroid, 0) / centroidFrames.length
      : 0;

  const active = frames.filter((f) => f.rms > RMS_GATE);
  const zeroCrossingRate =
    active.length > 0
      ? active.reduce((s, f) => s + f.zcr, 0) / active.length
      : 0;

  const meanEnergyDb = Math.max(
    -60,
    Math.min(0, 20 * Math.log10(meanRmsVoiced || 1e-6)),
  );

  return {
    f0Hz: Math.round(meanF0 * 10) / 10,
    jitterPct: Math.round(jitterPct * 100) / 100,
    shimmerPct: Math.round(shimmerPct * 100) / 100,
    spectralFlatness: Math.round(spectralFlatness * 1000) / 1000,
    spectralCentroidHz: Math.round(spectralCentroidHz),
    zeroCrossingRate: Math.round(zeroCrossingRate * 1000) / 1000,
    meanEnergyDb: Math.round(meanEnergyDb * 10) / 10,
    durationSec: Math.round(durationSec * 10) / 10,
    frameCount: frames.length,
  };
}

/**
 * Captures microphone audio and extracts voice-quality features live.
 * No audio is stored or uploaded — only the numeric summary survives.
 */
export function useVoiceScanner(
  onComplete: (features: VoiceFeatures) => void,
) {
  const [phase, setPhase] = useState<ScannerPhase>("idle");
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const framesRef = useRef<Frame[]>([]);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startRef = useRef(0);
  const tickRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (ctxRef.current && ctxRef.current.state !== "closed") {
      void ctxRef.current.close();
    }
    ctxRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const finish = useCallback(() => {
    cleanup();
    const duration = (performance.now() - startRef.current) / 1000;
    const features = computeFeatures(framesRef.current, duration);
    framesRef.current = [];
    if (!features) {
      setPhase("error");
      setError(
        "No clear speech detected. Try again a little louder, closer to the mic.",
      );
      return;
    }
    // Analysis is instant and local; return to idle so the mic can be used
    // again right away. The caller displays the result from its own state.
    onCompleteRef.current(features);
    setPhase("idle");
  }, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setLevel(0);
    setElapsed(0);
    framesRef.current = [];
    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);

      const timeBuf = new Float32Array(analyser.fftSize);
      const freqBuf = new Float32Array(analyser.frequencyBinCount);
      startRef.current = performance.now();
      tickRef.current = 0;
      setPhase("recording");

      const loop = () => {
        const ctxNow = ctxRef.current;
        if (!ctxNow) return;
        const now = performance.now();
        const elapsedMs = now - startRef.current;
        setElapsed(elapsedMs / 1000);
        if (elapsedMs >= MAX_DURATION_MS) {
          finish();
          return;
        }
        analyser.getFloatTimeDomainData(timeBuf);
        analyser.getFloatFrequencyData(freqBuf);
        const frame = analyzeFrame(timeBuf, freqBuf, ctxNow.sampleRate);
        framesRef.current.push(frame);
        setLevel(Math.min(1, frame.rms * 7));
        tickRef.current++;
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      cleanup();
      setPhase("error");
      setError(
        e instanceof Error
          ? e.message
          : "Could not access the microphone. Check browser permissions.",
      );
    }
  }, [cleanup, finish]);

  const stop = useCallback(() => {
    if (phase === "recording") finish();
  }, [phase, finish]);

  const reset = useCallback(() => {
    setPhase("idle");
    setError(null);
    setLevel(0);
    setElapsed(0);
  }, []);

  return { phase, level, elapsed, error, start, stop, reset };
}
