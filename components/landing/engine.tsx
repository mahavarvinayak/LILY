import { ArrowUpRight, Check, Mail, Sparkles, Zap } from "lucide-react";
import { LilyLogo as Logo } from "@/components/lily/lily-mark";
function Monogram({ name, className }: { name: string; className?: string }) { return <span className={className}>{name.slice(0, 2)}</span>; }

const steps = [
  {
    time: "02:00",
    title: "Sweep the signal layer",
    body: "Role openings, funding announcements, expansion moves and partner launches across your target niche.",
  },
  {
    time: "04:30",
    title: "Verify the decision-maker",
    body: "Match one accountable human to each trigger. Confirm the role, the company and a deliverable work email.",
  },
  {
    time: "06:00",
    title: "Draft the icebreaker",
    body: "A two-line hook written against the exact trigger, then a fact-and-tone pass before anything ships.",
  },
  {
    time: "08:00",
    title: "Release into the workspace",
    body: "Your quota unlocks behind row-level security, with the Slack digest and outreach studio already loaded.",
  },
];

export function Engine() {
  return (
    <section id="how-it-works" className="relative border-y border-foreground/[0.07] bg-surface">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-1/3 h-[420px] w-[420px] rounded-full bg-primary/20 blur-[130px]" />
        <div className="absolute -right-32 bottom-0 h-[320px] w-[320px] rounded-full bg-sky/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-14 px-6 py-24 lg:grid-cols-12 lg:gap-16 lg:px-8 lg:py-32">
        <div className="lg:col-span-5">
          <span className="kicker">Inside LILY</span>
          <h2 className="display mt-5 max-w-[420px] text-[clamp(2rem,3.6vw,3rem)]">
            The 8:00 drop,
            <span className="block text-muted-foreground">while you sleep.</span>
          </h2>
          <p className="mt-6 max-w-[420px] text-[14.5px] leading-[1.75] text-muted-foreground">
            One nightly cycle. Four checkpoints. A quota-capped set of records that appears in your
            CRM before your first coffee — never a live feed you have to babysit.
          </p>

          <ol className="mt-10 border-t border-foreground/[0.08]">
            {steps.map((step, index) => (
              <li key={step.time} className="border-b border-foreground/[0.08] py-5">
                <div className="flex gap-5">
                  <span className="w-12 shrink-0 font-mono text-[11px] leading-6 text-primary/70">
                    {step.time}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-semibold text-muted-foreground">{step.title}</h3>
                      {index === 3 ? (
                        <span className="size-1.5 animate-pulse-dot rounded-full bg-primary" />
                      ) : null}
                    </div>
                    <p className="mt-1.5 max-w-[350px] text-[12.5px] leading-[1.7] text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="lg:col-span-7"><p className="mb-3 text-xs text-muted-foreground">Illustrative lead dossier · not customer data</p>
          <div className="relative">
            <div className="pointer-events-none absolute -inset-x-6 -top-8 bottom-0 shadow-soft" />
            <div className="relative overflow-hidden rounded-[12px] border border-foreground/[0.12] bg-surface-raised text-foreground shadow-soft">
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Monogram name="Northwind Commerce" className="size-8 text-[11px]" />
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">Northwind Commerce</p>
                    <p className="text-[11px] text-foreground">D2C · Shopify Plus · Bengaluru</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-border bg-surface px-2 py-1 text-[10.5px] font-medium text-foreground">
                  <span className="size-1.5 rounded-full bg-primary" />
                  New lead
                </span>
              </div>

              <div className="px-5 py-4">
                <p className="text-[11px] font-medium text-foreground">Live buying trigger</p>
                <div className="mt-2 flex items-start gap-2.5 rounded-[6px] border border-border bg-surface px-3 py-2.5">
                  <Zap className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <div>
                    <p className="text-[12.5px] font-medium text-foreground">
                      Hiring: 2 Senior Shopify Engineers
                    </p>
                    <p className="mt-1 text-[10.5px] text-foreground">
                      LinkedIn Jobs · posted 11h ago · requisition 4252026496
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-end justify-between border-t border-border pt-4">
                  <div>
                    <p className="text-[11px] font-medium text-foreground">Decision-maker</p>
                    <p className="mt-1.5 text-[13px] font-medium text-foreground">
                      Ananya Rao <span className="text-foreground">·</span>{" "}
                      <span className="font-normal text-foreground">Founder &amp; CEO</span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-border bg-surface px-2 py-1 text-[10.5px] font-medium text-foreground">
                    <Check className="size-3" /> Verified
                  </span>
                </div>
              </div>

              <div className="border-t border-border bg-surface px-5 py-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-3.5 text-primary" />
                  <p className="text-[11px] font-semibold text-foreground">Outreach studio</p>
                  <span className="ml-auto text-[10.5px] text-foreground">v3 · 1.4s</span>
                </div>

                <div className="mt-3 rounded-[6px] border border-border bg-surface-raised">
                  <div className="border-b border-border px-3.5 py-2.5">
                    <p className="text-[10.5px] font-medium text-foreground">Subject</p>
                    <p className="mt-0.5 text-[12px] text-foreground">
                      Northwind&apos;s Shopify rebuild — a CRO layer before you scale
                    </p>
                  </div>
                  <div className="px-3.5 py-3">
                    <p className="text-[12px] leading-[1.75] text-foreground">
                      Ananya — saw Northwind is hiring two Senior Shopify engineers, which usually
                      means the storefront is about to get a serious rebuild.
                      <br />
                      Before those roles land, we map the conversion leaks your new build should not
                      inherit. Worth a 12-minute look?
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-[5px] bg-surface px-2.5 text-[11px] font-medium text-foreground">
                    <Mail className="size-3" /> Send via Resend
                  </span>
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-raised px-2.5 text-[11px] text-foreground">
                    <Check className="size-3 text-primary" /> Copy for LinkedIn
                  </span>
                  <span className="ml-auto text-[10.5px] tabular-nums text-foreground">
                    ₹4.8L · 5 stages
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border bg-surface px-5 py-2.5">
                <div className="flex items-center gap-2 text-foreground">
                  <Logo className="scale-[0.8] origin-left" />
                  <span className="hidden text-[10.5px] text-foreground sm:inline">
                    Ready before 08:00
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[10.5px] text-foreground">
                  Open full dossier <ArrowUpRight className="size-3" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
