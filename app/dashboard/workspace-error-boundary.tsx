"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: (Error & { digest?: string }) | null;
}

/**
 * `app/dashboard/error.tsx` only covers the segment's *pages*, not the layout
 * that renders the workspace query. The shell suspends on that query, so a
 * thrown fetch there would blank the entire app with no recovery path; this
 * boundary sits above the shell to catch exactly that case.
 */
export class WorkspaceErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error & { digest?: string }): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[dashboard] workspace shell crashed", error, info.componentStack);
  }

  render() {
    const { error } = this.state;

    if (!error) return this.props.children;

    return (
      <div className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface/70 p-8 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full border border-destructive/30 bg-destructive/10">
            <AlertTriangle className="size-5 text-destructive" />
          </div>
          <h1 className="mt-5 font-display text-xl">We could not open your workspace.</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The workspace request failed. Nothing was changed — reload to try again.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
            >
              <RefreshCw className="size-3.5" />
              Reload workspace
            </Button>
          </div>
          {error.digest && (
            <p className="mt-5 font-mono text-[11px] text-muted-foreground">Ref: {error.digest}</p>
          )}
        </div>
      </div>
    );
  }
}
