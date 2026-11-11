"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug, CheckCircle2, Loader2, RefreshCw, Unlink, ShieldCheck } from "lucide-react";
import { CONNECTOR_LOGOS } from "@/components/app/connector-logos";
import { Header, Panel } from "@/components/app/workspace-ui";
import { Pill } from "@/components/app/ui-kit";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { ConnectedMailbox } from "@/lib/composio";

interface CatalogItem {
  slug: "gmail" | "outlook" | "googlecalendar" | "smtp" | "hubspot" | "slack";
  name: string;
  blurb: string;
  comingSoon: boolean;
}

const CATALOG: CatalogItem[] = [
  {
    slug: "gmail",
    name: "Gmail",
    blurb: "Send personalized AI outreach from your native Google Workspace inbox.",
    comingSoon: false,
  },
  {
    slug: "outlook",
    name: "Outlook",
    blurb: "Microsoft 365 enterprise mail pipeline for agencies operating on Outlook.",
    comingSoon: false,
  },
  {
    slug: "googlecalendar",
    name: "Google Calendar",
    blurb: "Book discovery calls and live client meetings directly on your calendar.",
    comingSoon: false,
  },
  {
    slug: "smtp",
    name: "Universal Custom SMTP (Any Mail)",
    blurb: "Connect any mailbox in the world (Zoho, Titan, App Password, cPanel) via secure encrypted SMTP.",
    comingSoon: false,
  },
  {
    slug: "hubspot",
    name: "HubSpot",
    blurb: "Bi-directional opportunity synchronization with your HubSpot CRM.",
    comingSoon: true,
  },
  {
    slug: "slack",
    name: "Slack",
    blurb: "Real-time deal notifications and morning lead drops directly into your channel.",
    comingSoon: true,
  },
];

