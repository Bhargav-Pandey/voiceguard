import { cn } from "@/lib/utils";
import { AudioWaveform, CheckCircle2, HelpCircle, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

/** Fixed, animated cool-gradient scene that sits behind all glass panels. */
export function GlassBackdrop() {
  return <div className="app-bg" aria-hidden="true" />;
}

/** Frosted panel with edge highlight. */
export function GlassPanel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("glass rounded-2xl", className)}>{children}</div>
  );
}

/** Softer frosted panel for secondary surfaces. */
export function GlassSoft({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("glass-soft rounded-2xl", className)} {...rest}>
      {children}
    </div>
  );
}

/** Small pill for eyebrow labels. */
export function GlassPill({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "glass-inset inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-primary",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Brand mark: frosted rounded square with a waveform glyph. */
export function GlassLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "glass-strong inline-flex items-center justify-center rounded-2xl text-primary",
        className,
      )}
    >
      <AudioWaveform className="size-5" />
    </span>
  );
}

/** Live-level equalizer bars used while recording. */
export function LiveWaveform({
  active,
  bars = 24,
  level = 0,
  className,
}: {
  active: boolean;
  bars?: number;
  /** 0..1 live input level */
  level?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex h-10 items-end justify-center gap-1", className)}>
      {Array.from({ length: bars }).map((_, i) => {
        const wave = Math.abs(Math.sin((i / bars) * Math.PI * 3));
        const h = active
          ? Math.max(12, Math.min(100, (0.25 + level * 0.75) * (28 + wave * 72)))
          : 18;
        return (
          <span
            key={i}
            className={cn(
              "w-1.5 rounded-full bg-primary/70 transition-[height] duration-150",
              active ? "opacity-95" : "opacity-40",
            )}
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  );
}

/** Verdict chip with icon and tone. */
export function VerdictBadge({ verdict }: { verdict: "authentic" | "inconclusive" | "synthetic" }) {
  const map = {
    authentic: {
      icon: CheckCircle2,
      label: "Authentic",
      cls: "bg-emerald-400/20 text-emerald-700 border-emerald-300/50",
    },
    inconclusive: {
      icon: HelpCircle,
      label: "Inconclusive",
      cls: "bg-amber-400/20 text-amber-700 border-amber-300/50",
    },
    synthetic: {
      icon: ShieldAlert,
      label: "Likely clone",
      cls: "bg-rose-400/20 text-rose-700 border-rose-300/50",
    },
  } as const;
  const { icon: Icon, label, cls } = map[verdict];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-sm",
        cls,
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}
