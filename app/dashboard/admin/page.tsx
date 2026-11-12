"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Zap, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { Header, Panel, useWorkspace } from "@/components/app/workspace-ui";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/app/ui-kit";
import { formatDate } from "@/lib/utils";
import { SUBSCRIPTION_TIERS, SUBSCRIPTION_TIER_NAMES, type SubscriptionTier } from "@/lib/constants";

interface AdminClient {
  id: string;
  agency_name: string;
  contact_email: string;
  target_niche: string | null;
  daily_lead_quota: number;
  subscription_tier: string;
  payment_utr?: string | null;
  payment_verified?: boolean;
  payment_amount?: number;
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

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/ingest");
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.authorized) {
        throw new Error(json?.error || "Failed to load operator clients.");
      }
      setClients(json.clients || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load clients.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (data.isAdmin) {
      void loadClients();
    }
  }, [data.isAdmin, loadClients]);

  async function callActivate(body: {
    clientId: string;
    tier?: SubscriptionTier;
    dailyQuota?: number;
    paymentVerified?: boolean;
  }) {
    const res = await fetch("/api/admin/tier-activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error || "Failed to update the workspace.");
    }
    return json as { message?: string };
  }

  async function activateTier(clientId: string, tier: SubscriptionTier) {
    const { quota } = SUBSCRIPTION_TIERS[tier];
    try {
      setBusyId(clientId);
      // Only a payment confirmation should stamp payment_verified; activating a
      // plan used to mark the account paid even when no money had arrived.
      const json = await callActivate({ clientId, tier, dailyQuota: quota });
      toast.success(json.message || `Activated ${tier} (${quota} leads/day).`);
      await loadClients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Activation failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function pauseClient(clientId: string) {
    try {
      setBusyId(clientId);
      const json = await callActivate({ clientId, dailyQuota: 0 });
      toast.success(json.message || "Delivery paused for this workspace.");
      await loadClients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not pause the workspace.");
    } finally {
      setBusyId(null);
    }
  }

  async function verifyPayment(client: AdminClient) {
    const tier = (SUBSCRIPTION_TIER_NAMES as string[]).includes(client.subscription_tier)
      ? (client.subscription_tier as SubscriptionTier)
      : "Starter";
    try {
      setBusyId(client.id);
      const json = await callActivate({
        clientId: client.id,
        tier,
        dailyQuota: client.daily_lead_quota || SUBSCRIPTION_TIERS[tier].quota,
        paymentVerified: true,
      });
      toast.success(json.message || "Payment marked as verified.");
      await loadClients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not verify the payment.");
    } finally {
      setBusyId(null);
    }
  }

  if (!data.isAdmin) return null;

  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.daily_lead_quota > 0).length;
  const pendingUtrs = clients.filter((c) => Boolean(c.payment_utr) && !c.payment_verified).length;

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
          hint="Total client workspace profiles"
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
          hint="Submitted references awaiting verification"
          icon={AlertCircle}
          tone="amber"
        />
      </div>

      <Panel>
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2 className="font-display text-xl">Client Agencies Roster</h2>
            <p className="text-xs text-muted-foreground">
              Activate a plan to set the daily quota, verify a submitted UTR once the transfer has
              landed, or pause delivery by setting the quota to zero.
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
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 pl-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {clients.map((c) => {
                const isBusy = busyId === c.id;
                const pendingUtr = Boolean(c.payment_utr) && !c.payment_verified;
                return (
                  <tr key={c.id} className="transition-colors hover:bg-white/5">
                    <td className="py-3 pr-4 font-medium text-foreground">{c.agency_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {c.contact_email}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(c.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                        {c.subscription_tier} · {c.daily_lead_quota}/day
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.payment_verified ? (
                        <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                          <CheckCircle2 className="size-3" />
                          Verified
                          {c.payment_amount ? ` · ₹${c.payment_amount.toLocaleString("en-IN")}` : ""}
                        </span>
                      ) : c.payment_utr ? (
                        <div className="flex flex-col gap-1">
                          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-amber-300">
                            UTR: {c.payment_utr}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => void verifyPayment(c)}
                            className="h-7 text-[11px]"
                          >
                            Mark paid
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No UTR submitted</span>
                      )}
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {SUBSCRIPTION_TIER_NAMES.map((tier) => (
                          <Button
                            key={tier}
                            size="sm"
                            variant={tier === "Starter" ? "default" : "outline"}
                            disabled={isBusy}
                            onClick={() => void activateTier(c.id, tier)}
                            className={
                              tier === "Starter"
                                ? "h-8 gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-500"
                                : "h-8 text-xs"
                            }
                            title={`₹${SUBSCRIPTION_TIERS[tier].price.toLocaleString("en-IN")}/mo · ${SUBSCRIPTION_TIERS[tier].quota} leads/day`}
                          >
                            {tier === "Starter" && <Zap className="size-3" />}
                            {tier} {SUBSCRIPTION_TIERS[tier].quota}/day
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isBusy || c.daily_lead_quota === 0}
                          onClick={() => void pauseClient(c.id)}
                          className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10"
                        >
                          <PauseCircle className="size-3" />
                          Pause
                        </Button>
                      </div>
                      {pendingUtr && (
                        <p className="mt-1 text-[11px] text-amber-300">
                          UTR awaiting verification
                        </p>
                      )}
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
