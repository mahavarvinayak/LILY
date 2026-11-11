"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sun, ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-ui";

export function MorningDropModal() {
  const d = useWorkspace();
  const [open, setOpen] = useState(false);
  const [todayDropCount, setTodayDropCount] = useState(0);
  const [preview, setPreview] = useState<{ id: string; company: string; trigger: string }[]>([]);

  useEffect(() => {
    if (!d || d.pending) return;

    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
    const todayStr = formatter.format(new Date());
    const storageKey = `lily_drop_alert_${todayStr}`;

    const alreadySeen = localStorage.getItem(storageKey);
    if (alreadySeen) return;

    const now = Date.now();
    const droppedToday = d.opportunities.filter((o) => {
      const scheduledTime = new Date(o.scheduled_at).getTime();
      const schedDateStr = formatter.format(new Date(o.scheduled_at));
      return schedDateStr === todayStr && scheduledTime <= now;
    });

    if (droppedToday.length > 0) {
      setTodayDropCount(droppedToday.length);
      setPreview(
        droppedToday.slice(0, 3).map((o) => ({
          id: o.id,
          company: o.company?.name || o.deal_name,
          trigger: o.buying_trigger || "Verified buying signal",
        })),
      );
      setOpen(true);
    }
  }, [d]);

  function handleDismiss() {
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
    const todayStr = formatter.format(new Date());
    localStorage.setItem(`lily_drop_alert_${todayStr}`, "true");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleDismiss()}>
      <DialogContent className="max-w-lg border-primary/30 bg-background/95 backdrop-blur-xl">
        <DialogHeader className="space-y-3">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
            <Sun className="size-6 animate-pulse" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-primary">
            First light · 08:00 IST
          </p>
          <DialogTitle className="font-display text-2xl text-foreground">
            Good morning. Your drop is live.
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {todayDropCount} verified {todayDropCount === 1 ? "account has" : "accounts have"} landed
            with full intelligence, multi-threaded decision makers and ready outreach angles.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[.16em] text-primary">
              Today&apos;s arrivals
            </span>
            <span className="font-mono text-sm font-semibold text-emerald-300">
              {todayDropCount} {todayDropCount === 1 ? "account" : "accounts"}
            </span>
          </div>
          {preview.length ? (
            <ul className="mt-3 space-y-2">
              {preview.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <p className="break-words text-[13px] font-medium leading-5 text-foreground">
                      {item.company}
                    </p>
                    <p className="mt-0.5 line-clamp-2 break-words text-[11px] leading-4 text-muted-foreground">
                      {item.trigger}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 border-t border-primary/15 pt-3 text-[11px] leading-4 text-muted-foreground">
            All intelligence fields are prepared and ready for your review.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-xs">
            Review later
          </Button>
          <Button variant="outline" size="sm" asChild onClick={handleDismiss} className="text-xs">
            <Link href="/dashboard/opportunities">View pipeline</Link>
          </Button>
          <Button size="sm" asChild onClick={handleDismiss} className="gap-1.5 text-xs">
            <Link href="/dashboard/outreach">
              <span>Open Outreach Studio</span>
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
