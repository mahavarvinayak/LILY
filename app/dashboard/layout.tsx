"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  QueryClient,
  QueryClientProvider,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  Target,
  Building2,
  Users,
  CheckSquare,
  UserCheck,
  ShieldCheck,
  LayoutDashboard,
  Plug,
  Settings,
  PanelLeft,
  Search,
  LogOut,
  Send,
} from "lucide-react";
import { workspaceQuery } from "@/lib/workspace";
import { parseIcpConfig } from "@/lib/icp";
import { LilyLogo } from "@/components/lily/lily-mark";
import { LilyLoader } from "@/components/lily/lily-loader";
import { ActivityCenter } from "@/components/app/activity-center";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { initials, cn, nameFromEmail } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const getNavGroups = (isAdmin: boolean) => [
  {
    label: "Command",
    items: [
      { label: "Overview", href: "/dashboard/overview", icon: LayoutDashboard },
      { label: "Opportunities", href: "/dashboard/opportunities", icon: Target },
      { label: "Outreach Studio", href: "/dashboard/outreach", icon: Send },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Companies", href: "/dashboard/companies", icon: Building2 },
      { label: "People", href: "/dashboard/people", icon: Users },
      { label: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
      { label: "Team", href: "/dashboard/team", icon: UserCheck },
    ],
  },
  {
    label: "System",
    items: [
      ...(isAdmin
        ? [{ label: "Operator Admin", href: "/dashboard/admin", icon: ShieldCheck }]
        : []),
      { label: "Connectors", href: "/dashboard/connectors", icon: Plug },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data } = useSuspenseQuery(workspaceQuery());
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");

  const navGroups = getNavGroups(data.isAdmin);
  const nav = navGroups.flatMap((group) => group.items);

  const isIcpConfigured = Boolean(parseIcpConfig(data.profile?.target_niche)?.completed);
  const needsCalibration = !data.pending && !isIcpConfigured && !data.isAdmin;

  useEffect(() => {
    if (needsCalibration) {
      router.replace("/onboarding");
    }
  }, [needsCalibration, router]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);

  useEffect(() => setMobile(false), [pathname]);

  const counts: Record<string, number> = {
    "/dashboard/opportunities": data.opportunities.length,
    "/dashboard/outreach": data.opportunities.filter((o) => !o.outreach_dispatched).length,
    "/dashboard/companies": data.companies.length,
    "/dashboard/people": data.people.length,
    "/dashboard/tasks": data.tasks.filter((t) => !t.completed).length,
  };

  async function signOut() {
    try {
      const supabase = createClient();
      if (supabase) await supabase.auth.signOut();
    } catch {}
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {}
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    queryClient.clear();
    toast.success("Signed out.");
    window.location.href = "/login";
  }

  const navigation = (compact: boolean) => (
    <div className="flex h-full flex-col p-4">
      <div className="mb-9 flex h-10 items-center justify-between">
        {compact ? (
          <span className="font-display text-2xl text-primary">L.</span>
        ) : (
          <LilyLogo />
        )}
      </div>
      <p className="mb-2 px-3 text-[10px] uppercase tracking-[.2em] text-muted-foreground">
        {compact ? "·" : "Workspace"}
      </p>
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!compact && (
              <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[.2em] text-muted-foreground/70">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((n) => {
                const active = pathname === n.href;
                const count = counts[n.href];
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    title={n.label}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors",
                      active
                        ? "bg-primary/12 font-semibold text-primary"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                    )}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-primary"
                        aria-hidden
                      />
                    )}
                    <n.icon className="size-[17px] shrink-0" />
                    {!compact && (
                      <>
                        <span className="flex-1">{n.label}</span>
                        {count !== undefined && (
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                              active
                                ? "bg-primary/20 text-primary"
                                : "bg-white/5 text-muted-foreground",
                            )}
                          >
                            {count}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      {!compact && (
        <div className="mt-auto rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="font-display text-lg italic">Room to grow.</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {data.profile.subscription_tier} · {data.profile.daily_lead_quota} leads / day
            <br />
            Your next chapter starts at 08:00 IST.
          </p>
        </div>
      )}
    </div>
  );

  const entries = [
    ...nav.map((n) => ({
      label: n.label,
      sub: "Page",
      href: n.href,
    })),
    ...data.companies.map((c) => ({
      label: c.name,
      sub: "Company",
      href: "/dashboard/companies",
    })),
    ...data.people.map((p) => ({
      label: `${p.first_name} ${p.last_name || ""}`,
      sub: "Person",
      href: "/dashboard/people",
    })),
    ...data.opportunities.map((o) => ({
      label: o.deal_name,
      sub: o.company?.name || "Deal",
      href: `/dashboard/opportunities?lead=${o.id}`,
    })),
  ].filter((e) =>
    `${e.label} ${e.sub}`.toLowerCase().includes(q.toLowerCase()),
  );

  if (data.pending) {
    return <LilyLoader label="Opening your workspace" />;
  }

  if (needsCalibration) {
    return <LilyLoader label="Redirecting to ICP calibration" />;
  }

  return (
    <div className="relative isolate min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <Image
          src="/assets/lily-valley-moon.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-[.09]"
        />
      </div>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-background/20 via-background/70 to-background" />

      <aside
        className={cn(
          "glass fixed inset-y-0 left-0 z-30 hidden border-r border-border transition-[width] md:block",
          collapsed ? "w-20" : "w-64",
        )}
      >
        {navigation(collapsed)}
      </aside>

      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
          {navigation(false)}
        </SheetContent>
      </Sheet>

      <div
        className={cn(
          "min-w-0 transition-[padding] md:pl-64",
          collapsed && "md:pl-20",
        )}
      >
        <header className="glass sticky top-0 z-20 flex h-20 items-center gap-3 border-b border-border px-4 md:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <PanelLeft className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            aria-label="Collapse navigation"
            onClick={() => setCollapsed((v) => !v)}
          >
            <PanelLeft className="size-5" />
          </Button>

          <button
            className="flex min-w-0 max-w-xl flex-1 items-center gap-3 rounded-xl border border-border-strong bg-surface/60 px-3.5 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="size-4 shrink-0" />
            <span className="hidden sm:inline">Search deals, companies, people…</span>
            <span className="sm:hidden">Search…</span>
            <kbd className="ml-auto hidden rounded border border-border px-2 py-0.5 text-[10px] md:inline">
              ⌘K
            </kbd>
          </button>

          <ActivityCenter />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-3 rounded-full border border-border bg-surface/60 p-1.5 pr-3 text-left text-xs transition hover:border-primary/40"
                aria-label="Account menu"
              >
                <div className="grid size-8 place-items-center rounded-full bg-primary/20 font-mono font-medium text-primary">
                  {initials(data.profile.agency_name)}
                </div>
                <div className="hidden min-w-0 max-w-[11rem] leading-tight sm:block">
                  <p className="truncate font-medium text-foreground">
                    {data.profile.agency_name}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {nameFromEmail(data.profile.contact_email)}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="w-full cursor-pointer">
                  Workspace Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void signOut()}
                className="text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 size-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="p-4 pb-24 md:p-8 md:pb-28">{children}</main>
      </div>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-border">
            <DialogTitle className="sr-only">Quick search</DialogTitle>
            <DialogDescription className="sr-only">
              Find deals, companies, or navigate the app
            </DialogDescription>
            <div className="flex items-center gap-3">
              <Search className="size-4 text-muted-foreground" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Type a deal, company, or page…"
                className="border-none bg-transparent shadow-none focus-visible:ring-0 text-sm"
              />
            </div>
          </DialogHeader>
          <div className="max-h-[min(20rem,60dvh)] overflow-y-auto overscroll-contain p-2">
            {entries.length ? (
              entries.map((e, i) => (
                <Link
                  key={i}
                  href={e.href}
                  onClick={() => setSearchOpen(false)}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  <span className="min-w-0 truncate">{e.label}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {e.sub}
                  </span>
                </Link>
              ))
            ) : (
              <p className="p-4 text-center text-xs text-muted-foreground">
                No matching records.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const dynamic = "force-dynamic";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardShell>{children}</DashboardShell>
    </QueryClientProvider>
  );
}

