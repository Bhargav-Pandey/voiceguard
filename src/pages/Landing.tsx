import {
  GlassBackdrop,
  GlassLogo,
  GlassPanel,
  GlassPill,
  LiveWaveform,
} from "@/components/glass";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BellRing,
  BrainCircuit,
  CheckCircle2,
  FileSearch,
  Fingerprint,
  GraduationCap,
  KeyRound,
  Lock,
  Mic,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";
import { Link } from "react-router";

const features = [
  {
    icon: Waves,
    title: "Live spectral analysis",
    body: "Real-time detection of clone artifacts — jitter, shimmer, and vocoder signatures scored while the person is still talking.",
  },
  {
    icon: FileSearch,
    title: "Transcript forensics",
    body: "Paste a voicemail or call transcript. AI flags urgency scripts, payment pressure, and phrasing that betrays a synthetic speaker.",
  },
  {
    icon: ShieldAlert,
    title: "Red-flag phrase scanner",
    body: "Eight scam-script patterns — urgency, OTP requests, wire pressure, secrecy demands — highlighted in your transcript before you even run the AI check.",
  },
  {
    icon: KeyRound,
    title: "Safe Word Vault",
    body: "Agree on secret challenge phrases with the people you trust. A clone can copy the voice; it can't answer the question only real Mom would know.",
  },
  {
    icon: GraduationCap,
    title: "Scam Academy",
    body: "Two-minute drills built from real voice-fraud playbooks. Train your instincts to spot the levers — emotion, secrecy, urgency — before the call comes.",
  },
  {
    icon: Fingerprint,
    title: "Trusted voiceprints",
    body: "Register the voices that matter — family, finance, execs. Get match alerts the moment a call claims to be them.",
  },
  {
    icon: BellRing,
    title: "Instant verdicts & reports",
    body: "Authentic, inconclusive, or likely clone — with confidence scores, plain-language reasons, and a one-tap PNG report you can share with family or the bank.",
  },
  {
    icon: Lock,
    title: "Private by design",
    body: "Audio never leaves your device. Analysis runs in your browser and only the numeric profile is stored — never the recording.",
  },
  {
    icon: BrainCircuit,
    title: "Always learning",
    body: "Every scan refines your baseline and builds your 14-day threat trend. The more you verify, the sharper your personal clone shield becomes.",
  },
];

const steps = [
  {
    n: "01",
    title: "Enroll trusted voices",
    body: "Label the voices you can't afford to fake — yours, your parents, your CFO.",
  },
  {
    n: "02",
    title: "Scan when it matters",
    body: "Run a 30-second live scan or paste a transcript before you trust an urgent call.",
  },
  {
    n: "03",
    title: "Act on the verdict",
    body: "Get a clear authentic / inconclusive / clone call with reasons — then verify out-of-band.",
  },
];

