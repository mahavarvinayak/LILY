"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight, Check, LayoutDashboard, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { LilyLogo } from "@/components/lily/lily-mark";
import { Button } from "@/components/ui/button";
import SlackLogo from "./brand-logos/slack";
import GoogleLogo from "./brand-logos/google";
import GitHubLogo from "./brand-logos/github";
import LinearLogo from "./brand-logos/linear";
import MicrosoftLogo from "./brand-logos/microsoft";

export function Reveal({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function IntegrationBand() {
  const reduced = useReducedMotion();
  const brands = [
    ["Slack", SlackLogo],
    ["Google", GoogleLogo],
    ["GitHub", GitHubLogo],
    ["Linear", LinearLogo],
    ["Microsoft", MicrosoftLogo],
  ] as const;

  return (
    <section className="overflow-hidden border-y border-border py-9">
      <p className="mb-7 text-center text-[10px] uppercase tracking-[.24em] text-muted-foreground">
        An ecosystem built for the way you work
      </p>
      <div
        className={`mx-auto flex w-max gap-20 px-10 ${
          reduced ? "flex-wrap justify-center" : "animate-marquee"
        }`}
      >
        {[0, 1, 2].map((copy) => (
          <div key={copy} aria-hidden={copy > 0} className="flex items-center gap-20">
            {brands.map(([name, Logo]) => (
              <span key={name} className="flex items-center gap-3 text-lg font-medium text-foreground/65">
                <Logo className="size-6" />
                {name}
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-[10px] text-muted-foreground">
        Brand marks shown for ecosystem context. No endorsement implied.
      </p>
    </section>
  );
}

export function ProductFrame() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <Reveal>
        <div className="mb-12 text-center">
          <span className="kicker">A place for possibility</span>
          <h2 className="mt-5 text-4xl sm:text-6xl">
            Less noise. <em className="text-primary">More next steps.</em>
          </h2>
          <p className="mt-5 text-sm text-muted-foreground">
            Your signals, people and outreach. One thoughtfully connected workspace.
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-primary/20 bg-surface shadow-glow">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <LilyLogo />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Workspace illustration
            </span>
            <span className="hidden rounded-full bg-primary/10 px-3 py-1 text-xs text-primary sm:block">
              08:00 IST · Daily release
            </span>
          </div>
          <div className="flex min-h-96">
            <aside className="hidden w-44 shrink-0 border-r border-border p-5 sm:block">
              <p className="mb-6 text-[9px] uppercase tracking-widest text-muted-foreground">
                Your workspace
              </p>
              {[
                "Overview",
                "Opportunities",
                "Companies",
                "People",
                "Outreach Studio",
                "Connectors",
              ].map((v, i) => (
                <div
                  key={v}
                  className={`mb-2 rounded-lg px-3 py-3 text-xs ${
                    i === 1 ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  }`}
                >
                  {v}
                </div>
              ))}
            </aside>
            <div className="min-w-0 flex-1 p-5 sm:p-8">
              <div className="flex items-center gap-3">
                <LayoutDashboard className="size-5 text-primary" />
                <h3 className="text-2xl">Opportunity garden</h3>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                A considered pipeline. From first signal to meaningful conversation.
              </p>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {["New signal", "In conversation", "Opportunity"].map((stage, i) => (
                  <div className="rounded-xl border border-border bg-background/40 p-4" key={stage}>
                    <p className="mb-6 flex items-center gap-2 text-xs text-foreground/75">
                      <span
                        className={`size-1.5 rounded-full ${
                          i === 0 ? "bg-primary" : i === 1 ? "bg-blush" : "bg-pollen"
                        }`}
                      />
                      {stage}
                    </p>
                    <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
                      <span className="inline-flex rounded-full bg-primary/10 p-2 text-primary">
                        {i === 0 ? <Zap className="size-4" /> : i === 1 ? <Sparkles className="size-4" /> : <Check className="size-4" />}
                      </span>
                      <div className="mt-4 h-2 w-3/4 rounded-full bg-foreground/15" />
                      <div className="mt-3 h-1.5 w-full rounded-full bg-foreground/5" />
                      <div className="mt-2 h-1.5 w-2/3 rounded-full bg-foreground/5" />
                      <p className="mt-6 border-t border-border pt-3 text-[10px] text-muted-foreground">
                        {[
                          "Verified trigger + decision-maker",
                          "Personalised outreach ready",
                          "Your next meaningful connection",
                        ][i]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-[10px] text-muted-foreground">
                Illustrative product UI — your workspace starts with your real records, never sample data.
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function MoonBand() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [reduced ? 0 : -70, reduced ? 0 : 70]);

  return (
    <section ref={ref} className="grain relative isolate overflow-hidden px-6 py-32 text-center sm:py-44">
      <motion.img
        src="/assets/lily-valley-moon.webp"
        alt="Moonlight over a river in a lily valley"
        style={{ y }}
        className="absolute -inset-y-24 inset-x-0 -z-20 h-[calc(100%+12rem)] w-full object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-background/55" />
      <Reveal>
        <span className="kicker">The 8:00 AM advantage</span>
        <h2 className="mx-auto mt-6 max-w-3xl text-4xl leading-tight sm:text-6xl">
          While the world goes quiet,
          <br />
          <em className="text-bloom">your pipeline comes alive.</em>
        </h2>
        <p className="mx-auto mt-6 max-w-md text-sm leading-7 text-petal/75">
          One nightly cycle. Four checkpoints. Fresh opportunity before your first coffee.
        </p>
      </Reveal>
    </section>
  );
}

export function NightFeature() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-24">
      <Reveal>
        <div className="grid overflow-hidden rounded-3xl border border-border bg-surface md:grid-cols-2">
          <div className="relative min-h-72">
            <Image
              src="/assets/lily-night-bloom.webp"
              alt="A luminous lily blooming in a moonlit garden"
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="p-8 sm:p-14">
            <span className="kicker">Thoughtfully autonomous</span>
            <h2 className="mt-5 text-4xl leading-tight sm:text-5xl">
              Your personal LinkedIn.
              <br />
              <em className="text-blush">Never exposed.</em>
            </h2>
            <p className="mt-6 text-sm leading-7 text-muted-foreground">
              Your account is never touched, connected or automated. Fresh research arrives as private CRM records — with a live buying trigger and an icebreaker ready for your team.
            </p>
            <Button asChild variant="outline" className="mt-7 rounded-full bg-card/60 border-border hover:border-primary/40">
              <Link href="/login">
                Grow on your own terms <ArrowUpRight className="size-4 ml-2 inline" />
              </Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
