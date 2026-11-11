"use client";

import { useState } from "react";
import { Bell, CheckCheck, Clock, Send, Sparkles, Building2, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-ui";
import { api, workspaceKey } from "@/lib/workspace";
import { formatDate, cn } from "@/lib/utils";

export function ActivityCenter() {
  const d = useWorkspace();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isMarking, setIsMarking] = useState(false);

  const activities = d.activities || [];
  const unreadCount = activities.filter((a) => !a.read).length;

  async function handleMarkAllRead() {
    setIsMarking(true);
    try {
      await api.markAllActivitiesRead();
      await qc.invalidateQueries({ queryKey: workspaceKey });
    } catch {}
    setIsMarking(false);
  }

  function getActionIcon(action: string) {
    switch (action) {
      case "email_dispatched":
        return <Send className="size-3.5 text-primary" />;
      case "lead_injected":
      case "batch_ingest":
        return <Building2 className="size-3.5 text-emerald-400" />;
      case "draft_generated":
        return <Sparkles className="size-3.5 text-sky-400" />;
      case "task_completed":
        return <CheckCircle2 className="size-3.5 text-amber-400" />;
      default:
        return <Clock className="size-3.5 text-muted-foreground" />;
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Activity Center"
        className="relative flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary font-mono text-[9px] font-bold text-primary-foreground animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="font-display text-xl text-foreground">
                  Activity Center
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Real-time updates, AI agent actions, and pipeline events.
                </SheetDescription>
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isMarking}
                  onClick={handleMarkAllRead}
                  className="h-7 gap-1 text-[11px] text-muted-foreground hover:text-primary"
                >
                  <CheckCheck className="size-3" />
                  Mark all read
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            {activities.length ? (
              activities.map((act) => (
                <div
                  key={act.id}
                  className={cn(
                    "rounded-xl border p-3.5 transition-colors text-xs",
                    act.read
                      ? "border-border/60 bg-card/50"
                      : "border-primary/30 bg-primary/5",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
                      {getActionIcon(act.action)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-foreground text-xs">{act.title}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatDate(act.created_at)}
                        </span>
                      </div>
                      {act.description && (
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                          {act.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <Clock className="mx-auto size-8 opacity-40 mb-2" />
                No activities logged yet.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
