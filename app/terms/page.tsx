import { Scale, ShieldCheck, CreditCard, RefreshCw, AlertCircle } from "lucide-react";
import { SiteNav, Footer } from "@/components/landing/site-chrome";
import { PageTransition } from "@/components/lily/page-transition";

export const metadata = {
  title: "Terms of Service · LILY CRM",
  description: "Commercial terms, SLA guarantees, and payment conditions for LILY CRM.",
};

export default function TermsPage() {
  return (
    <div className="marketing min-h-screen bg-background text-foreground">
      <SiteNav />
      <PageTransition>
        <main className="mx-auto max-w-3xl px-6 pt-36 pb-24 sm:pt-44">
          <div className="flex items-center gap-2 text-xs font-mono text-foreground mb-3">
            <Scale className="size-3.5" />
            <span>LEGAL AGREEMENT</span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-semibold tracking-tight text-foreground">
            Terms of Service
          </h1>
          <p className="mt-2 text-xs font-mono text-muted-foreground">
            Last revised: November 10, 2026 · Governing Law: India
          </p>

          <div className="mt-10 space-y-10 text-[14px] leading-relaxed text-muted-foreground">
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="size-4 text-foreground" />
                <span>1. Scope of Service & Infrastructure Delivery</span>
              </h2>
              <p>
                LILY provides a done-for-you autonomous lead generation and pipeline operating system for digital marketing, IT staffing, and software development agencies. Each client workspace receives freshly verified decision-makers delivered automatically every morning at 08:00 AM IST according to the subscribed quota tier.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <CreditCard className="size-4 text-foreground" />
                <span>2. Commercial Terms & Payment Schedule</span>
              </h2>
              <p>To maintain infrastructure costs and dedicated scraping proxies:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                <li>Setup fees require a strict <strong>50% advance deposit via UPI/Bank transfer</strong> before private workspace provisioning and custom agent parameter configuration.</li>
                <li>The remaining <strong>50% balance</strong> is payable upon live workspace verification on Day 15 of service.</li>
                <li>All payments are non-refundable once the dedicated cloud workers have commenced scraping pipelines for your registered niche.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <RefreshCw className="size-4 text-foreground" />
                <span>3. Data Accuracy & Trigger Freshness SLA</span>
              </h2>
              <p>
                LILY guarantees that 100% of injected leads feature buying triggers (such as verified job openings, recent funding rounds, or active headcount growth) detected within the preceding 48 hours. Any record with an invalid work email or disconnected company domain is eligible for instant credit replacement via the operator console.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <AlertCircle className="size-4 text-pollen" />
                <span>4. Acceptable Outbound Use</span>
              </h2>
              <p>
                Subscribers agree not to use pre-written AI pitches or enriched contact intelligence for unlawful spam, unsolicited bulk email broadcasting violating CAN-SPAM or GDPR, or fraudulent solicitation. LILY reserves the right to terminate workspaces engaging in abusive outreach patterns.
              </p>
            </section>

            <section className="pt-6 border-t border-border text-xs text-muted-foreground font-mono">
              For contractual inquiries or enterprise SLA terms, contact{" "}
              <a href="mailto:hello@thepilab.in" className="text-foreground hover:underline">
                hello@thepilab.in
              </a>.
            </section>
          </div>
        </main>
      </PageTransition>
      <Footer />
    </div>
  );
}

