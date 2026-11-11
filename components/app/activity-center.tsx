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
import { timeAgo, cn } from "@/lib/utils";

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
        return <Building2 className="size-3.5 text-emerald-300" />;
      case "draft_generated":
        return <Sparkles className="size-3.5 text-sky-300" />;
      case "task_completed":
        return <CheckCircle2 className="size-3.5 text-amber-300" />;
      default:
        return <Clock className="size-3.5 text-muted-foreground" />;
    }
  }

  const unread = activities.filter((a) => !a.read);
  const read = activities.filter((a) => a.read);

  function ActivityRow({ act }: { act: (typeof activities)[number] }) {
    return (
      <div
        className={cn(
          "rounded-xl border-l-2 border-y border-r p-3.5 transition-colors",
          act.read
            ? "border-l-transparent border-y-border border-r-border bg-surface/50"
            : "border-l-primary border-y-primary/25 border-r-primary/25 bg-primary/[0.07]",
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-background">
            {getActionIcon(act.action)}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-semibold leading-4 text-foreground">
                {act.title}
              </p>
              <span className="shrink-0 pt-0.5 text-[10px] text-muted-foreground">
                {timeAgo(act.created_at)}
              </span>
            </div>
            {act.description && (
              <p className="text-[12px] leading-5 text-muted-foreground">{act.description}</p>
            )}
            {!act.read && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-primary">
                <span className="size-1.5 rounded-full bg-primary" />
                New
              </span>
            )}
          </div>
        </div>
      </div>
    );
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
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-primary">
              Workspace · Audit trail
            </p>
            <div className="flex items-start justify-between gap-3">
              <div>
                <SheetTitle className="font-display text-2xl text-foreground">
                  Activity Center
                </SheetTitle>
                <SheetDescription className="mt-1 text-xs">
                  {unreadCount > 0
                    ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"} from LILY and your pipeline.`
                    : "Every AI action, dispatch and pipeline event in one place."}
                </SheetDescription>
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isMarking}
                  onClick={handleMarkAllRead}
                  className="h-8 shrink-0 gap-1 text-[11px]"
                >
                  <CheckCheck className="size-3" />
                  {isMarking ? "Marking…" : "Mark all read"}
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {activities.length ? (
              <>
                {unread.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">
                      Unread
                    </p>
                    {unread.map((act) => (
                      <ActivityRow key={act.id} act={act} />
                    ))}
                  </div>
                )}
                {read.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">
                      Earlier
                    </p>
                    {read.map((act) => (
                      <ActivityRow key={act.id} act={act} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <Clock className="mx-auto mb-2 size-8 opacity-40" />
                No activities logged yet.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

