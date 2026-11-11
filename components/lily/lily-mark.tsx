import { useId } from "react";
import { cn } from "@/lib/utils";

/** The original LILY three-petal flower mark (brand colours are fixed by design). */
export function LilyMark({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" className={cn("h-7 w-7 shrink-0", className)}>
      <defs>
        <linearGradient id={`c${uid}`} x1="50" y1="5" x2="50" y2="85" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6C5CE7" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
        <linearGradient id={`l${uid}`} x1="15" y1="25" x2="48" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8171F7" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
        <linearGradient id={`r${uid}`} x1="85" y1="25" x2="52" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#6C5CE7" />
        </linearGradient>
      </defs>
      <path d="M50 8C50 8 32 36 34 62C35.5 76 44 86 50 90C56 86 64.5 76 66 62C68 36 50 8 50 8Z" fill={`url(#c${uid})`} />
      <path d="M14 36C14 36 17 66 43 82C34 72 26 58 20 45C17.5 39.5 14 36 14 36Z" fill={`url(#l${uid})`} opacity="0.95" />
      <path d="M86 36C86 36 83 66 57 82C66 72 74 58 80 45C82.5 39.5 86 36 86 36Z" fill={`url(#r${uid})`} opacity="0.95" />
    </svg>
  );
}

export function LilyLogo({ className }: { className?: string }) {
  return (
    <span className={cn("group inline-flex items-center gap-2.5", className)}>
      <LilyMark className="h-7 w-7 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110" />
      <span className="font-display text-xl font-extrabold tracking-[0.04em] text-foreground">LILY</span>
    </span>
  );
}