export function ConnectorsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [busySlug, setBusySlug] = useState("");
  const [disconnectingId, setDisconnectingId] = useState("");

  const [smtpOpen, setSmtpOpen] = useState(false);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("465");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpSender, setSmtpSender] = useState("");
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);

  const q = useQuery({
    queryKey: ["connectors"],
    queryFn: async () => {
      const res = await fetch("/api/composio/status");
      if (!res.ok) return { ok: false, mailboxes: [] };
      return (await res.json()) as { ok: boolean; mailboxes?: ConnectedMailbox[]; accounts?: ConnectedMailbox[] };
    },
    refetchOnWindowFocus: true,
    staleTime: 5000,
  });

  useEffect(() => {
    if (searchParams.get("composio_connected") === "true") {
      toast.success("Mailbox connection updated successfully.");
      void qc.invalidateQueries({ queryKey: ["connectors"] });
      router.replace("/dashboard/connectors");
    }
  }, [searchParams, qc, router]);

  async function connect(slug: "gmail" | "outlook" | "googlecalendar" | "smtp") {
    if (slug === "smtp") {
      setSmtpOpen(true);
      return;
    }
    setBusySlug(slug);
    try {
      const res = await fetch("/api/composio/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: slug }),
      });
      const data = await res.json();
      if (!res.ok || !data.redirectUrl) {
        throw new Error(data.error || "Could not start connection.");
      }
      window.location.href = data.redirectUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start connection.");
      setBusySlug("");
    }
  }

  async function disconnect(accountId: string) {
    setDisconnectingId(accountId);
    try {
      const endpoint =
        accountId === "custom-smtp-mailbox"
          ? "/api/mailboxes/smtp/disconnect"
          : "/api/composio/disconnect";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: accountId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to disconnect.");
      }
      toast.success("Mailbox disconnected.");
      await qc.invalidateQueries({ queryKey: ["connectors"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to disconnect.");
    } finally {
      setDisconnectingId("");
    }
  }

  async function handleTestSmtp() {
    if (!smtpHost || !smtpUser || !smtpPass) {
      toast.error("Please enter host, email, and password.");
      return;
    }
    setSmtpTesting(true);
    try {
      const res = await fetch("/api/mailboxes/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: smtpHost,
          port: Number(smtpPort) || 465,
          user: smtpUser,
          pass: smtpPass,
          secure: Number(smtpPort) === 465,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Handshake failed.");
      toast.success(data.message || "SMTP handshake verified.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "SMTP handshake failed.");
    } finally {
      setSmtpTesting(false);
    }
  }

  async function handleSaveSmtp() {
    if (!smtpHost || !smtpUser || !smtpPass) {
      toast.error("Please enter host, email, and password.");
      return;
    }
    setSmtpSaving(true);
    try {
      const res = await fetch("/api/mailboxes/smtp/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: smtpHost,
          port: Number(smtpPort) || 465,
          user: smtpUser,
          pass: smtpPass,
          sender_name: smtpSender,
          secure: Number(smtpPort) === 465,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to save SMTP mailbox.");
      toast.success(data.message || "Custom SMTP connected.");
      setSmtpOpen(false);
      setSmtpPass("");
      await qc.invalidateQueries({ queryKey: ["connectors"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to connect mailbox.");
    } finally {
      setSmtpSaving(false);
    }
  }

  const rawMailboxes = q.data?.mailboxes || q.data?.accounts || [];
  const mailboxes: ConnectedMailbox[] = Array.isArray(rawMailboxes) ? rawMailboxes : [];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Header
          eyebrow="System · Connections"
          icon={Plug}
          tone="sky"
          title="Connectors"
          description="Connect your agency tools. LILY acts through them so outreach feels native."
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => void qc.invalidateQueries({ queryKey: ["connectors"] })}
          disabled={q.isFetching}
          className="h-8 gap-1.5 text-xs"
        >
          <RefreshCw className={`size-3.5 ${q.isFetching ? "animate-spin" : ""}`} />
          Refresh Status
        </Button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {CATALOG.map((item) => {
          const Logo = CONNECTOR_LOGOS[item.slug as keyof typeof CONNECTOR_LOGOS];
          const activeMailbox = mailboxes.find(
            (m) =>
              m.status === "active" &&
              (item.slug === "smtp"
                ? m.provider === "custom_smtp" || m.id === "custom-smtp-mailbox"
                : m.provider?.toLowerCase() === item.slug ||
                  m.appName?.toLowerCase() === item.slug),
          );
          const isConnected = Boolean(activeMailbox);

          return (
            <Panel
              key={item.slug}
              className={cn(
                "flex flex-col justify-between p-5",
                isConnected && "border-emerald-500/30",
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border-strong bg-background">
                      {Logo ? <Logo /> : <Plug className="size-5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words font-semibold text-foreground">{item.name}</h3>
                        {item.comingSoon && <Pill tone="neutral">Coming soon</Pill>}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.blurb}</p>
                      {isConnected && activeMailbox && (
                        <p className="mt-2.5 inline-flex max-w-full items-center gap-1.5 break-all font-mono text-xs font-medium text-emerald-300">
                          <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" />
                          {activeMailbox.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {isConnected && (
                    <Pill tone="emerald" className="shrink-0">
                      <CheckCircle2 className="size-3" /> Connected
                    </Pill>
                  )}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
                {item.comingSoon ? (
                  <Button variant="ghost" size="sm" disabled className="h-8 text-xs opacity-50 cursor-not-allowed">
                    Coming Soon
                  </Button>
                ) : isConnected && activeMailbox ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={disconnectingId === activeMailbox.id}
                      onClick={() => void disconnect(activeMailbox.id)}
                      className="h-8 gap-1 text-xs text-muted-foreground hover:text-destructive"
                    >
                      {disconnectingId === activeMailbox.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Unlink className="size-3" />
                      )}
                      Disconnect
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busySlug === item.slug}
                      onClick={() => void connect(item.slug as "gmail" | "outlook" | "googlecalendar" | "smtp")}
                      className="h-8 text-xs"
                    >
                      {busySlug === item.slug && <Loader2 className="mr-1.5 size-3 animate-spin" />}
                      Reconfigure
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    disabled={busySlug === item.slug}
                    onClick={() => void connect(item.slug as "gmail" | "outlook" | "googlecalendar" | "smtp")}
                    className="h-8 text-xs"
                  >
                    {busySlug === item.slug && <Loader2 className="mr-1.5 size-3 animate-spin" />}
                    Connect
                  </Button>
                )}
              </div>
            </Panel>
          );
        })}
      </div>

      <Dialog open={smtpOpen} onOpenChange={setSmtpOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-2xl">
              <ShieldCheck className="size-5 text-emerald-400" />
              Universal Encrypted SMTP
            </DialogTitle>
            <DialogDescription>
              Connect any email address in the world. Passwords are encrypted with AES-256-GCM.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="smtpSender">Sender Display Name</Label>
              <Input
                id="smtpSender"
                value={smtpSender}
                onChange={(e) => setSmtpSender(e.target.value)}
                placeholder="e.g. Vinayak Mahavar"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="smtpUser">Sender Email Address *</Label>
              <Input
                id="smtpUser"
                type="email"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="e.g. outreach@agency.in"
                className="mt-1"
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label htmlFor="smtpHost">SMTP Server Host *</Label>
                <Input
                  id="smtpHost"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.zoho.in"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="smtpPort">Port *</Label>
                <Input
                  id="smtpPort"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="465"
                  className="mt-1"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="smtpPass">App Password / SMTP Password *</Label>
              <Input
                id="smtpPass"
                type="password"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                placeholder="••••••••••••••••"
                className="mt-1"
                required
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                For Gmail / Zoho / Outlook, generate a dedicated App Password from security settings.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
              <Button
                variant="outline"
                type="button"
                size="sm"
                disabled={smtpTesting || smtpSaving}
                onClick={() => void handleTestSmtp()}
              >
                {smtpTesting && <Loader2 className="mr-1.5 size-3 animate-spin" />}
                Test Handshake
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={smtpTesting || smtpSaving}
                onClick={() => void handleSaveSmtp()}
              >
                {smtpSaving && <Loader2 className="mr-1.5 size-3 animate-spin" />}
                Save & Connect Mailbox
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
