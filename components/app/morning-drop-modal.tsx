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
      <DialogContent className="max-w-md border-primary/30 bg-background/95 backdrop-blur-xl">
        <DialogHeader className="space-y-3">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
            <Sun className="size-6 animate-pulse" />
          </div>
          <DialogTitle className="font-display text-2xl text-foreground">
            Your 08:00 AM Leads Are Live
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            Good morning. Fresh commercial signals have arrived on your dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold uppercase tracking-wider text-primary text-[10px]">
              Daily Morning Drop
            </span>
            <span className="font-mono text-emerald-400 font-semibold">
              {todayDropCount} Verified Account{todayDropCount > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-foreground leading-relaxed">
            All intelligence fields, multi-threaded decision-makers, and personalized outreach angles are prepared and ready for review.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-xs">
            Review Later
          </Button>
          <Button
            size="sm"
            asChild
            onClick={handleDismiss}
            className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Link href="/dashboard/opportunities">
              <span>Inspect Opportunities</span>
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
