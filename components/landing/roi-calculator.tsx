"use client";

import * as React from "react";
import { ArrowDownRight, ArrowRight, Clock, IndianRupee } from "lucide-react";
import { formatInr } from "@/lib/utils";

const PLANS = [
  { max: 5, name: "Starter", price: 14000 },
  { max: 15, name: "Growth", price: 29000 },
  { max: 30, name: "Scale", price: 45000 },
];

export function RoiCalculator() {
  const [leads, setLeads] = React.useState(15);

  const plan = PLANS.find((entry) => leads <= entry.max) ?? PLANS[2]!;
  const interns = Math.max(1, Math.ceil(leads / 10));
  const internCost = interns * 15000;
  const tooling = 9800;
  const qaCost = Math.round(leads * 22 * 0.1 * 300);
  const oversight = 10000;
  const manual = internCost + tooling + qaCost + oversight;
  const lily = plan.price;
  const monthlySavings = manual - lily;
  const annualSavings = monthlySavings * 12;
  const hoursSaved = Math.round(leads * 22 * 0.1);
  const maxCost = Math.max(manual, lily);
  const manualPct = Math.round((manual / maxCost) * 100);
  const lilyPct = Math.round((lily / maxCost) * 100);

  return (
    <section id="roi" className="relative mx-auto w-full max-w-[1200px] px-6 py-24 lg:px-8 lg:py-32">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <span className="kicker">The maths</span>
          <h2 className="display mt-5 max-w-[420px] text-[clamp(2rem,3.6vw,3rem)]">
            Price the intern.
            <span className="block text-muted-foreground">Then price the output.</span>
          </h2>
          <p className="mt-6 max-w-[400px] text-[14.5px] leading-[1.75] text-muted-foreground">
            Manual sourcing is not one salary. It is a salary, a tooling stack, an oversight layer
            and thirty-three hours a month of research that nobody wants to do.
          </p>
          <div className="mt-8 flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-primary" />
            Model updates live as you move the slider
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="edge-card overflow-hidden">
            <div className="border-b border-foreground/[0.08] px-6 py-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[11.5px] font-medium text-muted-foreground">Target pipeline volume</p>
                  <div className="mt-1.5 flex items-baseline gap-2.5">
                    <span className="font-display text-[38px] font-semibold leading-none tracking-[-0.04em] text-muted-foreground">
                      {leads}
                    </span>
                    <span className="text-[13px] text-muted-foreground">qualified leads / day</span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 rounded-[6px] border border-primary/20 bg-primary/[0.07] px-3 py-1.5 text-[12px] font-medium text-primary">
                  {plan.name} plan
                  <span className="text-primary/50">·</span>
                  {formatInr(plan.price)}/mo
                </span>
              </div>

              <div className="mt-7">
                <input
                  type="range"
                  min={5}
                  max={30}
                  step={1}
                  value={leads}
                  aria-label="Leads per day"
                  onChange={(event) => setLeads(Number(event.target.value))}
                  className="w-full cursor-ew-resize accent-primary"
                />
                <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
                  <span>5 / day</span>
                  <span>15 / day</span>
                  <span>30 / day</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="space-y-5">
                <div>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[13px] text-muted-foreground">
                      Manual sourcing stack
                      <span className="ml-2 text-[11.5px] text-muted-foreground">
                        {interns} intern{interns > 1 ? "s" : ""} + tools + QA
                      </span>
                    </span>
                    <span className="text-[13px] font-medium tabular-nums text-muted-foreground">
                      {formatInr(manual)}
                    </span>
                  </div>
                  <div className="mt-2.5 h-[4px] w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                    <div
                      className="h-full rounded-full bg-muted-foreground transition-[width] duration-300"
                      style={{ width: `${manualPct}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[13px] text-primary">
                      LILY autonomous pipeline
                      <span className="ml-2 text-[11.5px] text-primary/50">
                        delivered before 08:00
                      </span>
                    </span>
                    <span className="text-[13px] font-medium tabular-nums text-primary">
                      {formatInr(lily)}
                    </span>
                  </div>
                  <div className="mt-2.5 h-[4px] w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-300"
                      style={{ width: `${lilyPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-7 grid grid-cols-1 gap-4 border-t border-foreground/[0.08] pt-5 sm:grid-cols-3">
                <div>
                  <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    <ArrowDownRight className="size-3.5 text-primary" /> Monthly saved
                  </p>
                  <p className="mt-1.5 font-display text-[19px] font-semibold tracking-[-0.02em] text-primary">
                    {formatInr(monthlySavings)}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    <IndianRupee className="size-3.5 text-primary" /> Annual saved
                  </p>
                  <p className="mt-1.5 font-display text-[19px] font-semibold tracking-[-0.02em] text-muted-foreground">
                    {formatInr(annualSavings)}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    <Clock className="size-3.5 text-primary" /> Hours returned
                  </p>
                  <p className="mt-1.5 font-display text-[19px] font-semibold tracking-[-0.02em] text-muted-foreground">
                    {hoursSaved}
                    <span className="ml-1 text-[11.5px] font-normal text-muted-foreground">hrs/mo</span>
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-4 border-t border-foreground/[0.07] pt-4">
                <p className="max-w-[380px] text-[11px] leading-relaxed text-muted-foreground">
                  Illustrative model: ₹15,000 per intern (one per 10 leads/day), ₹9,800 tooling,
                  ₹10,000 oversight, and 6 minutes of research per lead at ₹300/hour.
                </p>
                <a
                  href="#pricing"
                  className="hidden shrink-0 items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-primary sm:inline-flex"
                >
                  See plans <ArrowRight className="size-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
