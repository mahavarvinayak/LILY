"use client";

import { useEffect, useState, type FormEvent, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LilyLogo } from "@/components/lily/lily-mark";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const emailParam = searchParams.get("email") ?? "";

  const [mode, setMode] = useState<"otp" | "signup">("otp");
  const [email, setEmail] = useState(emailParam);
  const [agency, setAgency] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (emailParam && !email) {
      setEmail(emailParam);
    }
  }, [emailParam, email]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(safeNext);
    });
  }, [router, safeNext]);

  async function submitSignup(e: FormEvent) {
    e.preventDefault();
    setPending(true);

    try {
      // Accounts are passwordless: the only credential is the emailed code.
      const signupRes = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, agency }),
      });
      const signupData = await signupRes.json();
      if (!signupRes.ok || !signupData.ok) {
        throw new Error(signupData.error || "Could not create account.");
      }

      // Signup never yields a session: the account is opened through the
      // emailed 6-digit code, so switch the form into OTP mode.
      setMode("otp");
      setOtpSent(false);
      toast.success(
        signupData.message || "Workspace request received. Request a 6-digit code to sign in.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setPending(false);
    }
  }

  async function sendOtp(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please enter a valid work email.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to send verification code.");
      }

      setOtpSent(true);
      toast.success(data.message || "A 6-digit verification code was sent to your email.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send verification code.");
    } finally {
      setPending(false);
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length < 6) {
      toast.error("Please enter the complete 6-digit code.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: cleanCode }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Invalid 6-digit code.");
      }

      if (data.session) {
        const supabase = createClient();
        if (supabase) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
        }
      }

      toast.success("Verification successful. Opening workspace…");
      const redirectTo =
        typeof data.redirectTo === "string" &&
        data.redirectTo.startsWith("/") &&
        !data.redirectTo.startsWith("//")
          ? data.redirectTo
          : safeNext;
      window.location.href = redirectTo;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <Image
          src="/assets/lily-night-bloom.webp"
          alt="A glowing white lily in a moonlit valley"
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="animate-ken-burns object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/10 via-background/30 to-background" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2 }}
          className="absolute bottom-14 left-14 max-w-md"
        >
          <p className="font-display text-4xl leading-tight text-petal">
            Every morning at <em className="text-bloom not-italic">08:00</em>, a fresh field of leads blooms.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Verified, enriched and drafted — ready before your first coffee.
          </p>
        </motion.div>
      </div>

      <div className="flex items-center justify-center px-6 py-14">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          <div className="mb-10 flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
            <LilyLogo />
          </div>

          <h1 className="text-4xl font-medium text-foreground">
            {mode === "signup" ? "Create your workspace" : "Sign in to your pipeline"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Passwordless — we verify you by email before your first lead drop."
              : "Passwordless. We send a six-digit code to your agency email."}
          </p>

          <div className="mt-6 flex rounded-xl border border-border bg-surface p-1">
            <button
              type="button"
              onClick={() => {
                setMode("otp");
                setOtpSent(false);
              }}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                mode === "otp" ? "bg-background text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              Email Code
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setOtpSent(false);
              }}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                mode === "signup" ? "bg-background text-foreground shadow" : "text-muted-foreground"
              }`}
            >
              Sign up
            </button>
          </div>

          {mode === "otp" ? (
            !otpSent ? (
              <form onSubmit={sendOtp} className="mt-6 grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="work-email">Work email</Label>
                  <Input
                    id="work-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vinayak@thepilab.in"
                    className="h-11 bg-surface"
                  />
                </div>
                <Button type="submit" variant="bloom" size="xl" disabled={pending} className="mt-2 w-full">
                  {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Email me a 6-digit code
                </Button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="mt-6 grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="otp-token">Enter 6-digit code</Label>
                  <Input
                    id="otp-token"
                    type="text"
                    required
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="482915"
                    className="h-11 text-center font-mono text-xl tracking-[0.3em] bg-surface"
                  />
                  <p className="text-xs text-muted-foreground">
                    Sent from hello@thepilab.in to {email}.
                  </p>
                </div>
                <Button type="submit" variant="bloom" size="xl" disabled={pending || otpCode.length < 6} className="mt-2 w-full">
                  {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify & Sign in
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpCode("");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground text-center"
                >
                  Change email address
                </button>
              </form>
            )
          ) : (
            <form onSubmit={submitSignup} className="mt-6 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="agency">Agency name</Label>
                <Input
                  id="agency"
                  required
                  minLength={2}
                  maxLength={80}
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  placeholder="Bloom Digital"
                  className="h-11 bg-surface"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vinayak@thepilab.in"
                  className="h-11 bg-surface"
                />
              </div>
              <Button type="submit" variant="bloom" size="xl" disabled={pending} className="mt-2 w-full">
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create workspace
              </Button>
            </form>
          )}

          <div className="mt-8 rounded-2xl border border-border/60 bg-surface/40 p-4 text-xs leading-relaxed text-muted-foreground">
            <div className="flex items-center gap-2 text-primary font-medium mb-1">
              <Sparkles className="h-3.5 w-3.5" /> Invite-only agency portal
            </div>
            New agencies receive their daily verified lead drop directly in this workspace. Contact THE Π LAB for operator onboarding.
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginFormInner />
    </Suspense>
  );
}
