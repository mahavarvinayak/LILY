import { LilyMark } from "./lily-mark";

export function LilyLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <LilyMark className="relative h-14 w-14 animate-float text-primary" />
      </div>
      <p className="font-display text-lg italic text-muted-foreground">{label}…</p>
    </div>
  );
}
