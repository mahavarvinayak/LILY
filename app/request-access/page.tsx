"use client";

import { useState, type FormEvent, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Send, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { LilyLogo } from "@/components/lily/lily-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const planOptions = [
  {
    id: "starter",
    title: "Starter",
    price: "₹14,000 / month",
    volume: "5 leads / day (~150 / mo)",
    description: "For boutique agencies testing an outbound vertical.",
  },
  {
    id: "growth",
    title: "Growth (Founding Offer)",
    price: "₹29,000 / month",
    volume: "15 leads / day (~400 / mo)",
    description: "Replaces manual scraping interns with verified pipeline.",
    highlight: true,
  },
  {
    id: "scale",
    title: "Scale",
    price: "₹45,000 / month",
    volume: "30 leads / day (~750+ / mo)",
    description: "High-volume agency pods running multi-channel outbound.",
  },
];

function RequestAccessInner() {
  const searchParams = useSearchParams();
  const initialPlan = searchParams.get("plan") || "growth";

  const [fullName, setFullName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [agencyWebsite, setAgencyWebsite] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string>(
    planOptions.some((p) => p.id === initialPlan) ? initialPlan : "growth",
  );
  const [targetNiche, setTargetNiche] = useState("");
  const [targetRoles, setTargetRoles] = useState("");
  const [targetGeography, setTargetGeography] = useState("");
  const [coreOffer, setCoreOffer] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !workEmail.trim() || !phone.trim() || !agencyName.trim()) {
      toast.error("Please fill in all required contact fields.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          workEmail,
          phone,
          agencyName,
          agencyWebsite,
          linkedinUrl,
          selectedPlan,
          targetNiche,
          targetRoles,
          targetGeography,
          coreOffer,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Failed to submit agency brief.");
      }

      setSubmitted(true);
      toast.success("Agency brief received. We will contact you shortly.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <div className="rounded-2xl border border-border bg-card/60 p-8 sm:p-12 backdrop-blur-xl shadow-2xl">
          <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
            <CheckCircle2 className="size-8" />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Agency Brief Received
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Thank you, <strong className="text-foreground">{fullName}</strong>. Vinayak Mahavar from THE Π LAB is reviewing your targeting parameters for <strong className="text-foreground">{agencyName}</strong>.
          </p>
          <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-left text-xs leading-5 text-muted-foreground">
            <p className="font-semibold text-foreground">Next steps:</p>
            <p className="mt-1">
              1. We verify live buying signals for {targetNiche || "your niche"}.
            </p>
            <p>
              2. We prepare a live sample slice of verified decision makers.
            </p>
            <p>
              3. We reach out via WhatsApp at <strong className="font-mono text-foreground">{phone}</strong> and email within 2 hours.
            </p>
          </div>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-surface px-5 text-xs font-semibold text-foreground hover:bg-surface-elevated"
            >
              Return to Home
            </Link>
            <a
              href="https://linkedin.com/in/vinayak-mahavar-095593258"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Message Vinayak on LinkedIn
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
          <Sparkles className="size-3" />
          Founding Cohort Application
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Reserve Your Agency Pipeline
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Submit your ICP targeting requirements. We configure your automated lead engine and onboard your agency directly.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border bg-card/50 p-6 sm:p-8 backdrop-blur-xl">
        <div>
          <Label className="text-xs font-semibold text-foreground">Select Operating Tier</Label>
          <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {planOptions.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              return (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative flex flex-col rounded-xl border p-3.5 text-left transition ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-surface/40 hover:border-border-strong hover:bg-surface"
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                      Popular
                    </span>
                  )}
                  <span className="text-xs font-semibold text-foreground">{plan.title}</span>
                  <span className="mt-1 font-mono text-[11px] font-bold text-primary">{plan.price}</span>
                  <span className="mt-0.5 text-[10px] text-muted-foreground">{plan.volume}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border/70 pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact & Agency Information</h2>
          <div className="mt-3.5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="fullName" className="text-xs font-medium text-foreground">
                Your Full Name <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="fullName"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="workEmail" className="text-xs font-medium text-foreground">
                Work Email <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="workEmail"
                type="email"
                required
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                placeholder="rahul@agency.com"
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-xs font-medium text-foreground">
                WhatsApp / Phone Number <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="phone"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="linkedinUrl" className="text-xs font-medium text-foreground">
                Your LinkedIn Profile URL <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="linkedinUrl"
                required
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/rahulsharma"
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="agencyName" className="text-xs font-medium text-foreground">
                Agency Name <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="agencyName"
                required
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="e.g. Apex Growth Media"
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="agencyWebsite" className="text-xs font-medium text-foreground">
                Agency Website
              </Label>
              <Input
                id="agencyWebsite"
                value={agencyWebsite}
                onChange={(e) => setAgencyWebsite(e.target.value)}
                placeholder="https://apexgrowth.com"
                className="mt-1 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border/70 pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Targeting Brief & ICP</h2>
          <div className="mt-3.5 space-y-4">
            <div>
              <Label htmlFor="targetNiche" className="text-xs font-medium text-foreground">
                Target Vertical / Niche
              </Label>
              <Input
                id="targetNiche"
                value={targetNiche}
                onChange={(e) => setTargetNiche(e.target.value)}
                placeholder="e.g. US B2B SaaS, IT Staffing, D2C Brands, FinTech"
                className="mt-1 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="targetRoles" className="text-xs font-medium text-foreground">
                  Target Decision Maker Titles
                </Label>
                <Input
                  id="targetRoles"
                  value={targetRoles}
                  onChange={(e) => setTargetRoles(e.target.value)}
                  placeholder="e.g. Founders, CMOs, VP Sales, CTOs"
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="targetGeography" className="text-xs font-medium text-foreground">
                  Target Geography
                </Label>
                <Input
                  id="targetGeography"
                  value={targetGeography}
                  onChange={(e) => setTargetGeography(e.target.value)}
                  placeholder="e.g. United States, UK, India, Global"
                  className="mt-1 text-sm"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="coreOffer" className="text-xs font-medium text-foreground">
                Core Service / Value Proposition
              </Label>
              <Input
                id="coreOffer"
                value={coreOffer}
                onChange={(e) => setCoreOffer(e.target.value)}
                placeholder="e.g. Performance marketing for SaaS scaling past $1M ARR"
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="notes" className="text-xs font-medium text-foreground">
                Specific Outbound Pain or Questions (Optional)
              </Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tell us what you currently use or any specific constraints..."
                className="mt-1 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-muted-foreground flex items-center gap-2.5">
          <ShieldCheck className="size-4 shrink-0 text-primary" />
          <span>Strict commercial terms: 50% upfront via UPI upon parameter demo · 50% on Day 15. Quota-capped data never resold.</span>
        </div>

        <Button
          type="submit"
          disabled={pending}
          className="w-full h-11 text-sm font-semibold gap-2"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Submitting brief…
            </>
          ) : (
            <>
              <Send className="size-4" />
              Submit Agency Brief & Reserve Pipeline
            </>
          )}
        </Button>
      </form>
    </div>
  );
}

export default function RequestAccessPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <LilyLogo className="size-6 text-primary" />
            <span className="font-display text-sm font-bold tracking-tight text-foreground">LILY</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back to Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <Suspense fallback={<div className="text-center py-20 text-muted-foreground">Loading brief form...</div>}>
          <RequestAccessInner />
        </Suspense>
      </main>
    </div>
  );
}

