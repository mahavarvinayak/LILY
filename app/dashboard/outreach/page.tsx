"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import {
  Header,
  Panel,
  Empty,
  useWorkspace,
  useWrite,
} from "@/components/app/workspace-ui";
import { CompanyFavicon } from "@/components/app/company-favicon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { extractLeadIntelligence } from "@/lib/intelligence";
import { export31FieldsToCsv } from "@/lib/export-csv";
import { api, workspaceKey } from "@/lib/workspace";
import { cn } from "@/lib/utils";

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

  return (
    <>
      <Header
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

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Panel className="p-4">
          <p className="text-xs text-muted-foreground">Verified Prospects</p>
          <p className="mt-2 font-display text-2xl text-foreground">{verifiedLeads.length}</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs text-muted-foreground">Ready to Send</p>
          <p className="mt-2 font-display text-2xl text-primary">{readyCount}</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs text-muted-foreground">Dispatched Outreaches</p>
          <p className="mt-2 font-display text-2xl text-emerald-400">{dispatchedCount}</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs text-muted-foreground">Dispatch Engine</p>
          <p className="mt-2 text-sm font-semibold text-foreground">Custom SMTP & Resend</p>
        </Panel>
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
          <div className="lg:col-span-5 space-y-4">
            <Panel className="p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Prospect Queue
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isDraftingAll}
                  onClick={handleDraftAllWithAi}
                  className="h-7 gap-1 text-[11px] text-primary"
                >
                  <Sparkles className="size-3" />
                  {isDraftingAll ? "Drafting..." : "Draft All AI Pitches"}
                </Button>
              </div>

              <Input
                placeholder="Filter by company, name, email..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="mb-3 text-xs"
              />

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filteredLeads.map(({ opp, intel }) => {
                  const isSelected = activeItem?.opp.id === opp.id;
                  const isDispatched = opp.outreach_dispatched;

                  return (
                    <div
                      key={opp.id}
                      onClick={() => setSelectedId(opp.id)}
                      className={cn(
                        "cursor-pointer rounded-xl border p-3 transition-colors",
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border bg-card hover:border-primary/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CompanyFavicon
                            domain={opp.company?.domain}
                            website={opp.company?.website}
                            name={intel.company_name}
                            size={24}
                          />
                          <div>
                            <p className="font-medium text-xs text-foreground">
                              {intel.company_name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {intel.contact_name} · {intel.contact_title}
                            </p>
                          </div>
                        </div>

                        {isDispatched ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium text-emerald-400 shrink-0">
                            <CheckCircle2 className="size-2.5" /> Sent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-medium text-primary shrink-0">
                            Ready
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50 pt-2">
                        <span className="font-mono truncate max-w-[200px]">
                          {intel.work_email}
                        </span>
                        <span>{intel.trigger_age || "Active Signal"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className="lg:col-span-7">
            {activeItem ? (
              <Panel className="space-y-5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <CompanyFavicon
                      domain={activeItem.opp.company?.domain}
                      website={activeItem.opp.company?.website}
                      name={activeItem.intel.company_name}
                      size={36}
                    />
                    <div>
                      <h2 className="font-display text-lg text-foreground">
                        {activeItem.intel.contact_name}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {activeItem.intel.contact_title} at {activeItem.intel.company_name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeItem.intel.linkedin_url && (
                      <a
                        href={activeItem.intel.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground hover:text-sky-400"
                      >
                        <Linkedin className="size-3 text-sky-400" />
                        LinkedIn
                      </a>
                    )}
                    {activeItem.opp.outreach_dispatched && (
                      <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-400">
                        <CheckCircle2 className="size-3.5" /> Dispatched
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold uppercase tracking-wider text-primary text-[10px]">
                      Commercial Buying Signal
                    </span>
                    <span className="text-muted-foreground">{activeItem.intel.trigger_age}</span>
                  </div>
                  <p className="text-foreground leading-relaxed">
                    {activeItem.intel.buying_trigger}
                  </p>
                  {activeItem.intel.trigger_url && (
                    <a
                      href={activeItem.intel.trigger_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      Audit Proof Trail <ExternalLink className="size-2.5" />
                    </a>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label htmlFor="pitch-subject" className="text-xs font-semibold">
                        Subject Line
                      </Label>
                      <button
                        type="button"
                        onClick={() => copyText("pitch-subject", customSubject)}
                        className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1"
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
                      className="text-xs font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label htmlFor="pitch-body" className="text-xs font-semibold">
                        Personalized Outreach Body
                      </Label>
                      <button
                        type="button"
                        onClick={() => copyText("pitch-body", customBody)}
                        className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1"
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
                      className="w-full rounded-xl border border-border bg-surface p-3 text-xs leading-relaxed text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
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
                    {saveDraft.isPending ? "Saving..." : "Save Custom Angles"}
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      disabled={isSending}
                      onClick={() =>
                        handleSendSingle(
                          activeItem.opp.id,
                          activeItem.intel.work_email,
                          customSubject,
                          customBody,
                        )
                      }
                      className="gap-1.5 text-xs"
                    >
                      <Send className="size-3.5" />
                      {isSending ? "Dispatching..." : activeItem.opp.outreach_dispatched ? "Resend Outreach" : "Approve & Send Now"}
                    </Button>
                  </div>
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