const stats = [
  { value: "$890M", label: "lost to voice-clone fraud in 2025 alone" },
  { value: "3 sec", label: "of audio is enough to clone a voice" },
  { value: "<1 min", label: "for EchoGuard to score a live call" },
];

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const primaryHref = isAuthenticated ? "/dashboard" : "/auth";

  return (
    <div className="relative min-h-screen">
      <GlassBackdrop />

      {/* Nav */}
      <header className="sticky top-0 z-30 px-4 pt-4">
        <GlassPanel className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <GlassLogo />
            <span className="text-base font-bold tracking-tight">EchoGuard</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#stats" className="transition-colors hover:text-foreground">
              Why now
            </a>
          </nav>
          <Button asChild className="rounded-xl">
            <Link to={primaryHref}>
              {isAuthenticated ? "Open app" : "Get protected"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </GlassPanel>
      </header>

      {/* Hero */}
      <section className="px-4 pb-16 pt-14 sm:pt-20">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mx-auto max-w-3xl text-center"
          >
            <GlassPill className="mx-auto">
              <Sparkles className="size-3" />
              AI voice-clone defense for families & teams
            </GlassPill>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-6xl">
              Know if that voice is{" "}
              <span className="bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500 bg-clip-text text-transparent">
                really them
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Voice cloning scams are rising fast. EchoGuard listens for the
              artifacts synthetic speech leaves behind — and gives you a clear
              verdict before you send money, codes, or trust.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-7 text-base shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40"
              >
                <Link to={primaryHref}>
                  <Mic className="size-5" />
                  Scan a voice now
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-xl border-white/60 bg-white/40 px-7 text-base backdrop-blur"
              >
                <a href="#how">
                  See how it works
                  <ArrowRight className="size-4" />
                </a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Free to start · No audio ever leaves your device
            </p>
          </motion.div>

          {/* Hero visual */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
            className="relative mx-auto mt-14 max-w-4xl"
          >
            <div className="glass-strong relative overflow-hidden rounded-3xl p-6 sm:p-8">
              <div
                className="pointer-events-none absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-sky-400/10 to-transparent"
                style={{ animation: "scan-sweep 4.5s linear infinite" }}
              />
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <span
                      className="absolute inset-0 rounded-full bg-sky-400/30"
                      style={{ animation: "pulse-ring 2.2s ease-out infinite" }}
                    />
                    <span className="relative flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-500/30">
                      <Mic className="size-6" />
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Analyzing caller
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Unknown number · claims to be “Mom”
                    </p>
                  </div>
                </div>
                <Badge className="w-fit border-rose-300/50 bg-rose-400/20 text-rose-700 backdrop-blur-sm">
                  <ShieldCheck className="size-3.5" /> Likely clone · 87% confidence
                </Badge>
              </div>

              <div className="mt-6">
                <LiveWaveform active bars={40} level={0.55} className="h-14" />
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Jitter", value: "0.08%", bad: true },
                  { label: "Shimmer", value: "0.61%", bad: true },
                  { label: "Harmonics", value: "Flattened", bad: true },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="glass-inset rounded-xl px-4 py-3 text-center"
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {m.label}
                    </p>
                    <p
                      className={`mt-1 text-lg font-bold ${m.bad ? "text-rose-600" : "text-emerald-600"}`}
                    >
                      {m.value}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                “Trust the callback, not the caller. Verify out-of-band before
                acting.”
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="px-4 py-10">
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <GlassPanel key={s.value} className="p-6 text-center">
              <p className="text-3xl font-extrabold tracking-tight text-primary">
                {s.value}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </GlassPanel>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <GlassPill className="mx-auto">
              <Waves className="size-3" /> Capabilities
            </GlassPill>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              A shield built for real conversations
            </h2>
            <p className="mt-3 text-muted-foreground">
              Forensic-grade signals, translated into a verdict anyone can act
              on in seconds.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
              >
                <GlassPanel className="group h-full p-6 transition-transform duration-300 hover:-translate-y-1">
                  <span className="glass-inset inline-flex size-11 items-center justify-center rounded-xl text-primary">
                    <f.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {f.body}
                  </p>
                </GlassPanel>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <GlassPill className="mx-auto">
              <CheckCircle2 className="size-3" /> How it works
            </GlassPill>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Three steps to clone-proof
            </h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="relative"
              >
                <GlassPanel className="h-full p-6">
                  <span className="text-4xl font-extrabold text-primary/25">
                    {s.n}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {s.body}
                  </p>
                </GlassPanel>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 pt-8">
        <div className="mx-auto max-w-4xl">
          <GlassPanel className="relative overflow-hidden p-10 text-center sm:p-14">
            <div
              className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl"
              style={{ animation: "float-slow 8s ease-in-out infinite" }}
            />
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              The next “urgent” call could be a clone.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Arm yourself with a verdict in under a minute. Enroll your trusted
              voices and scan the next suspicious call free.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 h-12 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-8 text-base shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40"
            >
              <Link to={primaryHref}>
                <Mic className="size-5" />
                Start scanning free
              </Link>
            </Button>
          </GlassPanel>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 pb-10">
        <GlassPanel className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-5 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <GlassLogo className="size-7 rounded-lg" />
            <span className="font-semibold text-foreground">EchoGuard</span>
            <span className="text-xs">© {new Date().getFullYear()}</span>
          </div>
          <p className="text-xs">
            EchoGuard provides risk signals, not legal certification. Always
            verify sensitive requests out-of-band.
          </p>
        </GlassPanel>
      </footer>
    </div>
  );
}
