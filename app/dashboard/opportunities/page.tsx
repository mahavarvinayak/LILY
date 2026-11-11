"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  Building2,
  UserCheck,
  ExternalLink,
  Copy,
  Check,
  Download,
  Wallet,
  Mail,
  Radar,
  Target,
} from "lucide-react";
import { api, useWorkspaceMutation } from "@/lib/workspace";
import { STAGES, STAGE_META, type Stage, type OpportunityRecord } from "@/lib/types";
import { formatInr, formatDate, cn } from "@/lib/utils";
import { extractLeadIntelligence } from "@/lib/intelligence";
import { export31FieldsToCsv } from "@/lib/export-csv";
import {
  Header,
  Panel,
  Empty,
  CreateRecord,
  DeleteButton,
  useWorkspace,
  useWrite,
  useOptimistic,
  fieldClass,
  Field,
} from "@/components/app/workspace-ui";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CompanyFavicon } from "@/components/app/company-favicon";
import { Pill, StatTile, stageToneFor } from "@/components/app/ui-kit";

const stages: Stage[] = [...STAGES, "Lost"];

function OpportunitiesContent() {
  const data = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadParam = searchParams.get("lead");
  const qParam = searchParams.get("q") || "";

  const [q, setQ] = useState(qParam);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const reduced = useReducedMotion();
  const update = useWorkspaceMutation(api.updateStage);
  const optimistic = useOptimistic();

  const selected = data.opportunities.find((o) => o.id === leadParam);
  const pipelineValue = data.opportunities.reduce((sum, o) => sum + o.deal_value, 0);
  const openDeals = data.opportunities.filter(
    (o) => o.stage !== "Lost" && o.stage !== "Customer",
  );
  const verifiedForOutreach = data.opportunities.filter((o) => Boolean(o.person?.email)).length;
  const newLeads = data.opportunities.filter((o) => o.stage === "New Lead").length;

  const move = (id: string, stage: Stage) => {
    const row = data.opportunities.find((o) => o.id === id);
    if (!row || row.stage === stage) return;
    void optimistic(
      (d) => ({
        ...d,
        opportunities: d.opportunities.map((o) => (o.id === id ? { ...o, stage } : o)),
      }),
      () => update.mutateAsync({ id, stage }),
    );
  };

  const openDossier = (id: string) => {
    router.push(`/dashboard/opportunities?lead=${id}`);
  };

  const closeDossier = () => {
    router.push("/dashboard/opportunities");
  };

  return (
    <>
      <Header
        eyebrow="Pipeline · Revenue board"
        icon={Target}
        tone="amber"
        title="Let opportunity bloom."
        description="From first signal to lasting partnership. Every meaningful conversation has a place."
        action={<CreateRecord kind="deal" />}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="Pipeline value"
          value={formatInr(pipelineValue, true)}
          hint={`${data.opportunities.length} deals tracked`}
          icon={Wallet}
          tone="emerald"
        />
        <StatTile
          label="Open deals"
          value={openDeals.length}
          hint="Excluding lost & won"
          icon={Target}
          tone="primary"
        />
        <StatTile
          label="Ready for outreach"
          value={verifiedForOutreach}
          hint="Verified emails on file"
          icon={Mail}
          tone="sky"
        />
        <StatTile
          label="New this drop"
          value={newLeads}
          hint="Arrived at 08:00 IST"
          icon={Radar}
          tone="amber"
        />
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Input
          className="max-w-md"
          aria-label="Search opportunities"
          placeholder="Find a deal, company or signal…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-muted-foreground">
            {data.opportunities.filter((o) =>
              `${o.deal_name} ${o.company?.name || ""} ${o.buying_trigger}`
                .toLowerCase()
                .includes(q.toLowerCase()),
            ).length}{" "}
            deals match
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              export31FieldsToCsv(
                data.opportunities.map((opp) => ({
                  opp,
                  company: opp.company,
                  person: opp.person,
                })),
                "lily_pipeline_opportunities",
              );
              toast.success("Downloaded 31-field intelligence CSV.");
            }}
            className="gap-1.5"
          >
            <Download className="size-3.5" />
            Export 31-Field CSV
          </Button>
        </div>
      </div>
      {!data.opportunities.length && (
        <div className="mb-6">
          <Empty
            title="A new season starts here"
            description="Your pipeline is a blank canvas. Add your first deal, or return for your next morning lead drop."
            action={<CreateRecord kind="deal" />}
          />
        </div>
      )}
      <div className="flex gap-4 overflow-x-auto pb-6 snap-x" aria-label="Opportunity board">
        {stages.map((stage) => {
          const rows = data.opportunities.filter(
            (o) =>
              o.stage === stage &&
              `${o.deal_name} ${o.company?.name || ""} ${o.buying_trigger}`
                .toLowerCase()
                .includes(q.toLowerCase()),
          );
          const stageValue = rows.reduce((sum, row) => sum + row.deal_value, 0);
          return (
            <section
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragging;
                if (id) move(id, stage);
                setDragging(null);
                setOver(null);
              }}
              className={cn(
                "min-h-96 w-[290px] shrink-0 snap-start rounded-2xl border border-border-strong bg-surface/50 p-3",
                over === stage && "border-primary bg-primary/[0.07]",
              )}
            >
              <div className="mb-3 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", STAGE_META[stage].dot)} />
                  <h2 className="text-[13px] font-semibold text-foreground">
                    {STAGE_META[stage].short}
                  </h2>
                  <span className="ml-auto rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {rows.length}
                  </span>
                </div>
                <p className="mt-1.5 pl-4 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {formatInr(stageValue, true)}
                </p>
              </div>
              {rows.map((o) => (
                <motion.div key={o.id} layout={!reduced} transition={{ duration: 0.2 }}>
                  <article
                    draggable
                    onDragStart={(e) => {
                      setDragging(o.id);
                      e.dataTransfer.setData("text/plain", o.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    className={cn(
                      "mb-3 rounded-xl border border-border-strong bg-card p-4 shadow-soft transition-colors hover:border-primary/40",
                      dragging === o.id && "opacity-50",
                    )}
                  >
                    <button
                      className="w-full text-left"
                      onClick={() => openDossier(o.id)}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <CompanyFavicon
                          domain={o.company?.domain}
                          website={o.company?.website}
                          name={o.company?.name || o.deal_name}
                          size={20}
                        />
                        <p className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
                          {o.company?.name || "Opportunity"}
                        </p>
                        <Pill tone={stageToneFor(o.stage)} className="ml-auto shrink-0">
                          {STAGE_META[o.stage].short}
                        </Pill>
                      </div>
                      <h3 className="break-words font-display text-lg leading-snug">{o.deal_name}</h3>
                      <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                        {o.buying_trigger || "Your next conversation starts here."}
                      </p>
                      <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
                        <span className="text-sm font-semibold tabular-nums text-primary">
                          {formatInr(o.deal_value, true)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(o.scheduled_at)}
                        </span>
                      </div>
                    </button>
                    <select
                      aria-label={`Move ${o.deal_name} to stage`}
                      value={o.stage}
                      onChange={(e) => move(o.id, e.target.value as Stage)}
                      className={cn(fieldClass, "mt-3 h-8 text-xs")}
                    >
                      {stages.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </article>
                </motion.div>
              ))}
              {!rows.length && (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs leading-relaxed text-muted-foreground">
                  {q ? "No matching deals" : "Room for what comes next."}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Drag between stages on desktop, or use any card’s stage selector on touch and keyboard.
      </p>

      <Sheet
        open={Boolean(leadParam)}
        onOpenChange={(open) => {
          if (!open) closeDossier();
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="break-words font-display text-3xl">
              {selected?.deal_name || "Opportunity unavailable"}
            </SheetTitle>
            <SheetDescription>{selected?.company?.name || "Lead dossier"}</SheetDescription>
          </SheetHeader>
          {selected ? (
            <Dossier
              key={selected.id}
              opportunity={selected}
              onClose={closeDossier}
            />
          ) : (
            <p className="mt-8 text-sm text-muted-foreground">
              This lead may have been removed or is not yet released to your workspace.
            </p>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Dossier({
  opportunity: o,
  onClose,
}: {
  opportunity: OpportunityRecord;
  onClose: () => void;
}) {
  const intel = extractLeadIntelligence(o);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const draft = useWrite(api.updateDraft, "Draft saved");
  const details = useWrite(api.updateOpportunity, "Deal updated");
  const del = useWrite(api.deleteOpportunity, "Deal deleted");

  function copyText(key: string, text: string) {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopiedField(key);
    toast.success("Copied to clipboard.");
    setTimeout(() => setCopiedField(null), 2000);
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Building2 className="size-4 shrink-0 text-primary" />
              <span className="break-words font-semibold text-foreground">{intel.company_name}</span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                {intel.verification_status}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <UserCheck className="size-3.5 text-primary" />
              <span>
                {intel.contact_name} · {intel.contact_title}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {intel.work_email && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => copyText("email", intel.work_email)}
              >
                {copiedField === "email" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                Copy Email
              </Button>
            )}
            {intel.linkedin_url && /^https?:\/\//i.test(intel.linkedin_url) && (
              <a
                href={intel.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                LinkedIn <ExternalLink className="size-3 text-muted-foreground" />
              </a>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="trigger" className="w-full">
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto p-1 text-xs">
          <TabsTrigger value="trigger" className="min-w-fit flex-1 px-2.5">
            Trigger
          </TabsTrigger>
          <TabsTrigger value="contact" className="min-w-fit flex-1 px-2.5">
            Contact
          </TabsTrigger>
          <TabsTrigger value="company" className="min-w-fit flex-1 px-2.5">
            Company
          </TabsTrigger>
          <TabsTrigger value="outreach" className="min-w-fit flex-1 px-2.5">
            Outreach
          </TabsTrigger>
          <TabsTrigger value="audit" className="min-w-fit flex-1 px-2.5">
            Audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trigger" className="space-y-4 pt-4">
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Buying Signal & Urgency
            </span>
            <span className="text-xs text-muted-foreground">{intel.trigger_age}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{intel.buying_trigger}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {intel.intent_level}
            </span>
            {intel.trigger_url && /^https?:\/\//i.test(intel.trigger_url) && (
              <a
                href={intel.trigger_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Source Requisition <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </Panel>

        <Panel>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Required Engineering Stack
          </span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {intel.required_engineering_stack.map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                {skill}
              </span>
            ))}
          </div>
        </Panel>
      </TabsContent>

      <TabsContent value="contact" className="space-y-4 pt-4">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Primary Decision Maker
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              Primary
            </span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Full Name</p>
              <p className="text-sm font-medium text-foreground">{intel.contact_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Job Designation</p>
              <p className="text-sm font-medium text-foreground">{intel.contact_title}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Leadership Tenure</p>
              <p className="text-sm text-foreground">{intel.tenure_at_company || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Follower Tier</p>
              <p className="text-sm text-foreground">{intel.follower_count || "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Work Email Address</p>
              <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
                <span className="min-w-0 break-all font-mono text-xs text-foreground">
                  {intel.work_email || "Email pending audit"}
                </span>
                {intel.work_email && (
                  <button
                    type="button"
                    onClick={() => copyText("contact_email", intel.work_email)}
                    className="shrink-0 text-xs text-primary hover:underline"
                  >
                    {copiedField === "contact_email" ? "Copied" : "Copy"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </Panel>

        {intel.secondary_contact_name && (
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">
                Secondary Decision Maker
              </span>
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400">
                Secondary
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="text-sm font-medium text-foreground">{intel.secondary_contact_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Job Designation</p>
                <p className="text-sm font-medium text-foreground">{intel.secondary_contact_title || "Executive"}</p>
              </div>
              {intel.secondary_linkedin_url && (
                <div className="sm:col-span-2">
                  <a
                    href={intel.secondary_linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"
                  >
                    Verified Profile <ExternalLink className="size-3" />
                  </a>
                </div>
              )}
            </div>
          </Panel>
        )}

        {intel.tertiary_contact_name && (
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                Tertiary Decision Maker
              </span>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                Tertiary
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="text-sm font-medium text-foreground">{intel.tertiary_contact_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Job Designation</p>
                <p className="text-sm font-medium text-foreground">{intel.tertiary_contact_title || "Technical Lead"}</p>
              </div>
              {intel.tertiary_linkedin_url && (
                <div className="sm:col-span-2">
                  <a
                    href={intel.tertiary_linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"
                  >
                    Verified Profile <ExternalLink className="size-3" />
                  </a>
                </div>
              )}
            </div>
          </Panel>
        )}

        <Panel>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Recent Founder Activity
          </span>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {intel.recent_founder_activity || "No recent activity recorded."}
          </p>
        </Panel>
      </TabsContent>

      <TabsContent value="company" className="space-y-4 pt-4">
        <Panel>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Firmographic Foundation
          </span>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Organization</p>
              <p className="text-sm font-medium text-foreground">{intel.company_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Website</p>
              {intel.website ? (
                <a
                  href={intel.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  {intel.website.replace(/^https?:\/\//, "")} <ExternalLink className="size-3" />
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Headquarters</p>
              <p className="text-sm text-foreground">{intel.headquarters || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Headcount</p>
              <p className="text-sm text-foreground">{intel.employee_count || "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Industry & Vertical</p>
              <p className="text-sm text-foreground">{intel.industry_niche || "—"}</p>
            </div>
            <div className="sm:col-span-2 border-t border-border pt-2">
              <p className="text-xs text-muted-foreground">Value Proposition</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground">{intel.value_proposition || "—"}</p>
            </div>
          </div>
        </Panel>

        <Panel>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Recent News & Website Stack
          </span>
          <p className="mt-2 text-xs leading-relaxed text-foreground">{intel.recent_company_news || "—"}</p>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
            {intel.website_tech_stack.map((tech) => (
              <span
                key={tech}
                className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tech}
              </span>
            ))}
          </div>
        </Panel>
      </TabsContent>

      <TabsContent value="outreach" className="space-y-4 pt-4">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await draft.run({
              id: o.id,
              subject: String(f.get("subject") || ""),
              body: String(f.get("body") || ""),
            });
          }}
        >
          <Field
            name="subject"
            label="Email Subject Line"
            defaultValue={intel.email_subject_line}
            required
          />
          <Label htmlFor="body">AI Icebreaker Hook</Label>
          <textarea
            id="body"
            name="body"
            defaultValue={intel.ai_icebreaker}
            maxLength={4000}
            rows={5}
            required
            className={fieldClass}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <Button disabled={draft.isPending} type="submit" size="sm">
              {draft.isPending ? "Saving…" : "Save Custom Angle"}
            </Button>
            {intel.work_email && (
              <Link
                href="/dashboard/outreach"
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs text-primary transition hover:bg-primary/20"
              >
                Open in Outreach Studio →
              </Link>
            )}
          </div>
        </form>
      </TabsContent>

      <TabsContent value="audit" className="space-y-4 pt-4">
        <Panel>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Verification & Attribution
          </span>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">Audit Tag:</span>
              <span className="break-words text-right font-medium text-emerald-400">
                {intel.verification_status}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">Source Attribution:</span>
              <span className="min-w-0 break-all text-right font-mono text-muted-foreground">
                {intel.source_attribution}
              </span>
            </div>
          </div>
        </Panel>

          <form
            className="space-y-4 border-t border-border pt-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await details.run({
                id: o.id,
                patch: {
                  notes: String(f.get("notes") || ""),
                  deal_value: Math.max(0, Number(f.get("value")) || 0),
                },
              });
            }}
          >
            <Field name="value" label="Deal Value (INR)" type="number" defaultValue={o.deal_value} />
            <Label htmlFor="notes">Raw Pipeline Notes / Payload</Label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={o.notes || ""}
              className={fieldClass}
            />
            <Button type="submit" size="sm" disabled={details.isPending}>
              Update Pipeline Entry
            </Button>
          </form>

          <div className="border-t border-border pt-4">
            <DeleteButton
              label="deal"
              onDelete={async () => {
                if (await del.run(o.id)) onClose();
              }}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={null}>
      <OpportunitiesContent />
    </Suspense>
  );
}
