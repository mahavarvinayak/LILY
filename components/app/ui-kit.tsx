"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { Linkedin, Mail, Globe, ExternalLink, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Shared visual language for the workspace.
 *
 * The dashboard is dense, so every element earns its contrast: each tone owns a
 * readable text colour, a tinted surface and a matching border. Use these
 * primitives instead of hand-rolling pale 9px chips so statuses stay legible and
 * instantly distinguishable from one another.
 */
export type Tone =
  | "primary"
  | "emerald"
  | "sky"
  | "amber"
  | "rose"
  | "violet"
  | "neutral";

const toneStyles: Record<
  Tone,
  { text: string; bg: string; border: string; dot: string; bar: string }
> = {
  primary: {
    text: "text-primary",
    bg: "bg-primary/12",
    border: "border-primary/35",
    dot: "bg-primary",
    bar: "bg-primary",
  },
  emerald: {
    text: "text-emerald-300",
    bg: "bg-emerald-500/12",
    border: "border-emerald-500/35",
    dot: "bg-emerald-400",
    bar: "bg-emerald-400",
  },
  sky: {
    text: "text-sky-300",
    bg: "bg-sky-500/12",
    border: "border-sky-500/35",
    dot: "bg-sky-400",
    bar: "bg-sky-400",
  },
  amber: {
    text: "text-amber-300",
    bg: "bg-amber-500/12",
    border: "border-amber-500/35",
    dot: "bg-amber-400",
    bar: "bg-amber-400",
  },
  rose: {
    text: "text-rose-300",
    bg: "bg-rose-500/12",
    border: "border-rose-500/35",
    dot: "bg-rose-400",
    bar: "bg-rose-400",
  },
  violet: {
    text: "text-violet-300",
    bg: "bg-violet-500/12",
    border: "border-violet-500/35",
    dot: "bg-violet-400",
    bar: "bg-violet-400",
  },
  neutral: {
    text: "text-foreground/80",
    bg: "bg-white/5",
    border: "border-border-strong",
    dot: "bg-muted-foreground",
    bar: "bg-muted-foreground",
  },
};

export function Pill({
  children,
  tone = "neutral",
  className,
  dot = false,
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
  title?: string;
}) {
  const t = toneStyles[tone];
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4",
        t.text,
        t.bg,
        t.border,
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", t.dot)} />}
      {children}
    </span>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  className?: string;
}) {
  const t = toneStyles[tone];
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border-strong bg-card p-4 shadow-soft",
        className,
      )}
    >
      <span className={cn("absolute inset-x-0 top-0 h-[3px]", t.bar)} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase leading-4 tracking-[.16em] text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg border",
            t.bg,
            t.border,
            t.text,
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 break-words font-display text-[1.75rem] leading-none tabular-nums text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 break-words text-[11px] leading-4 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  meta,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-0.5 break-words font-display text-xl leading-tight text-foreground">
          {title}
        </h2>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
        {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}
        {action}
      </div>
    </div>
  );
}

const tierMeta: Record<
  "primary" | "secondary" | "tertiary",
  { label: string; tone: Tone }
> = {
  primary: { label: "Primary", tone: "emerald" },
  secondary: { label: "Secondary", tone: "sky" },
  tertiary: { label: "Tertiary", tone: "amber" },
};

export function TierPill({ tier }: { tier?: string | null }) {
  const key = (tier === "secondary" || tier === "tertiary" ? tier : "primary") as
    | "primary"
    | "secondary"
    | "tertiary";
  const meta = tierMeta[key];
  return (
    <Pill tone={meta.tone} className="uppercase tracking-[.12em]">
      {meta.label}
    </Pill>
  );
}

const priorityTone: Record<string, Tone> = {
  high: "rose",
  medium: "amber",
  low: "sky",
};

export function PriorityPill({ priority }: { priority: string }) {
  return (
    <Pill tone={priorityTone[priority] || "neutral"} className="capitalize">
      {priority}
    </Pill>
  );
}

const stageTone: Record<string, Tone> = {
  "New Lead": "primary",
  Screening: "sky",
  Meeting: "amber",
  Proposal: "rose",
  Customer: "emerald",
  Lost: "neutral",
};

export function stageToneFor(stage: string): Tone {
  return stageTone[stage] || "neutral";
}

