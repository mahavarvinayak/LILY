import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
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
      <p className="mt-3 font-display text-[1.75rem] leading-none tabular-nums text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{hint}</p> : null}
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
        <h2 className="mt-0.5 font-display text-xl leading-tight text-foreground">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
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
  table: "w-full min-w-[900px] border-separate border-spacing-0 text-left text-sm",
  headRow: "",
  th: "sticky top-0 z-10 border-b border-border-strong bg-surface px-4 py-3 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground",
  tbody: "",
  row: "group transition-colors odd:bg-white/[0.018] hover:bg-primary/[0.05]",
  td: "border-b border-border px-4 py-4 align-top group-last:border-0",
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
