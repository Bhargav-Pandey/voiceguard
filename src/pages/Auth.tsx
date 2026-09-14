import { GlassBackdrop, GlassLogo, GlassPill } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowRight,
  AudioLines,
  Loader2,
  Mail,
  ShieldCheck,
  UserX,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("The verification code you entered is incorrect.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      setError(
        `Failed to sign in as guest: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <GlassBackdrop />
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <div className="mb-8 flex flex-col items-center">
          <GlassLogo className="size-14 rounded-2xl" />
          <p className="mt-3 text-lg font-bold tracking-tight">VoiceGuard</p>
          <p className="text-xs text-muted-foreground">AI voice clone shield</p>
        </div>

        <div className="glass-strong w-full max-w-md rounded-3xl p-7 sm:p-8">
          {step === "signIn" ? (
            <>
              <GlassPill>
                <ShieldCheck className="size-3" /> Welcome
              </GlassPill>
              <h1 className="mt-3 text-2xl font-bold tracking-tight">
                Sign in to your shield
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Enter your email to log in or create an account.
              </p>

              <form onSubmit={handleEmailSubmit} className="mt-6">
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-medium text-muted-foreground"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    placeholder="name@example.com"
                    type="email"
                    autoComplete="email"
                    className="border-white/50 bg-white/40 pl-9"
                    disabled={isLoading}
                    required
                  />
                </div>
                {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

                <Button
                  type="submit"
                  className="mt-5 h-11 w-full rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 shadow-lg shadow-sky-500/25"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Sending code…
                    </>
                  ) : (
                    <>
                      Continue with email <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/50" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-transparent px-3 text-xs uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
                    or
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl border-white/60 bg-white/30"
                onClick={handleGuestLogin}
                disabled={isLoading}
              >
                <UserX className="size-4" />
                Continue as guest
              </Button>

              <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <AudioLines className="size-3.5" />
                Your audio never leaves this device — only verdicts are stored.
              </p>
            </>
          ) : (
            <>
              <GlassPill>
                <Mail className="size-3" /> Verification
              </GlassPill>
              <h1 className="mt-3 text-2xl font-bold tracking-tight">
                Check your email
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                We sent a 6-digit code to{" "}
                <span className="font-medium text-foreground">
                  {step.email}
                </span>
                .
              </p>

              <form onSubmit={handleOtpSubmit} className="mt-6">
                <input type="hidden" name="email" value={step.email} />
                <input type="hidden" name="code" value={otp} />

                <div className="flex justify-center [&_*]:border-white/60">
                  <InputOTP
                    value={otp}
                    onChange={setOtp}
                    maxLength={6}
                    disabled={isLoading}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        otp.length === 6 &&
                        !isLoading
                      ) {
                        const form = (e.target as HTMLElement).closest("form");
                        if (form) form.requestSubmit();
                      }
                    }}
                  >
                    <InputOTPGroup>
                      {Array.from({ length: 6 }).map((_, index) => (
                        <InputOTPSlot key={index} index={index} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {error && (
                  <p className="mt-3 text-center text-sm text-rose-600">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="mt-5 h-11 w-full rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 shadow-lg shadow-sky-500/25"
                  disabled={isLoading || otp.length !== 6}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Verifying…
                    </>
                  ) : (
                    <>
                      Verify code <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-2 w-full rounded-xl"
                  onClick={() => setStep("signIn")}
                  disabled={isLoading}
                >
                  Use a different email
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Didn&apos;t get it?{" "}
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => setStep("signIn")}
                  >
                    Resend code
                  </button>
                </p>
              </form>
            </>
          )}
        </div>

        <Link
          to="/"
          className="mt-6 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
