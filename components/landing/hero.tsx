"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowUpRight, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";

function Countdown() {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const shifted = new Date(now + 19800000);
      const next =
        Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 8) -
        19800000;
      setRemaining(Math.max(0, Math.floor(((next >= now ? next : next + 86400000) - now) / 1000)));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="inline-flex items-center gap-4 rounded-full border border-foreground/15 bg-background/35 px-5 py-3 backdrop-blur-md">
      <Clock3 className="size-4 text-primary" />
      <span className="text-[10px] uppercase tracking-[.16em] text-petal/75">Next 08:00 IST drop</span>
      <span className="font-mono text-xs tabular-nums text-petal" aria-label="Time until next lead drop">
        {remaining === null
          ? "-- : -- : --"
          : [Math.floor(remaining / 3600), Math.floor((remaining % 3600) / 60), remaining % 60]
              .map((n) => String(n).padStart(2, "0"))
              .join(" : ")}
      </span>
    </div>
  );
}

export function Hero() {
  const reduced = useReducedMotion();
  const [showVideo, setShowVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (c?.saveData) return;
    const t = window.setTimeout(() => setShowVideo(true), 900);
    return () => clearTimeout(t);
  }, [reduced]);

  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 180]);

  return (
    <section ref={ref} className="grain relative isolate flex min-h-svh flex-col justify-center overflow-hidden px-6 pb-32 pt-40 text-center">
      <motion.div style={{ y }} className="absolute -inset-y-24 inset-x-0 -z-30">
        <Image
          src="/assets/lily-valley-hero.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="scale-105 object-cover animate-[hero-zoom_24s_ease-in-out_infinite_alternate]"
        />
        {showVideo && (
          <video
            src="/lily-valley-loop.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
            onCanPlay={() => setVideoReady(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1500ms] ${
              videoReady ? "opacity-100" : "opacity-0"
            }`}
          />
        )}
      </motion.div>
      <div className="absolute inset-0 -z-20 bg-background/40" />
      <div className="absolute inset-0 -z-10 bg-dusk" />
      {!reduced && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <svg
              key={i}
              viewBox="0 0 20 32"
              className="absolute -top-12 w-3 text-blush/50"
              style={{
                left: `${i * 8.3}%`,
                animation: `petal-fall ${12 + (i % 5) * 2}s linear ${-i * 2.7}s infinite`,
              }}
            >
              <path d="M10 1C-4 12 0 26 10 31C22 20 22 10 10 1Z" fill="currentColor" />
            </svg>
          ))}
        </div>
      )}
      <div className="relative mx-auto w-full max-w-5xl">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-9 inline-flex items-center gap-2.5 rounded-full border border-primary/25 bg-background/30 px-4 py-2 backdrop-blur-md"
        >
          <span className="size-1.5 rounded-full bg-primary shadow-glow" />
          <span className="text-[10px] uppercase tracking-[.2em] text-petal/90">
            A quieter way to grow your agency
          </span>
        </motion.div>
        <h1 className="font-display text-[clamp(3.6rem,8.7vw,7.5rem)] font-normal leading-[.99] tracking-[-.055em]">
          {"Let your next".split(" ").map((word, i) => (
            <motion.span
              className="mr-[.2em] inline-block"
              key={word}
              initial={reduced ? false : { opacity: 0, y: 25, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.18 + i * 0.13, duration: 1 }}
            >
              {word}
            </motion.span>
          ))}
          <motion.span
            className="text-bloom mt-2 block italic"
            initial={reduced ? false : { opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 1.1 }}
          >
            opportunity bloom.
          </motion.span>
        </h1>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.8 }}
        >
          <p className="mx-auto mt-8 max-w-xl text-sm leading-7 text-petal/80 sm:text-base">
            The boutique autonomous revenue pipeline for digital agencies. Fresh, verified decision-makers. AI outreach pre-loaded.
            <br className="hidden sm:block" /> Waiting in your workspace, every morning at 08:00 AM.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Button variant="default" size="lg" className="rounded-full bg-primary text-primary-foreground font-semibold px-8 py-3 text-sm shadow-glow hover:scale-105 transition-transform" asChild>
              <Link href="/login">
                Open your next chapter <ArrowUpRight className="size-4 ml-2 inline" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="rounded-full border border-border bg-card/60 backdrop-blur-md px-8 py-3 text-sm hover:border-primary/40 transition-colors" asChild>
              <a href="#how-it-works">
                Discover how it works <ArrowDown className="size-4 ml-2 inline" />
              </a>
            </Button>
          </div>
          <p className="mt-5 text-[10px] tracking-wide text-petal/60">
            No card · Month-to-month · Operator-led
          </p>
        </motion.div>
      </div>
      <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-4">
        <Countdown />
        <span className="text-[9px] uppercase tracking-[.3em] text-petal/45">
          Good mornings start the night before
        </span>
      </div>
    </section>
  );
}
