import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

export function ClosingCta() {
  return (
    <section className="relative overflow-hidden border-t border-foreground/[0.07]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-full h-[760px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/[0.06]" />
        <div className="absolute left-1/2 top-full h-[560px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/[0.05]" />
        <div className="absolute left-1/2 top-full h-[420px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface/[0.12] blur-[110px]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1200px] px-6 py-24 lg:px-8 lg:py-28">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <span className="kicker">The 8:00 AM advantage</span>
            <h2 className="display mt-5 max-w-[820px] text-[clamp(2.3rem,4.6vw,3.9rem)]">
              Your pipeline should be waiting for you at 8:00 AM.
              <span className="block text-muted-foreground">Not the other way around.</span>
            </h2>
          </div>
          <div className="lg:col-span-4">
            <p className="max-w-[340px] text-[14px] leading-[1.75] text-muted-foreground">
              Three founding slots remain. Onboarding is a 25-minute call, a niche brief and one
              operator session. The first drop lands the next morning.
            </p>
            <div className="mt-7 flex flex-col gap-2.5">
              <Link href="/login" className="btn-ivory group">
                Claim a founding slot
                <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
              <Link href="/dashboard" className="btn-ghost group">
                Walk the live workspace
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <p className="mt-4 text-[11.5px] text-muted-foreground">
              No card · Month-to-month · Operator-led
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