export const tableClasses = {
  table: "w-full min-w-[1300px] border-separate border-spacing-0 text-left text-sm",
  headRow: "",
  th: "sticky top-0 z-10 border-b border-border-strong bg-surface px-4 py-3 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground whitespace-nowrap",
  tbody: "",
  row: "group transition-colors odd:bg-white/[0.018] hover:bg-primary/[0.05]",
  td: "border-b border-border px-4 py-4 align-middle group-last:border-0",
};

export function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-[13px] leading-5 text-foreground">{value || "—"}</div>
    </div>
  );
}

export function ChannelBadge({
  kind,
  value,
  label,
  compact = false,
}: {
  kind: "linkedin" | "email" | "website";
  value?: string | null;
  label?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [tip, setTip] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function scheduleClose() {
    clearClose();
    closeTimer.current = setTimeout(() => setTip(null), 140);
  }

  function openTip() {
    clearClose();
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    // 16rem panel, kept inside the viewport so it never gets cut at the edges.
    const width = 256;
    const margin = 8;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - width / 2, margin),
      Math.max(margin, window.innerWidth - width - margin),
    );
    const up = rect.top > 190;
    setTip({ top: up ? rect.top - 8 : rect.bottom + 8, left, up });
  }

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!tip) return;
    // A viewport-anchored card can't follow a scroll, so dismiss it instead of
    // letting it drift away from the badge it describes.
    const dismiss = () => setTip(null);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [tip]);

  if (!value || !value.trim()) {
    return (
      <span className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] text-muted-foreground">
        {kind === "email" ? "Email unlisted" : kind === "linkedin" ? "No LinkedIn" : "No site"}
      </span>
    );
  }

  const cleanVal = value.trim();
  const href =
    kind === "email"
      ? `mailto:${cleanVal}`
      : kind === "website" && !/^https?:\/\//i.test(cleanVal)
        ? `https://${cleanVal}`
        : cleanVal;

  const displayLabel =
    label ||
    (kind === "website"
      ? cleanVal.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")
      : kind === "email"
        ? cleanVal
        : "LinkedIn");

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    void navigator.clipboard.writeText(cleanVal);
    setCopied(true);
    toast.success(`Copied ${kind === "email" ? "email address" : kind === "linkedin" ? "LinkedIn URL" : "website URL"}`);
    setTimeout(() => setCopied(false), 2000);
  }

  const colors =
    kind === "linkedin"
      ? "border-sky-500/35 bg-sky-500/10 text-sky-300 hover:border-sky-400 hover:bg-sky-500/20"
      : kind === "email"
        ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/20"
        : "border-primary/35 bg-primary/10 text-primary hover:border-primary/50 hover:bg-primary/20";

  const Icon = kind === "linkedin" ? Linkedin : kind === "email" ? Mail : Globe;

  return (
    <div
      ref={anchorRef}
      className="group/chan relative inline-block"
      onMouseEnter={openTip}
      onMouseLeave={scheduleClose}
    >
      <a
        href={href}
        target={kind === "email" ? undefined : "_blank"}
        rel={kind === "email" ? undefined : "noopener noreferrer"}
        onFocus={openTip}
        onBlur={scheduleClose}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border font-mono text-[11px] font-medium transition-all shadow-sm",
          compact ? "px-2 py-1" : "px-2.5 py-1.5 max-w-[200px]",
          colors,
        )}
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{displayLabel}</span>
        {kind !== "email" && <ExternalLink className="size-2.5 shrink-0 opacity-60" />}
      </a>

      {tip &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onMouseEnter={clearClose}
            onMouseLeave={scheduleClose}
            style={{
              top: tip.top,
              left: tip.left,
              width: 256,
              transform: tip.up ? "translateY(-100%)" : undefined,
            }}
            className="fixed z-[60] rounded-xl border border-border-strong bg-card p-3 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border pb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
                {kind === "linkedin"
                  ? "LinkedIn Profile"
                  : kind === "email"
                    ? "Verified Email"
                    : "Official Website"}
              </span>
              <span className="shrink-0 text-[10px] text-primary">Direct link</span>
            </div>
            <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-foreground">
              {cleanVal}
            </p>
            <div className="mt-2.5 flex items-center justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-surface px-2 text-[10px] font-medium text-foreground hover:bg-surface-elevated"
              >
                {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <a
                href={href}
                target={kind === "email" ? undefined : "_blank"}
                rel={kind === "email" ? undefined : "noopener noreferrer"}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-primary/40 bg-primary/15 px-2 text-[10px] font-medium text-primary hover:bg-primary/25"
              >
                {kind === "email" ? "Mailto" : "Open"}
                <ExternalLink className="size-2.5" />
              </a>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
