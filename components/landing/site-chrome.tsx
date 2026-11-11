"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { LilyLogo, LilyMark } from "@/components/lily/lily-mark";
import { Button } from "@/components/ui/button";

const links = [
  ["How it works", "how-it-works"],
  ["The difference", "mechanism"],
  ["The maths", "roi"],
  ["Pricing", "pricing"],
  ["FAQ", "faq"],
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled || open
          ? "border-b border-border bg-background/90 backdrop-blur-xl"
          : "bg-background/10"
      }`}
    >
      <div
        className={`mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 transition-all ${
          scrolled ? "h-16" : "h-24"
        }`}
      >
        <Link href="/" aria-label="LILY home">
          <LilyLogo />
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-7 lg:flex">
          {links.map(([label, id]) => (
            <a
              className="text-xs text-foreground/75 transition-colors hover:text-primary"
              href={`/#${id}`}
              key={id}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-6 md:flex">
          <Link href="/login" className="text-xs text-foreground/80">
            Client sign in
          </Link>
          <Button asChild variant="default" className="rounded-full bg-primary text-primary-foreground">
            <Link href="/login">
              Let’s grow <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
        <button
          className="rounded-full border border-border p-3 lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="marketing-menu"
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>
      {open && (
        <nav id="marketing-menu" className="flex flex-col gap-5 border-t border-border bg-background px-6 py-7 lg:hidden">
          {links.map(([label, id]) => (
            <a href={`/#${id}`} key={id} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
          <Link href="/login" onClick={() => setOpen(false)} className="text-primary">
            Open your workspace ↗
          </Link>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface/40">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <LilyLogo />
            <p className="mt-5 max-w-xs text-sm leading-7 text-muted-foreground">
              The boutique autonomous revenue pipeline for digital agencies. Quietly working. Always growing.
            </p>
            <a className="mt-5 inline-block text-xs text-primary" href="mailto:hello@thepilab.in">
              Talk to the operator ↗
            </a>
          </div>
          <div>
            <p className="mb-5 text-xs uppercase tracking-widest text-muted-foreground">Product</p>
            <Link className="footer-link" href="/#how-it-works">Inside LILY</Link>
            <Link className="footer-link" href="/#pricing">Plans & pricing</Link>
            <Link className="footer-link" href="/#roi">ROI calculator</Link>
          </div>
          <div>
            <p className="mb-5 text-xs uppercase tracking-widest text-muted-foreground">Workspace</p>
            <Link className="footer-link" href="/login">Client sign in</Link>
            <Link className="footer-link" href="/dashboard">Your workspace</Link>
          </div>
          <div>
            <p className="mb-5 text-xs uppercase tracking-widest text-muted-foreground">Legal & security</p>
            <Link className="footer-link" href="/privacy">Privacy policy</Link>
            <Link className="footer-link" href="/terms">Terms of service</Link>
            <Link className="footer-link" href="/cookies">Cookie policy</Link>
          </div>
        </div>
        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-7 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} LILY. All rights reserved.</span>
          <span className="flex items-center gap-2">
            <LilyMark className="size-4 text-primary" />
            Made for a more intentional kind of growth.
          </span>
        </div>
      </div>
    </footer>
  );
}
