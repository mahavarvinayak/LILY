"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Target,
  Globe,
  Building2,
  Users,
  Briefcase,
  Zap,
  Ban,
  ArrowRight,
  Loader2,
  LogOut,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { LilyLogo } from "@/components/lily/lily-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { parseIcpConfig } from "@/lib/icp";

const QUICK_OFFERS = [
  "Custom React & Node Development",
  "Dedicated Developer Pods / Staff Augmentation",
  "B2B Performance Marketing & Lead Gen",
  "UI/UX Product Redesign & Audits",
];

const QUICK_GEOS = [
  "United States (East & West Coast)",
  "United Kingdom & Western Europe",
  "UAE & Middle East",
  "India & Southeast Asia",
];

const QUICK_NICHES = [
  "FinTech & Payments",
  "HealthTech & Digital Health",
  "B2B SaaS & Cloud Platforms",
  "E-Commerce & D2C Brands",
];

const QUICK_SIZES = [
  "10–50 Employees (Fast Closing Sweet Spot)",
  "51–200 Employees (Mid-Market Scale)",
  "201–500 Employees (Growth Tier)",
];

const QUICK_TITLES = [
  "Founder & Co-Founder",
  "Chief Executive Officer (CEO)",
  "Chief Technology Officer (CTO)",
  "VP of Engineering",
  "Head of Growth",
];

const QUICK_TRIGGERS = [
  "Actively recruiting 2+ software engineers in past 30 days",
  "Announced Seed or Series A funding in last 60 days",
  "Executive leadership expansion / new CTO appointed",
];

