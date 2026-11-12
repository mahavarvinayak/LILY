"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The dashboard shell suspends on a live workspace query, so a Supabase outage
 * or a thrown fetch used to blank the whole app with no recovery affordance.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] render failed", error);
  }, [error]);

  return (
    <div className="grid min-h-[60dvh] place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface/70 p-8 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full border border-destructive/30 bg-destructive/10">
          <AlertTriangle className="size-5 text-destructive" />
        </div>
        <h1 className="mt-5 font-display text-xl text-foreground">This view could not load.</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Something interrupted the workspace request. Your data is safe — try again, or head back
          to the overview.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" onClick={reset} className="gap-1.5">
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/overview">Back to overview</Link>
          </Button>
        </div>
        {error.digest && (
          <p className="mt-5 font-mono text-[11px] text-muted-foreground">Ref: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
