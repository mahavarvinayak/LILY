"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";
import { Header, Panel, useWorkspace } from "@/components/app/workspace-ui";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/app/ui-kit";
import { formatDate } from "@/lib/utils";

interface AdminClient {
  id: string;
  agency_name: string;
  contact_email: string;
  target_niche: string | null;
  daily_lead_quota: number;
  subscription_tier: string;
  payment_utr?: string | null;
  payment_verified?: boolean;
  created_at: string;
}

export default function AdminCockpitPage() {
  const data = useWorkspace();
  const router = useRouter();
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!data.pending && !data.isAdmin) {
      router.replace("/dashboard/overview");
    }
  }, [data.isAdmin, data.pending, router]);

  async function loadClients() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/ingest");
      const json = await res.json();
      if (!res.ok || !json.authorized) {
        throw new Error(json.error || "Failed to load operator clients.");
      }
      setClients(json.clients || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load clients.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (data.isAdmin) {
      void loadClients();
    }
  }, [data.isAdmin]);

  async function activateTier(clientId: string, tier: string, quota: number) {
    try {
      setBusyId(clientId);
      const res = await fetch("/api/admin/tier-activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, tier, dailyQuota: quota, paymentVerified: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to activate tier.");
      }
      toast.success(json.message || `Activated ${tier} (${quota} leads/day).`);
      await loadClients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Activation failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (!data.isAdmin) return null;

  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.daily_lead_quota > 0).length;
  const pendingUtrs = clients.filter((c) => Boolean(c.payment_utr && !c.payment_verified)).length;

  return (
    <>
      <Header
        eyebrow="Operator · Command"
        icon={ShieldCheck}
        tone="emerald"
        title="Operator Cockpit."
        description="Verify UPI payments, activate client quotas, and provision daily lead drops."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadClients()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Roster
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Registered Agencies"
          value={totalClients}
          hint="Total workspace profiles"
          icon={ShieldCheck}
          tone="primary"
        />
        <StatTile
          label="Active Client Quotas"
          value={activeClients}
          hint="Daily lead delivery active"
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatTile
          label="Pending UPI UTRs"
          value={pendingUtrs}
          hint="Advance transfers awaiting approval"
          icon={AlertCircle}
          tone="amber"
        />
      </div>

      <Panel>
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2 className="font-display text-xl">Client Agencies Roster</h2>
            <p className="text-xs text-muted-foreground">
              Select any client below to activate their ₹29,000 setup or adjust their daily delivery quota.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pr-4">Agency</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Joined</th>
                <th className="py-3 px-4">Current Quota</th>
                <th className="py-3 px-4">Payment UTR</th>
                <th className="py-3 pl-4 text-right">Quick Activation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {clients.map((c) => {
                const isBusy = busyId === c.id;
                return (
                  <tr key={c.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 pr-4 font-medium text-foreground">
                      {c.agency_name}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                      {c.contact_email}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {formatDate(c.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary font-semibold">
                        {c.subscription_tier} · {c.daily_lead_quota}/day
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {c.payment_utr ? (
                        <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-amber-300">
                          UTR: {c.payment_utr}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={isBusy}
                          onClick={() => void activateTier(c.id, "Starter", 15)}
                          className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs text-white"
                        >
                          <Zap className="size-3" />
                          Activate 15/day
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => void activateTier(c.id, "Growth", 30)}
                          className="h-8 text-xs"
                        >
                          30/day
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => void activateTier(c.id, "Starter", 0)}
                          className="h-8 text-xs text-destructive hover:bg-destructive/10"
                        >
                          Pause
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!clients.length && !loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No client profiles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
