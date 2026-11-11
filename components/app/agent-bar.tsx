"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Sparkles, X, Loader2 } from "lucide-react";
import { workspaceKey } from "@/lib/workspace";
import type { AgentResult } from "@/lib/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function AgentBar() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  async function run(command = input) {
    if (busy || !command.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: command }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Command failed.");
      setResult(data);
      setInput("");
      await queryClient.invalidateQueries({ queryKey: workspaceKey });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Command failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-4 z-50 max-w-[calc(100vw-2rem)] sm:right-8">
      {open ? (
        <section
          aria-label="LILY command console"
          className="glass max-h-[calc(100dvh-2.5rem)] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-3xl border border-primary/20 p-5 shadow-glow"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-primary">
              <Sparkles className="size-4" /> Your pipeline, in motion
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close command bar"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run();
            }}
            className="flex items-center gap-2 rounded-2xl border border-border bg-background/60 p-2"
          >
            <input
              ref={ref}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-label="Pipeline command"
              placeholder="Move a deal, draft a pitch, find your focus…"
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
              disabled={busy}
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Execute command"
              disabled={busy || !input.trim()}
              className="rounded-full"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </Button>
          </form>

          {result && (
            <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4 text-xs leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">{result.message}</p>
              {result.drafts && result.drafts.length > 0 && (
                <div className="mt-3 space-y-2">
                  {result.drafts.slice(0, 3).map((d) => (
                    <div key={d.id} className="rounded-xl border border-border p-2">
                      <p className="break-words font-semibold text-primary">{d.subject}</p>
                      <p className="line-clamp-3 break-words text-[11px] leading-4 text-muted-foreground">
                        {d.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="glass flex items-center gap-2 rounded-full border border-primary/30 px-4 py-2.5 text-xs text-primary shadow-glow transition hover:scale-105 active:scale-95"
        >
          <Sparkles className="size-3.5" />
          <span className="font-medium">Command bar</span>
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ⌘J
          </kbd>
        </button>
      )}
    </div>
  );
}
