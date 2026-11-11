import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";

const tiers = [
  {
    name: "Starter",
    price: 14000,
    quota: "5 leads / day",
    volume: "~150 verified leads / month",
    description: "For boutique agencies testing an outbound niche with zero manual scraping.",
    features: [
      "Trigger-matched leads, 08:00 IST",
      "Twenty-style dark Kanban + dossier",
      "AI icebreakers on every contact",
      "Daily Slack drop digest",
      "3 agency team seats (included)",
      "50% upfront UPI · 50% on Day 15",
    ],
    cta: "Start with Starter",
    highlight: false,
  },
  {
    name: "Growth",
    price: 29000,
    quota: "15 leads / day",
    volume: "~400 verified leads / month",
    description: "The primary agency plan. Replaces a ₹15,000/mo intern with verified pipeline.",
    features: [
      "Everything in Starter",
      "15 verified leads/day (quota-governed)",
      "48-hour hiring & funding triggers",
      "Resend outreach from your domain",
      "LILY AI Sales Assistant console",
      "5 agency team seats (included)",
      "Operator-led live onboarding",
    ],
    cta: "Claim founding slot",
    highlight: true,
  },
  {
    name: "Scale",
    price: 45000,
    quota: "30 leads / day",
    volume: "~750+ verified leads / month",
    description: "For high-volume agency pods running multi-channel outbound and client sourcing.",
    features: [
      "Everything in Growth",
      "30 verified leads/day",
      "Dedicated custom signal lane",
      "Custom niche + ICP tuning",
      "Weekly operator pipeline review",
      "10 agency team seats (included)",
      "Slack Connect + priority SLA",
    ],
    cta: "Talk to the operator",
    highlight: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative border-t border-foreground/[0.07] bg-surface">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="mx-auto w-full max-w-[1200px] px-6 py-24 lg:px-8 lg:py-32">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <span className="kicker">Founding cohort · November</span>
            <h2 className="display mt-5 text-[clamp(2rem,3.6vw,3rem)]">
              Priced like a tool.
              <span className="block text-muted-foreground">Hired like a team.</span>
            </h2>
          </div>
          <div className="lg:col-span-5 lg:text-right">
            <p className="max-w-[380px] text-[14px] leading-[1.7] text-muted-foreground lg:ml-auto">
              Three slots remain in the founding cohort. Every plan is month-to-month, quota-capped
              and onboarded by the operator — not a checkout flow.
            </p>
          </div>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {tiers.map((tier) => (
            <article
              key={tier.name}
              className={`relative flex flex-col overflow-hidden rounded-[12px] border p-6 ${
                tier.highlight
                  ? "border-border/35 bg-surface shadow-soft"
                  : "border-foreground/[0.09] bg-foreground/[0.02]"
              }`}
            >
              {tier.highlight ? (
                <>
                  <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[420px] -translate-x-1/2 rounded-full bg-surface/[0.18] blur-[80px]" />
                  <span className="absolute right-5 top-5 rounded-full border border-border/40 bg-surface/15 px-2.5 py-1 text-[10.5px] font-medium text-foreground">
                    Founding offer
                  </span>
                </>
              ) : null}

              <div className="relative">
                <p className="text-[12px] font-medium text-muted-foreground">{tier.name}</p>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-display text-[38px] font-semibold tracking-[-0.045em] text-muted-foreground">
                    ₹{tier.price.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[12px] text-muted-foreground">/ month</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2.5">
                  <span className="text-[12.5px] font-medium text-muted-foreground">{tier.quota}</span>
                  <span className="h-3 w-px bg-foreground/10" />
                  <span className="text-[11.5px] text-muted-foreground">{tier.volume}</span>
                </div>
                <p className="mt-4 min-h-[44px] text-[13px] leading-[1.7] text-muted-foreground">
                  {tier.description}
                </p>
              </div>

              <div className="relative mt-6 border-t border-foreground/[0.08] pt-5">
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
                      <Check
                        className={`mt-0.5 size-3.5 shrink-0 ${
                          tier.highlight ? "text-foreground" : "text-muted-foreground"
                        }`}
                        strokeWidth={2.2}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/login"
                className={`relative mt-7 inline-flex h-10 items-center justify-center gap-2 rounded-[7px] text-[13px] font-semibold transition-colors ${
                  tier.highlight
                    ? "bg-surface text-foreground hover:bg-foreground"
                    : "border border-foreground/[0.13] bg-transparent text-muted-foreground hover:border-foreground/[0.22] hover:bg-foreground/[0.05]"
                }`}
              >
                {tier.cta}
                <ArrowUpRight className="size-3.5" />
              </Link>
            </article>
          ))}
        </div>

        <p className="mt-7 text-center text-[11.5px] text-muted-foreground">
          No annual lock-in · Manual onboarding within 24h · GST extra · Your data never resold
        </p>
      </div>
    </section>
  );
}
