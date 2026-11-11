"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Send,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Download,
  Linkedin,
  CheckCircle2,
  ShieldCheck,
  Mail,
} from "lucide-react";
import {
  Header,
  Panel,
  Empty,
  useWorkspace,
  useWrite,
} from "@/components/app/workspace-ui";
import { StatTile, Pill, SectionHeading } from "@/components/app/ui-kit";
import { CompanyFavicon } from "@/components/app/company-favicon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { extractLeadIntelligence } from "@/lib/intelligence";
import { export31FieldsToCsv } from "@/lib/export-csv";
import { api, workspaceKey } from "@/lib/workspace";
import { cn, formatInr } from "@/lib/utils";

export default function OutreachStudioPage() {
  const d = useWorkspace();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isBatchSending, setIsBatchSending] = useState(false);
  const [isDraftingAll, setIsDraftingAll] = useState(false);

  const saveDraft = useWrite(api.updateDraft, "Outreach pitch saved");

  const { data: mailboxData } = useQuery<{
    ok: boolean;
    mailboxes?: Array<{
      id: string;
      email: string;
      appName: string;
      status: string;
      provider: string;
    }>;
  }>({
    queryKey: ["connected-mailboxes"],
    queryFn: async () => {
      const res = await fetch("/api/composio/status");
      return res.json();
    },
  });

  const activeMailbox = mailboxData?.mailboxes?.find((m) => m.status === "active");

  const verifiedLeads = d.opportunities
    .map((opp) => {
      const intel = extractLeadIntelligence(opp, opp.company, opp.person);
      return {
        opp,
        intel,
        hasEmail: Boolean(intel.work_email && intel.work_email.includes("@")),
      };
    })
    .filter((item) => item.hasEmail);

  const filteredLeads = verifiedLeads.filter(
    ({ intel }) =>
      `${intel.company_name} ${intel.contact_name} ${intel.work_email} ${intel.buying_trigger}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );

  const activeItem =
    filteredLeads.find((item) => item.opp.id === selectedId) ||
    filteredLeads[0] ||
    null;

  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [editingOppId, setEditingOppId] = useState<string | null>(null);

  if (activeItem && editingOppId !== activeItem.opp.id) {
    setEditingOppId(activeItem.opp.id);
    setCustomSubject(activeItem.opp.ai_subject_line || activeItem.intel.email_subject_line);
    setCustomBody(activeItem.opp.ai_icebreaker || activeItem.intel.ai_icebreaker);
  }

  function copyText(key: string, val: string) {
    if (!val) return;
    void navigator.clipboard.writeText(val);
    setCopiedKey(key);
    toast.success("Copied to clipboard.");
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function handleSendSingle(oppId: string, to: string, subject: string, body: string) {
    if (!to || !to.includes("@")) {
      toast.error("Valid recipient email is required.");
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId: oppId,
          to,
          subject,
          body,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to dispatch email.");
      }

      toast.success(`Outreach dispatched directly to ${to}.`);
      await qc.invalidateQueries({ queryKey: workspaceKey });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Outreach failed.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleBatchSend() {
    const queue = verifiedLeads.filter((item) => !item.opp.outreach_dispatched);
    if (!queue.length) {
      toast.info("All verified leads already dispatched.");
      return;
    }

    setIsBatchSending(true);
    let successCount = 0;

    for (const item of queue) {
      const to = item.intel.work_email;
      const subject = item.opp.ai_subject_line || item.intel.email_subject_line;
      const body = item.opp.ai_icebreaker || item.intel.ai_icebreaker;

      try {
        const res = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opportunityId: item.opp.id,
            to,
            subject,
            body,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          successCount += 1;
        }
      } catch {}

      await new Promise((r) => setTimeout(r, 2000));
    }

    setIsBatchSending(false);
    await qc.invalidateQueries({ queryKey: workspaceKey });
    toast.success(`Batch dispatch complete. ${successCount} emails sent.`);
  }

  async function handleDraftAllWithAi() {
    setIsDraftingAll(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Generate tailored outreach pitch drafts for all uncontacted leads.",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "AI drafting failed.");
      }
      toast.success("AI generated bespoke drafts for all verified leads.");
      await qc.invalidateQueries({ queryKey: workspaceKey });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI drafting failed.");
    } finally {
      setIsDraftingAll(false);
    }
  }

  const dispatchedCount = verifiedLeads.filter((item) => item.opp.outreach_dispatched).length;
  const readyCount = verifiedLeads.filter((item) => !item.opp.outreach_dispatched).length;
  const queueValue = verifiedLeads.reduce((sum, item) => sum + item.opp.deal_value, 0);
  const dispatchedPct = verifiedLeads.length
    ? Math.round((dispatchedCount / verifiedLeads.length) * 100)
    : 0;

  return (
    <>
      <Header
        eyebrow="Outreach · Human in the loop"
        icon={Send}
        tone="emerald"
        title="Outreach Studio"
        description="Human-in-the-loop review and 1-click dispatch. Only verified corporate emails enter this queue."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                export31FieldsToCsv(
                  verifiedLeads.map((item) => ({
                    opp: item.opp,
                    company: item.opp.company,
                    person: item.opp.person,
                  })),
                  "lily_verified_outreach_queue",
                );
                toast.success("Downloaded verified outreach queue CSV.");
              }}
              className="gap-1.5 text-xs"
            >
              <Download className="size-3.5" />
              Export Queue CSV
            </Button>
            <Button
              size="sm"
              disabled={isBatchSending || readyCount === 0}
              onClick={handleBatchSend}
              className="gap-1.5 text-xs"
            >
              <Send className="size-3.5" />
              {isBatchSending ? "Dispatching..." : `Send All Approved (${readyCount})`}
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="Verified prospects"
          value={verifiedLeads.length}
          hint="Corporate emails verified"
          icon={ShieldCheck}
          tone="sky"
        />
        <StatTile
          label="Ready to send"
          value={readyCount}
          hint="Awaiting your approval"
          icon={Send}
          tone="primary"
        />
        <StatTile
          label="Dispatched"
          value={dispatchedCount}
          hint={`${dispatchedPct}% of the queue`}
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatTile
          label="Queue value"
          value={formatInr(queueValue, true)}
          hint="Verified pipeline in review"
          icon={Download}
          tone="amber"
        />
      </div>

      {!verifiedLeads.length ? (
        <Empty
          title="No verified emails in queue yet"
          description="Leads with verified corporate emails will automatically populate here upon your morning drop."
          action={
            <Link
              href="/dashboard/companies"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-xs font-semibold text-foreground hover:bg-muted"
            >
              Inspect Company Directory
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Panel variant="flush">
              <SectionHeading
                eyebrow="Prospect queue"
                title="Verified decision makers"
                meta={`${filteredLeads.length} in view`}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isDraftingAll}
                    onClick={handleDraftAllWithAi}
                    className="h-8 gap-1 text-[11px] text-primary"
                  >
                    <Sparkles className="size-3" />
                    {isDraftingAll ? "Drafting…" : "Draft all with AI"}
                  </Button>
                }
              />
              <div className="border-b border-border p-3">
                <Input
                  placeholder="Filter by company, name or email…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="max-h-[640px] space-y-2 overflow-y-auto p-3">
                {!filteredLeads.length && (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs leading-5 text-muted-foreground">
                    No verified prospects match “{q}”. Try a company name or email.
                  </div>
                )}
                {filteredLeads.map(({ opp, intel }) => {
                  const isSelected = activeItem?.opp.id === opp.id;
                  const isDispatched = opp.outreach_dispatched;

                  return (
                    <button
                      type="button"
                      key={opp.id}
                      onClick={() => setSelectedId(opp.id)}
                      className={cn(
                        "w-full rounded-xl border-y border-r border-l-2 p-3 text-left transition-colors",
                        isSelected
                          ? "border-l-primary border-y-primary/40 border-r-primary/40 bg-primary/10"
                          : "border-l-transparent border-y-border border-r-border bg-surface/50 hover:border-l-primary/60 hover:bg-surface",
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <CompanyFavicon
                          domain={opp.company?.domain}
                          website={opp.company?.website}
                          name={intel.company_name}
                          size={30}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-[13px] font-semibold text-foreground">
                              {intel.company_name}
                            </p>
                            {isDispatched ? (
                              <Pill tone="emerald" className="shrink-0">
                                <CheckCircle2 className="size-3" />
                                Sent
                              </Pill>
                            ) : (
                              <Pill tone="primary" className="shrink-0">
                                Ready
                              </Pill>
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-2 break-words text-[11px] leading-4 text-muted-foreground">
                            {intel.contact_name} · {intel.contact_title}
                          </p>
                        </div>
                      </div>
                      {intel.buying_trigger && (
                        <p
                          title={intel.buying_trigger}
                          className="mt-2 line-clamp-2 break-words text-[11px] leading-4 text-primary/90"
                        >
                          {intel.buying_trigger}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/70 pt-2 text-[11px] text-muted-foreground">
                        <span className="min-w-0 truncate font-mono">{intel.work_email}</span>
                        <span className="shrink-0">{intel.trigger_age || "Active signal"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className="lg:col-span-7">
            {activeItem ? (
              <Panel variant="flush">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <CompanyFavicon
                      domain={activeItem.opp.company?.domain}
                      website={activeItem.opp.company?.website}
                      name={activeItem.intel.company_name}
                      size={40}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="break-words font-display text-xl leading-tight text-foreground">
                          {activeItem.intel.contact_name}
                        </h2>
                        <Pill tone="emerald" dot>
                          Email verified
                        </Pill>
                        {activeItem.opp.outreach_dispatched && (
                          <Pill tone="sky">
                            <CheckCircle2 className="size-3" />
                            Dispatched
                          </Pill>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {activeItem.intel.contact_title} at{" "}
                        <span className="font-medium text-foreground">
                          {activeItem.intel.company_name}
                        </span>
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span className="inline-flex min-w-0 items-center gap-1 font-mono text-[11px] text-muted-foreground">
                          <Mail className="size-3 shrink-0" />
                          <span className="break-all">{activeItem.intel.work_email}</span>
                        </span>
                        {activeItem.intel.linkedin_url && (
                          <a
                            href={activeItem.intel.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 hover:underline"
                          >
                            <Linkedin className="size-3" />
                            View LinkedIn profile
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 p-5">
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-amber-300">
                        <Sparkles className="size-3.5" />
                        Commercial buying signal
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {activeItem.intel.intent_level && (
                          <Pill tone="rose">{activeItem.intel.intent_level}</Pill>
                        )}
                        {activeItem.intel.trigger_age && (
                          <Pill tone="neutral">{activeItem.intel.trigger_age}</Pill>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      {activeItem.intel.buying_trigger || "No buying trigger recorded yet."}
                    </p>
                    {activeItem.intel.trigger_url && (
                      <a
                        href={activeItem.intel.trigger_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:underline"
                      >
                        Audit proof trail <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <Label htmlFor="pitch-subject" className="text-xs font-semibold text-foreground">
                          Subject line
                        </Label>
                        <button
                          type="button"
                          onClick={() => copyText("pitch-subject", customSubject)}
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                        >
                          {copiedKey === "pitch-subject" ? (
                            <Check className="size-3 text-emerald-400" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                          Copy
                        </button>
                      </div>
                      <Input
                        id="pitch-subject"
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <Label htmlFor="pitch-body" className="text-xs font-semibold text-foreground">
                          Personalized outreach body
                        </Label>
                        <button
                          type="button"
                          onClick={() => copyText("pitch-body", customBody)}
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                        >
                          {copiedKey === "pitch-body" ? (
                            <Check className="size-3 text-emerald-400" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                          Copy
                        </button>
                      </div>
                      <textarea
                        id="pitch-body"
                        rows={8}
                        value={customBody}
                        onChange={(e) => setCustomBody(e.target.value)}
                        className="w-full rounded-xl border border-border-strong bg-background p-3.5 text-sm leading-6 text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  {activeMailbox ? (
                    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-300">
                      <ShieldCheck className="size-4 shrink-0 text-emerald-400" />
                      <span className="min-w-0 break-words">
                        Sending from your connected agency mailbox:{" "}
                        <strong className="font-mono text-foreground">{activeMailbox.email}</strong>{" "}
                        ({activeMailbox.appName})
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-300">
                      <div className="flex items-center gap-2">
                        <Mail className="size-4 shrink-0 text-amber-400" />
                        <span>No client mailbox connected. Connect your Google Workspace, Outlook, or SMTP to send.</span>
                      </div>
                      <Link
                        href="/dashboard/connectors"
                        className="rounded-md border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/30"
                      >
                        Connect Mailbox
                      </Link>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/40 px-5 py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saveDraft.isPending}
                    onClick={() =>
                      saveDraft.run({
                        id: activeItem.opp.id,
                        subject: customSubject,
                        body: customBody,
                      })
                    }
                    className="text-xs"
                  >
                    {saveDraft.isPending ? "Saving…" : "Save custom angles"}
                  </Button>

                  <Button
                    disabled={isSending || !activeMailbox}
                    onClick={() =>
                      handleSendSingle(
                        activeItem.opp.id,
                        activeItem.intel.work_email,
                        customSubject,
                        customBody,
                      )
                    }
                    className="h-10 gap-2 px-5 text-sm"
                  >
                    <Send className="size-4" />
                    {isSending
                      ? "Dispatching…"
                      : activeItem.opp.outreach_dispatched
                        ? "Resend outreach"
                        : "Approve & send now"}
                  </Button>
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
