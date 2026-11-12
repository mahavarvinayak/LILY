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
  AlertCircle,
  MessageSquare,
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
import { extractLeadIntelligence, sanitizeTriggerText } from "@/lib/intelligence";
import { export31FieldsToCsv } from "@/lib/export-csv";
import { api, workspaceKey } from "@/lib/workspace";
import { cn, formatInr } from "@/lib/utils";

export default function OutreachStudioPage() {
  const d = useWorkspace();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "has-email" | "ready" | "dispatched">("all");
  const [activeChannel, setActiveChannel] = useState<"email" | "linkedin">("linkedin");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isBatchSending, setIsBatchSending] = useState(false);

  const saveDraft = useWrite(api.updateDraft, "Outreach pitch saved");
  const markContacted = useWrite(api.updateStage, "Marked as contacted on LinkedIn");

  const { data: mailboxData, isError: mailboxQueryFailed } = useQuery<{
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
      if (!res.ok) {
        throw new Error("Could not load connected mailboxes.");
      }
      return res.json();
    },
  });

  const activeMailbox = mailboxData?.mailboxes?.find((m) => m.status === "active");

  const allQueueLeads = d.opportunities.map((opp) => {
    const intel = extractLeadIntelligence(opp, opp.company, opp.person);
    return {
      opp,
      intel,
      hasEmail: Boolean(intel.work_email && intel.work_email.includes("@")),
    };
  });

  const verifiedLeads = allQueueLeads.filter((item) => item.hasEmail);
  const dispatchedLeads = allQueueLeads.filter((item) => item.opp.outreach_dispatched);
  const readyLeads = allQueueLeads.filter((item) => !item.opp.outreach_dispatched);

  const tabFilteredLeads = allQueueLeads.filter((item) => {
    if (filterTab === "has-email") return item.hasEmail;
    if (filterTab === "ready") return !item.opp.outreach_dispatched;
    if (filterTab === "dispatched") return item.opp.outreach_dispatched;
    return true;
  });

  const filteredLeads = tabFilteredLeads.filter(
    ({ intel }) =>
      `${intel.company_name} ${intel.contact_name} ${intel.work_email} ${intel.buying_trigger}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );

  const activeItem =
    filteredLeads.find((item) => item.opp.id === selectedId) ||
    allQueueLeads.find((item) => item.opp.id === selectedId) ||
    filteredLeads[0] ||
    allQueueLeads[0] ||
    null;

  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [customLinkedinNote, setCustomLinkedinNote] = useState("");
  const [customLinkedinMessage, setCustomLinkedinMessage] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [editingOppId, setEditingOppId] = useState<string | null>(null);

  if (activeItem && editingOppId !== activeItem.opp.id) {
    setEditingOppId(activeItem.opp.id);
    setCustomSubject(activeItem.opp.ai_subject_line || activeItem.intel.email_subject_line);
    setCustomBody(activeItem.opp.ai_icebreaker || activeItem.intel.ai_icebreaker);
    setRecipientEmail(activeItem.intel.work_email || "");
    setCustomLinkedinNote(activeItem.intel.linkedin_note || "");
    setCustomLinkedinMessage(activeItem.intel.linkedin_message || "");
  }

  function copyText(key: string, val: string) {
    if (!val) return;
    // Clipboard writes reject on insecure contexts and when the document is
    // not focused; an unhandled rejection used to surface as a console error
    // while the toast still claimed success.
    navigator.clipboard
      .writeText(val)
      .then(() => {
        setCopiedKey(key);
        toast.success("Copied to clipboard.");
        setTimeout(() => setCopiedKey(null), 2000);
      })
      .catch(() => {
        toast.error("Could not copy. Select the text and copy manually.");
      });
  }

  async function handleSendSingle(oppId: string, to: string, subject: string, body: string) {
    const cleanTo = to.trim();
    if (!cleanTo || !cleanTo.includes("@")) {
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
          to: cleanTo,
          subject,
          body,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to dispatch email.");
      }

      toast.success(`Outreach dispatched directly to ${cleanTo}.`);
      await qc.invalidateQueries({ queryKey: workspaceKey });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Outreach failed.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleBatchSend() {
    // Only leads with a real address can be dispatched; sending the whole
    // ready queue meant the route rejected rows with an empty `to` while the
    // UI still reported "batch complete".
    const queue = readyLeads.filter((item) => item.hasEmail);
    if (!queue.length) {
      toast.info("No leads with a verified email are awaiting dispatch.");
      return;
    }

    setIsBatchSending(true);
    let successCount = 0;
    let failureCount = 0;
    let lastError = "";

    for (const item of queue) {
      const to = item.intel.work_email.trim();
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
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok) {
          successCount += 1;
        } else {
          failureCount += 1;
          lastError = data?.error || `Request failed (${res.status}).`;
        }
      } catch (err) {
        failureCount += 1;
        lastError = err instanceof Error ? err.message : "Network error.";
      }

      // Space out sends so a provider does not throttle the whole batch.
      await new Promise((r) => setTimeout(r, 2000));
    }

    setIsBatchSending(false);
    await qc.invalidateQueries({ queryKey: workspaceKey });

    if (successCount > 0) {
      toast.success(
        `Batch dispatch complete. ${successCount} email${successCount === 1 ? "" : "s"} sent.`,
      );
    }
    if (failureCount > 0) {
      toast.error(
        `${failureCount} email${failureCount === 1 ? "" : "s"} failed.${lastError ? ` ${lastError}` : ""}`,
      );
    }
  }

  const dispatchedCount = dispatchedLeads.length;
  const readyCount = readyLeads.length;
  const sendableCount = readyLeads.filter((item) => item.hasEmail).length;
  const totalPipelineCount = allQueueLeads.length;
  const queueValue = allQueueLeads.reduce((sum, item) => sum + item.opp.deal_value, 0);

  return (
    <>
      <Header
        eyebrow="Outreach · Human in the loop"
        icon={Send}
        tone="emerald"
        title="Outreach Studio"
        description="Dual-channel review for Email and LinkedIn. Tailored pitches ready for 1-click execution."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                export31FieldsToCsv(
                  allQueueLeads.map((item) => ({
                    opp: item.opp,
                    company: item.opp.company,
                    person: item.opp.person,
                  })),
                  "lily_pipeline_outreach_queue",
                );
                toast.success("Downloaded pipeline outreach queue CSV.");
              }}
              className="gap-1.5 text-xs"
            >
              <Download className="size-3.5" />
              Export Queue CSV
            </Button>
            <Button
              size="sm"
              disabled={isBatchSending || sendableCount === 0 || !activeMailbox}
              onClick={handleBatchSend}
              className="gap-1.5 text-xs"
            >
              <Send className="size-3.5" />
              {isBatchSending ? "Dispatching..." : `Send All Approved (${sendableCount})`}
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="Pipeline prospects"
          value={totalPipelineCount}
          hint="Accounts ready for outreach"
          icon={ShieldCheck}
          tone="sky"
        />
        <StatTile
          label="Actionable queue"
          value={readyCount}
          hint="Leads ready for outreach"
          icon={Send}
          tone="primary"
        />
        <StatTile
          label="Dispatched"
          value={dispatchedCount}
          hint={`${totalPipelineCount ? Math.round((dispatchedCount / totalPipelineCount) * 100) : 0}% of pipeline contacted`}
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatTile
          label="Pipeline value"
          value={formatInr(queueValue, true)}
          hint="Total pipeline under review"
          icon={Download}
          tone="amber"
        />
      </div>

      {!allQueueLeads.length ? (
        <Empty
          title="No prospects in pipeline yet"
          description="Accounts with verified commercial buying signals will automatically populate here upon your morning drop."
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
                title="Pipeline decision makers"
                meta={`${filteredLeads.length} in view`}
              />
              <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border p-2">
                <button
                  type="button"
                  onClick={() => setFilterTab("all")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium transition",
                    filterTab === "all"
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground",
                  )}
                >
                  All ({allQueueLeads.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("has-email")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium transition",
                    filterTab === "has-email"
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground",
                  )}
                >
                  With Email ({verifiedLeads.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("ready")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium transition",
                    filterTab === "ready"
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground",
                  )}
                >
                  Ready ({readyLeads.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("dispatched")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium transition",
                    filterTab === "dispatched"
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground",
                  )}
                >
                  Sent ({dispatchedLeads.length})
                </button>
              </div>
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
                    No prospects match “{q}”. Try a company name or clear filters.
                  </div>
                )}
                {filteredLeads.map(({ opp, intel, hasEmail }) => {
                  const isSelected = activeItem?.opp.id === opp.id;
                  const isDispatched = opp.outreach_dispatched;
                  const cleanTrigger = sanitizeTriggerText(intel.buying_trigger);

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
                            ) : hasEmail ? (
                              <Pill tone="primary" className="shrink-0">
                                Email + LI
                              </Pill>
                            ) : (
                              <Pill tone="sky" className="shrink-0">
                                LinkedIn Ready
                              </Pill>
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-2 break-words text-[11px] leading-4 text-muted-foreground">
                            {intel.contact_name} · {intel.contact_title}
                          </p>
                        </div>
                      </div>
                      {cleanTrigger && (
                        <p
                          title={cleanTrigger}
                          className="mt-2 line-clamp-2 break-words text-[11px] leading-4 text-primary/90"
                        >
                          {cleanTrigger}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/70 pt-2 text-[11px] text-muted-foreground">
                        <span className="min-w-0 truncate font-mono">
                          {intel.work_email || "Email unlisted"}
                        </span>
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
                        {recipientEmail && recipientEmail.includes("@") ? (
                          <Pill tone="emerald" dot>
                            Email ready
                          </Pill>
                        ) : (
                          <Pill tone="sky" dot>
                            LinkedIn primary
                          </Pill>
                        )}
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

                <div className="flex items-center gap-2 border-b border-border bg-surface/50 p-2.5 px-5">
                  <button
                    type="button"
                    onClick={() => setActiveChannel("email")}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition",
                      activeChannel === "email"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-surface hover:text-foreground",
                    )}
                  >
                    <Mail className="size-3.5" />
                    Email Outreach
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChannel("linkedin")}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition",
                      activeChannel === "linkedin"
                        ? "bg-sky-500 text-white shadow-sm"
                        : "text-muted-foreground hover:bg-surface hover:text-foreground",
                    )}
                  >
                    <Linkedin className="size-3.5" />
                    LinkedIn Outreach
                  </button>
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
                      {sanitizeTriggerText(activeItem.intel.buying_trigger) || "Active operational expansion."}
                    </p>
                  </div>

                  {activeChannel === "email" ? (
                    <>
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <Label htmlFor="pitch-recipient" className="text-xs font-semibold text-foreground">
                            Recipient Decision Maker Email
                          </Label>
                          <span className="text-[11px] text-muted-foreground">
                            Direct destination inbox
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            id="pitch-recipient"
                            type="email"
                            value={recipientEmail}
                            onChange={(e) => setRecipientEmail(e.target.value)}
                            placeholder="e.g. founder@company.com"
                            className="font-mono text-sm"
                          />
                          {recipientEmail && recipientEmail.includes("@") ? (
                            <span className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                              <Check className="size-3" /> Ready
                            </span>
                          ) : (
                            <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400">
                              <AlertCircle className="size-3" /> Required
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <div className="mb-1.5 flex items-center justify-between">
                            <Label htmlFor="pitch-subject" className="text-xs font-semibold text-foreground">
                              Subject line
                            </Label>
                            <div className="flex items-center gap-2">
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
                              Personalized outreach pitch
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
                            rows={10}
                            value={customBody}
                            onChange={(e) => setCustomBody(e.target.value)}
                            className="w-full min-h-[220px] resize-y rounded-xl border border-border-strong bg-background p-3.5 text-sm leading-relaxed text-foreground focus:border-primary focus:outline-none"
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
                            <span>
                              {mailboxQueryFailed
                                ? "Could not load your mailbox status. Refresh before sending."
                                : "No client mailbox connected. Connect your Google Workspace, Outlook, or SMTP to send."}
                            </span>
                          </div>
                          <Link
                            href="/dashboard/connectors"
                            className="rounded-md border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/30"
                          >
                            Connect Mailbox
                          </Link>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-4">
                      {activeItem.intel.linkedin_url && (
                        <div className="flex items-center justify-between rounded-xl border border-sky-500/30 bg-sky-500/10 p-3">
                          <span className="text-xs text-sky-300">
                            Verified LinkedIn destination ready.
                          </span>
                          <a
                            href={activeItem.intel.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-600"
                          >
                            <Linkedin className="size-3.5" />
                            Open Profile in LinkedIn <ExternalLink className="size-3" />
                          </a>
                        </div>
                      )}

                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <Label htmlFor="linkedin-note" className="text-xs font-semibold text-foreground">
                            Connection Request Note (under 300 characters)
                          </Label>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "text-[11px] font-mono",
                                customLinkedinNote.length <= 300 ? "text-emerald-400" : "text-rose-400 font-semibold",
                              )}
                            >
                              {customLinkedinNote.length}/300 chars
                            </span>
                            <button
                              type="button"
                              onClick={() => copyText("linkedin-note", customLinkedinNote)}
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                            >
                              {copiedKey === "linkedin-note" ? (
                                <Check className="size-3 text-emerald-400" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                              Copy Note
                            </button>
                          </div>
                        </div>
                        <textarea
                          id="linkedin-note"
                          rows={4}
                          value={customLinkedinNote}
                          onChange={(e) => setCustomLinkedinNote(e.target.value)}
                          className="w-full min-h-[90px] resize-y rounded-xl border border-border-strong bg-background p-3.5 text-sm leading-relaxed text-foreground focus:border-sky-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <Label htmlFor="linkedin-message" className="text-xs font-semibold text-foreground">
                            InMail / Direct Message Pitch (2-3 sentences)
                          </Label>
                          <button
                            type="button"
                            onClick={() => copyText("linkedin-msg", customLinkedinMessage)}
                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                          >
                            {copiedKey === "linkedin-msg" ? (
                              <Check className="size-3 text-emerald-400" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                            Copy InMail
                          </button>
                        </div>
                        <textarea
                          id="linkedin-message"
                          rows={8}
                          value={customLinkedinMessage}
                          onChange={(e) => setCustomLinkedinMessage(e.target.value)}
                          className="w-full min-h-[170px] resize-y rounded-xl border border-border-strong bg-background p-3.5 text-sm leading-relaxed text-foreground focus:border-sky-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/40 px-5 py-4">
                  {activeChannel === "email" ? (
                    <>
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
                        disabled={isSending || !activeMailbox || !recipientEmail || !recipientEmail.includes("@")}
                        onClick={() =>
                          handleSendSingle(
                            activeItem.opp.id,
                            recipientEmail,
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
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={markContacted.isPending}
                        onClick={() =>
                          markContacted.run({
                            id: activeItem.opp.id,
                            stage: "Screening",
                          })
                        }
                        className="gap-1.5 text-xs"
                      >
                        <MessageSquare className="size-3.5" />
                        {markContacted.isPending ? "Updating…" : "Mark as Contacted on LinkedIn"}
                      </Button>

                      {activeItem.intel.linkedin_url && (
                        <a
                          href={activeItem.intel.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-10 items-center gap-2 rounded-xl bg-sky-500 px-5 text-sm font-semibold text-white transition hover:bg-sky-600"
                        >
                          <Linkedin className="size-4" />
                          Open LinkedIn & Send Note
                        </a>
                      )}
                    </>
                  )}
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