const QUICK_EXCLUSIONS = [
  "No IT consulting agencies / dev competitors",
  "No crypto, gambling, or adult sectors",
  "No enterprises with > 500 staff",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [agencyName, setAgencyName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [serviceOffer, setServiceOffer] = useState("");
  const [targetGeography, setTargetGeography] = useState("");
  const [targetIndustry, setTargetIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [decisionMakers, setDecisionMakers] = useState("");
  const [buyingTrigger, setBuyingTrigger] = useState("");
  const [negativeFilters, setNegativeFilters] = useState("");

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient();
        if (!supabase) {
          // No Supabase client means the deployment is not configured; the
          // loader must not spin forever.
          toast.error("Workspace database is not configured on this deployment.");
          return;
        }
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login?next=/onboarding");
          return;
        }

        setUserEmail(user.email || "");

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("agency_name, target_niche")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("[onboarding] could not load profile", profileError.message);
        }

        if (profile?.agency_name) {
          setAgencyName(profile.agency_name);
        }

        const existingIcp = parseIcpConfig(profile?.target_niche);
        if (existingIcp) {
          setServiceOffer(existingIcp.service_offer || "");
          setTargetGeography(existingIcp.target_geography || "");
          setTargetIndustry(existingIcp.target_industry || "");
          setCompanySize(existingIcp.company_size || "");
          setDecisionMakers(existingIcp.decision_makers || "");
          setBuyingTrigger(existingIcp.buying_trigger || "");
          setNegativeFilters(existingIcp.negative_filters || "");
        }
      } catch (error) {
        console.error("[onboarding] load failed", error);
        toast.error("Could not load your workspace profile.");
      } finally {
        setLoading(false);
      }
    }

    void loadUser();
  }, [router]);

  async function handleSignOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {}
    router.replace("/login");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_offer: serviceOffer,
          target_geography: targetGeography,
          target_industry: targetIndustry,
          company_size: companySize,
          decision_makers: decisionMakers,
          buying_trigger: buyingTrigger,
          negative_filters: negativeFilters,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save ICP configuration.");
      }

      toast.success("ICP calibrated successfully! Welcome to LILY.");
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <LilyLogo />
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              ICP Engine Setup
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {agencyName ? `Workspace: ${agencyName}` : userEmail}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-3.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" />
            Under 3 Minutes Calibrator
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Welcome to LILY{agencyName ? `, ${agencyName}` : ""}! 🚀
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            To configure your private CRM pipeline and stream verified decision-maker leads directly
            into your workspace tomorrow at 08:00 AM, answer these 7 quick parameters.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-primary">
                <Briefcase className="size-4" />
              </div>
              <div className="flex-1">
                <label htmlFor="icp-offer" className="text-sm font-semibold text-foreground">
                  1. Core Service &amp; Offer
                </label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  What primary service, development capability, or high-ticket offer are you selling?
                </p>
                <Input
                  id="icp-offer"
                  className="mt-3"
                  placeholder="e.g. Custom React & Node Engineering, Staff Augmentation, UI/UX Redesign"
                  value={serviceOffer}
                  onChange={(e) => setServiceOffer(e.target.value)}
                  required
                />
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {QUICK_OFFERS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setServiceOffer(preset)}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-primary">
                <Globe className="size-4" />
              </div>
              <div className="flex-1">
                <label htmlFor="icp-geography" className="text-sm font-semibold text-foreground">
                  2. Target Buyer Geography
                </label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Which countries, regions, or major metropolitan hubs do your prospects operate in?
                </p>
                <Input
                  id="icp-geography"
                  className="mt-3"
                  placeholder="e.g. United States (East/West Coast), United Kingdom, UAE, India, Australia"
                  value={targetGeography}
                  onChange={(e) => setTargetGeography(e.target.value)}
                  required
                />
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {QUICK_GEOS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTargetGeography(preset)}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-primary">
                <Building2 className="size-4" />
              </div>
              <div className="flex-1">
                <label htmlFor="icp-industry" className="text-sm font-semibold text-foreground">
                  3. Target Industry &amp; Sector Niches
                </label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Which sectors or commercial domains represent your ideal client profile?
                </p>
                <Input
                  id="icp-industry"
                  className="mt-3"
                  placeholder="e.g. FinTech, HealthTech, B2B SaaS, E-Commerce, PropTech"
                  value={targetIndustry}
                  onChange={(e) => setTargetIndustry(e.target.value)}
                  required
                />
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {QUICK_NICHES.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTargetIndustry(preset)}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-primary">
                <Users className="size-4" />
              </div>
              <div className="flex-1">
                <label htmlFor="icp-size" className="text-sm font-semibold text-foreground">
                  4. Company Headcount Tier
                </label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  What team size has the exact balance of budget and rapid decision speed?
                </p>
                <Input
                  id="icp-size"
                  className="mt-3"
                  placeholder="e.g. 10–50 Employees (Sweet spot for fast closing) or 50–200"
                  value={companySize}
                  onChange={(e) => setCompanySize(e.target.value)}
                  required
                />
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {QUICK_SIZES.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCompanySize(preset)}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-primary">
                <Target className="size-4" />
              </div>
              <div className="flex-1">
                <label htmlFor="icp-titles" className="text-sm font-semibold text-foreground">
                  5. Target Decision-Maker Designations
                </label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Which specific job titles have the authority to evaluate and approve your proposal?
                </p>
                <Input
                  id="icp-titles"
                  className="mt-3"
                  placeholder="e.g. Founder, CEO, CTO, VP of Engineering, Head of Growth"
                  value={decisionMakers}
                  onChange={(e) => setDecisionMakers(e.target.value)}
                  required
                />
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {QUICK_TITLES.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDecisionMakers(preset)}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-primary">
                <Zap className="size-4" />
              </div>
              <div className="flex-1">
                <label htmlFor="icp-trigger" className="text-sm font-semibold text-foreground">
                  6. The Active Buying Trigger
                </label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  What observable problem, live hiring spike, or recent event makes your outreach urgent?
                </p>
                <Textarea
                  id="icp-trigger"
                  className="mt-3 min-h-[72px]"
                  placeholder="e.g. Companies actively hiring 2+ React developers OR companies that raised Seed/Series A in last 60 days"
                  value={buyingTrigger}
                  onChange={(e) => setBuyingTrigger(e.target.value)}
                  required
                />
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {QUICK_TRIGGERS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBuyingTrigger(preset)}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors text-left"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-destructive">
                <Ban className="size-4" />
              </div>
              <div className="flex-1">
                <label htmlFor="icp-exclusions" className="text-sm font-semibold text-foreground">
                  7. Negative Filters &amp; Exclusions
                </label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Which types of companies, domains, or competitors must be 100% excluded?
                </p>
                <Input
                  id="icp-exclusions"
                  className="mt-3"
                  placeholder="e.g. No IT consulting agencies/competitors, no crypto/gambling, no enterprises > 500 staff"
                  value={negativeFilters}
                  onChange={(e) => setNegativeFilters(e.target.value)}
                  required
                />
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {QUICK_EXCLUSIONS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNegativeFilters(preset)}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Clock className="size-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Daily Morning Drop Guarantee
                </h4>
                <p className="text-xs text-muted-foreground">
                  Submitting this ICP configures our agents immediately. Your first batch of 24-field
                  verified leads will unlock in your CRM tomorrow at 08:00 AM IST.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="w-full gap-2 text-base font-semibold shadow-lg shadow-primary/20"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Calibrating Your Pipeline…
                </>
              ) : (
                <>
                  Submit ICP & Unlock CRM Dashboard
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

