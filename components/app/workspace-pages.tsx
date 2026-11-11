import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Building2,
  ExternalLink,
  ArrowUpRight,
  Download,
  Users,
  Copy,
  Check,
  Send,
  Search,
  MapPin,
  Target,
  Radar,
  Wallet,
  CheckSquare,
  Settings,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CompanyFavicon } from "./company-favicon";
import { export31FieldsToCsv } from "@/lib/export-csv";
import { extractLeadIntelligence, type LeadIntelligence31 } from "@/lib/intelligence";

const moonArt = "/assets/lily-valley-moon.webp";
import { animate, motion, useReducedMotion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api, useWorkspaceMutation } from "@/lib/workspace";
import { STAGES, STAGE_META, type Task } from "@/lib/types";
import { parseIcpConfig } from "@/lib/icp";
import { formatInr, formatDate, cn, nameFromEmail, initials } from "@/lib/utils";
import {
  Header,
  Panel,
  Empty,
  CreateRecord,
  DeleteButton,
  useWrite,
  useWorkspace,
  useOptimistic,
  Countdown,
  Field,
  fieldClass,
} from "./workspace-ui";
import {
  Pill,
  StatTile,
  SectionHeading,
  TierPill,
  PriorityPill,
  ChannelBadge,
  stageToneFor,
  tableClasses,
  type Tone,
} from "./ui-kit";

function intentTone(intent?: string | null): Tone {
  const value = (intent || "").toLowerCase();
  if (value.includes("high") || value.includes("active")) return "rose";
  if (value.includes("expansion") || value.includes("medium")) return "amber";
  return "neutral";
}

function Counter({ value, currency = false }: { value: number; currency?: boolean | undefined }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const control = animate(0, value, {
      duration: reduced ? 0 : 0.7,
      onUpdate: (v) => {
        if (ref.current)
          ref.current.textContent = currency
            ? formatInr(Math.round(v), true)
            : Math.round(v).toLocaleString("en-IN");
      },
    });
    return () => control.stop();
  }, [value, currency, reduced]);
  return <span ref={ref}>{currency ? formatInr(value, true) : value}</span>;
}
export function HomePage() {
  const d = useWorkspace();
  const open = d.opportunities.filter((o) => o.stage !== "Lost" && o.stage !== "Customer");
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
  const today = formatter.format(new Date());
  const tasks = d.tasks.filter(
    (t) => !t.completed && t.due_at && formatter.format(new Date(t.due_at)) === today,
  );
  return (
    <>
      <Header
        eyebrow="This morning · Command overview"
        icon={Target}
        tone="primary"
        title={`Welcome back, ${nameFromEmail(d.profile.contact_email) || d.profile.agency_name}.`}
        description="A little clarity. A lot of possibility. Here’s where your next chapter begins."
      />
      <Panel className="relative mb-6 flex flex-wrap items-center justify-between gap-6 overflow-hidden border-primary/30 bg-primary/5">
        <Image src={moonArt} alt="" fill sizes="(min-width: 768px) 60vw, 100vw" className="pointer-events-none -z-10 object-cover opacity-40 animate-[hero-zoom_30s_ease-in-out_infinite_alternate]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-primary">The morning ritual</p>
          <h2 className="mt-2 font-display text-2xl">Fresh signals. At first light.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your next lead drop · 08:00 IST · up to {d.profile.daily_lead_quota} leads
          </p>
        </div>
        <div className="relative text-3xl text-primary">
          <Countdown />
        </div>
      </Panel>
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="Open pipeline"
          value={<Counter value={open.reduce((s, o) => s + o.deal_value, 0)} currency />}
          hint={`${open.length} active deals`}
          icon={Wallet}
          tone="emerald"
        />
        <StatTile
          label="Opportunities"
          value={<Counter value={d.opportunities.length} />}
          hint={`${d.opportunities.filter((o) => o.stage === "New Lead").length} awaiting triage`}
          icon={Target}
          tone="primary"
        />
        <StatTile
          label="Companies"
          value={<Counter value={d.companies.length} />}
          hint={`${d.people.length} decision makers`}
          icon={Building2}
          tone="sky"
        />
        <StatTile
          label="Tasks to do"
          value={<Counter value={d.tasks.filter((t) => !t.completed).length} />}
          hint={`${tasks.length} due today`}
          icon={CheckSquare}
          tone="amber"
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel variant="flush">
          <SectionHeading
            eyebrow="Revenue board"
            title="A pipeline taking shape"
            meta={`${d.opportunities.length} deals`}
            action={
              <Link href="/dashboard/opportunities" className="text-xs font-semibold text-primary hover:underline">
                Open board →
              </Link>
            }
          />
          <div className="p-5">
            {STAGES.map((s) => {
              const rows = d.opportunities.filter((o) => o.stage === s);
              return (
                <div key={s} className="mb-4 last:mb-0">
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                      <span className={cn("size-2 rounded-full", STAGE_META[s].dot)} />
                      {s}
                      <span className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {rows.length}
                      </span>
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatInr(
                        rows.reduce((a, o) => a + o.deal_value, 0),
                        true,
                      )}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <motion.div
                      initial={false}
                      animate={{
                        width: `${d.opportunities.length ? (rows.length / d.opportunities.length) * 100 : 0}%`,
                      }}
                      className={cn("h-full rounded-full", STAGE_META[s].dot)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel variant="flush">
          <SectionHeading
            eyebrow="Execution"
            title="Today, with intention"
            meta={`${tasks.length} due today`}
          />
          <div className="space-y-2 p-5">
            {tasks.length ? (
              tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface/50 px-3.5 py-3"
                >
                  <span className="min-w-0 flex-1 break-words text-[13px] leading-5 text-foreground">
                    {t.title}
                  </span>
                  <PriorityPill priority={t.priority} />
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border-strong p-6 text-center">
                <p className="text-sm text-foreground">A little breathing room</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  No tasks due today. Make space for your next meaningful conversation.
                </p>
                <div className="mt-4 flex justify-center">
                  <CreateRecord kind="task" />
                </div>
              </div>
            )}
          </div>
        </Panel>
        <Panel variant="flush" className="lg:col-span-2">
          <SectionHeading
            eyebrow="Fresh from the valley"
            title="Latest arrivals"
            meta={`${d.opportunities.length} total`}
            action={<CreateRecord kind="deal" />}
          />
          <div className="p-5">
            {d.opportunities.length ? (
              <div className="grid gap-3 md:grid-cols-3">
                {d.opportunities.slice(0, 6).map((o) => (
                  <Link
                    key={o.id}
                    href={`/dashboard/opportunities?lead=${o.id}`}
                    className="group rounded-xl border border-border-strong bg-surface/60 p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Pill tone={stageToneFor(o.stage)}>{o.stage}</Pill>
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {formatInr(o.deal_value, true)}
                      </span>
                    </div>
                    <h3 className="my-2.5 break-words font-display text-xl leading-snug">
                      {o.deal_name}
                    </h3>
                    <p className="line-clamp-2 break-words text-xs leading-5 text-muted-foreground">
                      {o.company?.name || "Independent opportunity"}
                      {o.buying_trigger ? ` · ${o.buying_trigger}` : ""}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty
                title="Your first opportunity is waiting"
                description="Add a deal now, or return when your first verified leads arrive."
              />
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
export function DirectoryPage({ kind }: { kind: "companies" | "people" }) {
  const d = useWorkspace();
  const [q, setQ] = useState("");
  const [asc, setAsc] = useState(true);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const dc = useWrite(api.deleteCompany, "Company deleted");
  const dp = useWrite(api.deletePerson, "Person deleted");

  function copyText(key: string, val: string) {
    if (!val) return;
    void navigator.clipboard.writeText(val);
    setCopiedKey(key);
    toast.success("Copied to clipboard.");
    setTimeout(() => setCopiedKey(null), 2000);
  }

  const companyRows = d.companies.map((c) => {
    const matchedPeople = d.people.filter((p) => p.company_id === c.id);
    const matchedOpp = d.opportunities.find((o) => o.company_id === c.id);
    const intel = matchedOpp
      ? extractLeadIntelligence(matchedOpp, c, matchedPeople[0])
      : null;
    return {
      id: c.id,
      name: c.name,
      domain: c.domain || null,
      location: c.location || "—",
      tech_stack: c.tech_stack || [],
      website: c.website,
      linkedin_url: c.linkedin_url || intel?.company_linkedin_url || null,
      employee_count: c.employee_count || intel?.employee_count || null,
      industry: c.industry || intel?.industry_niche || null,
      contacts: matchedPeople,
      opportunity: matchedOpp,
      intel,
      rawCompany: c,
    };
  });

  const peopleRows = d.people.map((p) => {
    const matchedCompany = d.companies.find((c) => c.id === p.company_id);
    const matchedOpp = d.opportunities.find(
      (o) => o.person_id === p.id || o.company_id === p.company_id,
    );
    const intel = matchedOpp
      ? extractLeadIntelligence(matchedOpp, matchedCompany, p)
      : null;
    return {
      id: p.id,
      name: `${p.first_name} ${p.last_name || ""}`.trim(),
      title: p.job_title || "Decision Maker",
      role_tier: p.role_tier || "primary",
      company: matchedCompany,
      email: p.email || "",
      linkedin_url: p.linkedin_url,
      opportunity: matchedOpp,
      intel,
      rawPerson: p,
    };
  });

  const filteredCompanies = companyRows
    .filter((c) =>
      `${c.name} ${c.domain} ${c.location} ${c.industry || ""} ${c.contacts.map((p) => `${p.first_name} ${p.last_name || ""} ${p.job_title}`).join(" ")}`
        .toLowerCase()
        .includes(q.toLowerCase()),
    )
    .sort((a, b) => (asc ? 1 : -1) * a.name.localeCompare(b.name));

  const filteredPeople = peopleRows
    .filter((p) =>
      `${p.name} ${p.title} ${p.company?.name || ""} ${p.email}`
        .toLowerCase()
        .includes(q.toLowerCase()),
    )
    .sort((a, b) => (asc ? 1 : -1) * a.name.localeCompare(b.name));

  const inspectedCompany =
    kind === "companies" ? companyRows.find((c) => c.id === inspectId) : null;
  const inspectedPerson =
    kind === "people" ? peopleRows.find((p) => p.id === inspectId) : null;

  const currentIntel: LeadIntelligence31 | null = inspectedCompany
    ? inspectedCompany.intel ||
      (inspectedCompany.opportunity
        ? extractLeadIntelligence(
            inspectedCompany.opportunity,
            inspectedCompany.rawCompany,
            inspectedCompany.contacts[0],
          )
        : null)
    : inspectedPerson
      ? inspectedPerson.intel ||
        (inspectedPerson.opportunity
          ? extractLeadIntelligence(
              inspectedPerson.opportunity,
              inspectedPerson.company,
              inspectedPerson.rawPerson,
            )
          : null)
      : null;

  const verifiedEmailCount = peopleRows.filter((p) => Boolean(p.email)).length;
  const threadedAccounts = companyRows.filter((c) => c.contacts.length > 1).length;
  const signalCount = companyRows.filter((c) => Boolean(c.intel?.buying_trigger)).length;
  const pipelineValue = d.opportunities.reduce((sum, o) => sum + o.deal_value, 0);
  const totalRows = kind === "companies" ? filteredCompanies.length : filteredPeople.length;

  return (
    <>
      <Header
        eyebrow={kind === "companies" ? "Accounts · Verified intelligence" : "Contacts · Decision makers"}
        icon={kind === "companies" ? Building2 : Users}
        tone={kind === "companies" ? "sky" : "violet"}
        title={kind === "companies" ? "Companies" : "People"}
        description={
          kind === "companies"
            ? "Verified account intelligence. Multi-threaded commercial footprint."
            : "Direct commercial decision-makers. Every leader linked to their organization."
        }
        action={<CreateRecord kind={kind === "companies" ? "company" : "person"} />}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="Accounts"
          value={d.companies.length}
          hint={`${threadedAccounts} multi-threaded`}
          icon={Building2}
          tone="primary"
        />
        <StatTile
          label="Decision makers"
          value={d.people.length}
          hint={`${verifiedEmailCount} with verified email`}
          icon={Users}
          tone="sky"
        />
        <StatTile
          label="Active signals"
          value={signalCount}
          hint="Buying triggers live"
          icon={Radar}
          tone="amber"
        />
        <StatTile
          label="Open pipeline"
          value={formatInr(pipelineValue, true)}
          hint={`${d.opportunities.length} opportunities`}
          icon={Target}
          tone="emerald"
        />
      </div>
      {kind === "people" && verifiedEmailCount > 0 && (
        <div className="mb-4">
          <Pill tone="emerald" dot>
            {verifiedEmailCount} contacts are ready for Outreach Studio
          </Pill>
        </div>
      )}
      <Panel variant="flush">
        <SectionHeading
          eyebrow={kind === "companies" ? "Account directory" : "People directory"}
          title={kind === "companies" ? "Accounts ranked by buying signal" : "Decision makers with direct channels"}
          meta={`${totalRows} of ${kind === "companies" ? companyRows.length : peopleRows.length} records`}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (kind === "companies") {
                  export31FieldsToCsv(
                    companyRows.map((c) => ({
                      opp: c.opportunity,
                      company: c.rawCompany,
                    })),
                    "lily_companies_directory",
                  );
                } else {
                  export31FieldsToCsv(
                    peopleRows.map((p) => ({
                      opp: p.opportunity,
                      company: p.company,
                      person: p.rawPerson,
                    })),
                    "lily_people_directory",
                  );
                }
                toast.success("Downloaded 31-field intelligence CSV.");
              }}
              className="gap-1.5"
            >
              <Download className="size-3.5" />
              Export 31-Field CSV
            </Button>
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="relative w-full max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              aria-label={`Search ${kind}`}
              placeholder={`Search ${kind}, leaders or signals…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setAsc((v) => !v)}>
            Name {asc ? "↑" : "↓"}
          </Button>
        </div>

        {kind === "companies" ? (
          filteredCompanies.length ? (
            <div className="overflow-x-auto">
              <table className={tableClasses.table}>
                <thead>
                  <tr>
                    <th className={tableClasses.th}>Company</th>
                    <th className={tableClasses.th}>Website</th>
                    <th className={tableClasses.th}>Company LinkedIn</th>
                    <th className={tableClasses.th}>HQ Location</th>
                    <th className={tableClasses.th}>Industry</th>
                    <th className={tableClasses.th}>Headcount</th>
                    <th className={tableClasses.th}>Buying Signal</th>
                    <th className={tableClasses.th}>Primary Leader</th>
                    <th className={tableClasses.th}>Multi-Threading</th>
                    <th className={tableClasses.th}>Active Pipeline</th>
                    <th className={cn(tableClasses.th, "text-right")}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.map((c) => {
                    const primaryContact = c.contacts.find((p) => p.role_tier === "primary") || c.contacts[0];
                    const secContact = c.contacts.find((p) => p.role_tier !== "primary") || (c.contacts.length > 1 ? c.contacts[1] : null);

                    return (
                      <tr key={c.id} className={tableClasses.row}>
                        <td
                          className={cn(
                            tableClasses.td,
                            "border-l-2 border-l-transparent transition-colors group-hover:border-l-primary/70",
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-[200px]">
                            <CompanyFavicon
                              domain={c.domain}
                              website={c.website}
                              name={c.name}
                              size={36}
                            />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setInspectId(c.id)}
                                className="block break-words text-left text-sm font-semibold leading-5 text-foreground hover:text-primary hover:underline"
                              >
                                {c.name}
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className={tableClasses.td}>
                          <ChannelBadge kind="website" value={c.website} />
                        </td>
                        <td className={tableClasses.td}>
                          <ChannelBadge kind="linkedin" value={c.linkedin_url} label="Company page" />
                        </td>
                        <td className={tableClasses.td}>
                          <div className="inline-flex items-start gap-1.5 text-xs text-foreground">
                            <MapPin className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 break-words">{c.location || "—"}</span>
                          </div>
                        </td>
                        <td className={tableClasses.td}>
                          {c.industry ? (
                            <Pill
                              tone="violet"
                              title={c.industry}
                              className="max-w-[190px] rounded-lg py-1 text-left leading-4 whitespace-normal"
                            >
                              <span className="line-clamp-2 break-words">{c.industry}</span>
                            </Pill>
                          ) : (
                            <span className="shrink-0 text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className={tableClasses.td}>
                          {c.employee_count ? (
                            <Pill tone="neutral" className="whitespace-nowrap">
                              {c.employee_count}
                            </Pill>
                          ) : (
                            <span className="shrink-0 text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className={tableClasses.td}>
                          {c.intel?.buying_trigger ? (
                            <div className="min-w-[260px] max-w-[320px] space-y-1.5">
                              <p
                                title={c.intel.buying_trigger}
                                className="line-clamp-2 break-words text-xs font-medium leading-relaxed text-foreground"
                              >
                                {c.intel.buying_trigger}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Pill tone={intentTone(c.intel.intent_level)}>
                                  {c.intel.intent_level || "Standard Intent"}
                                </Pill>
                                {c.intel.trigger_age && (
                                  <Pill tone="neutral">{c.intel.trigger_age}</Pill>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs italic text-muted-foreground">
                              No verified trigger yet
                            </span>
                          )}
                        </td>
                        <td className={tableClasses.td}>
                          {primaryContact ? (
                            <div className="space-y-1.5 min-w-[200px]">
                              <div className="flex items-center gap-1.5">
                                <TierPill tier="primary" />
                                <span className="min-w-0 break-words text-xs font-semibold text-foreground">
                                  {primaryContact.first_name} {primaryContact.last_name || ""}
                                </span>
                              </div>
                              <p className="break-words text-[11px] text-muted-foreground">
                                {primaryContact.job_title}
                              </p>
                              <div className="flex items-center gap-1.5">
                                <ChannelBadge kind="linkedin" value={primaryContact.linkedin_url} compact />
                                <ChannelBadge kind="email" value={primaryContact.email} compact />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs italic text-muted-foreground">
                              No linked contact
                            </span>
                          )}
                        </td>
                        <td className={tableClasses.td}>
                          {secContact ? (
                            <div className="space-y-1.5 min-w-[190px]">
                              <div className="flex items-center gap-1.5">
                                <TierPill tier={secContact.role_tier} />
                                <span className="min-w-0 break-words text-xs font-semibold text-foreground">
                                  {secContact.first_name} {secContact.last_name || ""}
                                </span>
                              </div>
                              <p className="break-words text-[11px] text-muted-foreground">
                                {secContact.job_title}
                              </p>
                              <div className="flex items-center gap-1.5">
                                <ChannelBadge kind="linkedin" value={secContact.linkedin_url} compact />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">
                              Solo decision maker
                            </span>
                          )}
                        </td>
                        <td className={tableClasses.td}>
                          {c.opportunity ? (
                            <div className="space-y-1 min-w-[150px]">
                              <Link
                                href={`/dashboard/opportunities?lead=${c.opportunity.id}`}
                                title={c.opportunity.deal_name}
                                className="flex items-start gap-1 text-xs font-semibold text-primary hover:underline"
                              >
                                <span className="line-clamp-2 break-words">
                                  {c.opportunity.deal_name}
                                </span>
                                <ArrowUpRight className="mt-0.5 size-3 shrink-0" />
                              </Link>
                              <p className="text-[11px] text-muted-foreground">
                                {formatInr(c.opportunity.deal_value, true)} ·{" "}
                                <span className={STAGE_META[c.opportunity.stage]?.tone}>
                                  {c.opportunity.stage}
                                </span>
                              </p>
                            </div>
                          ) : (
                            <span className="shrink-0 text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className={cn(tableClasses.td, "text-right")}>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                              onClick={() => setInspectId(c.id)}
                            >
                              Inspect
                              <ArrowUpRight className="size-3" />
                            </Button>
                            <DeleteButton
                              label="company"
                              onDelete={() => void dc.run(c.id)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <Empty
                title={q ? "No matching companies." : "No accounts registered yet."}
                description="Add a target company or wait for the 08:00 AM IST morning lead drop."
                action={!q && <CreateRecord kind="company" />}
              />
            </div>
          )
        ) : filteredPeople.length ? (
          <div className="overflow-x-auto">
            <table className={tableClasses.table}>
              <thead>
                <tr>
                  <th className={tableClasses.th}>Decision Maker</th>
                  <th className={tableClasses.th}>Designation</th>
                  <th className={tableClasses.th}>Company</th>
                  <th className={tableClasses.th}>Website</th>
                  <th className={tableClasses.th}>LinkedIn Profile</th>
                  <th className={tableClasses.th}>Work Email</th>
                  <th className={tableClasses.th}>HQ Location</th>
                  <th className={tableClasses.th}>Buying Signal</th>
                  <th className={tableClasses.th}>Active Pipeline</th>
                  <th className={cn(tableClasses.th, "text-right")}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPeople.map((p) => (
                  <tr key={p.id} className={tableClasses.row}>
                    <td
                      className={cn(
                        tableClasses.td,
                        "border-l-2 border-l-transparent transition-colors group-hover:border-l-primary/70",
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-[180px]">
                        <div className="grid size-9 shrink-0 place-items-center rounded-full border border-primary/25 bg-primary/10 font-mono text-xs font-semibold text-primary">
                          {(p.name[0] || "P").toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setInspectId(p.id)}
                            className="block break-words text-left text-sm font-semibold leading-5 text-foreground hover:text-primary hover:underline"
                          >
                            {p.name}
                          </button>
                          <TierPill tier={p.role_tier} />
                        </div>
                      </div>
                    </td>
                    <td className={tableClasses.td}>
                      <span className="break-words text-xs font-medium text-foreground">
                        {p.title || "Executive"}
                      </span>
                    </td>
                    <td className={tableClasses.td}>
                      {p.company ? (
                        <div className="flex min-w-[170px] items-center gap-2">
                          <CompanyFavicon
                            domain={p.company.domain}
                            website={p.company.website}
                            name={p.company.name}
                            size={26}
                          />
                          <span className="min-w-0 break-words text-xs font-semibold text-foreground">
                            {p.company.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          No company linked
                        </span>
                      )}
                    </td>
                    <td className={tableClasses.td}>
                      <ChannelBadge kind="website" value={p.company?.website} />
                    </td>
                    <td className={tableClasses.td}>
                      <ChannelBadge kind="linkedin" value={p.linkedin_url} label="LinkedIn profile" />
                    </td>
                    <td className={tableClasses.td}>
                      <ChannelBadge kind="email" value={p.email} label={p.email || undefined} />
                    </td>
                    <td className={tableClasses.td}>
                      <div className="inline-flex items-start gap-1.5 text-xs text-foreground">
                        <MapPin className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 break-words">{p.company?.location || "—"}</span>
                      </div>
                    </td>
                    <td className={tableClasses.td}>
                      {p.intel?.buying_trigger ? (
                        <div className="min-w-[240px] max-w-[300px] space-y-1.5">
                          <p
                            title={p.intel.buying_trigger}
                            className="line-clamp-2 break-words text-xs font-medium leading-relaxed text-foreground"
                          >
                            {p.intel.buying_trigger}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Pill tone={intentTone(p.intel.intent_level)}>
                              {p.intel.intent_level || "Standard Intent"}
                            </Pill>
                            {p.intel.trigger_age && (
                              <Pill tone="neutral">{p.intel.trigger_age}</Pill>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          No verified trigger yet
                        </span>
                      )}
                    </td>
                    <td className={tableClasses.td}>
                      {p.opportunity ? (
                        <div className="space-y-1 min-w-[140px]">
                          <Link
                            href={`/dashboard/opportunities?lead=${p.opportunity.id}`}
                            title={p.opportunity.deal_name}
                            className="flex items-start gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            <span className="line-clamp-2 break-words">
                              {p.opportunity.deal_name}
                            </span>
                            <ArrowUpRight className="mt-0.5 size-3 shrink-0" />
                          </Link>
                          <p className="text-[11px] text-muted-foreground">
                            {formatInr(p.opportunity.deal_value, true)} ·{" "}
                            <span className={STAGE_META[p.opportunity.stage]?.tone}>
                              {p.opportunity.stage}
                            </span>
                          </p>
                        </div>
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={cn(tableClasses.td, "text-right")}>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => setInspectId(p.id)}
                        >
                          Inspect
                          <ArrowUpRight className="size-3" />
                        </Button>
                        <DeleteButton
                          label="person"
                          onDelete={() => void dp.run(p.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <Empty
              title={
                q ? "No matching decision-makers." : "No contacts registered yet."
              }
              description="Add a commercial contact or wait for your morning lead drop."
              action={!q && <CreateRecord kind="person" />}
            />
          </div>
        )}
      </Panel>

      <Sheet
        open={Boolean(inspectId)}
        onOpenChange={(open) => !open && setInspectId(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="pb-4 border-b border-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <SheetTitle className="font-display text-2xl">
                  {inspectedCompany
                    ? inspectedCompany.name
                    : inspectedPerson
                      ? inspectedPerson.name
                      : "Dossier"}
                </SheetTitle>
                <SheetDescription>
                  31 Pure Verified Intelligence Fields · 100% Sourced & Factual
                </SheetDescription>
              </div>
              {currentIntel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    export31FieldsToCsv(
                      [
                        {
                          opp: inspectedCompany?.opportunity || inspectedPerson?.opportunity,
                          company: inspectedCompany?.rawCompany || inspectedPerson?.company,
                          person: inspectedCompany?.contacts[0] || inspectedPerson?.rawPerson,
                        },
                      ],
                      `lily_dossier_${(inspectedCompany?.name || inspectedPerson?.name || "lead").replace(/\s+/g, "_")}`,
                    );
                    toast.success("Downloaded account intelligence CSV.");
                  }}
                  className="gap-1.5 text-xs"
                >
                  <Download className="size-3.5" />
                  Export Account CSV
                </Button>
              )}
            </div>
          </SheetHeader>

          {currentIntel ? (
            <div className="mt-6 space-y-6">
              <Tabs defaultValue="foundation" className="w-full">
                <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto p-1 text-xs">
                  <TabsTrigger value="foundation" className="min-w-fit flex-1 px-2.5">
                    Foundation
                  </TabsTrigger>
                  <TabsTrigger value="leadership" className="min-w-fit flex-1 px-2.5">
                    Leadership
                  </TabsTrigger>
                  <TabsTrigger value="signals" className="min-w-fit flex-1 px-2.5">
                    Signals
                  </TabsTrigger>
                  <TabsTrigger value="tech" className="min-w-fit flex-1 px-2.5">
                    Tech Stack
                  </TabsTrigger>
                  <TabsTrigger value="outreach" className="min-w-fit flex-1 px-2.5">
                    Outreach
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="foundation" className="space-y-4 pt-4">
                  <Panel>
                    <div className="flex items-center gap-2 text-primary">
                      <Building2 className="size-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        Company Foundation & Footprint
                      </span>
                    </div>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                        <span className="shrink-0 text-xs text-muted-foreground">01. Company Name</span>
                        <span className="font-medium text-foreground">{currentIntel.company_name}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                        <span className="shrink-0 text-xs text-muted-foreground">02. Domain / Website</span>
                        {currentIntel.website ? (
                          <a
                            href={currentIntel.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-w-0 items-center gap-1 break-all text-right text-primary hover:underline"
                          >
                            {currentIntel.website}
                            <ExternalLink className="size-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                        <span className="shrink-0 text-xs text-muted-foreground">03. Company LinkedIn</span>
                        {currentIntel.company_linkedin_url ? (
                          <a
                            href={currentIntel.company_linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sky-400 hover:underline"
                          >
                            LinkedIn Page
                            <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                        <span className="shrink-0 text-xs text-muted-foreground">04. Headquarters</span>
                        <span className="text-foreground">{currentIntel.headquarters || "—"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                        <span className="shrink-0 text-xs text-muted-foreground">05. Employee Headcount</span>
                        <span className="font-mono text-foreground">{currentIntel.employee_count || "—"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                        <span className="shrink-0 text-xs text-muted-foreground">06. Industry Niche</span>
                        <span className="text-foreground">{currentIntel.industry_niche || "—"}</span>
                      </div>
                      <div className="pt-1">
                        <span className="shrink-0 text-xs text-muted-foreground">07. Value Proposition</span>
                        <p className="mt-1.5 text-xs leading-relaxed text-foreground">
                          {currentIntel.value_proposition || "—"}
                        </p>
                      </div>
                    </div>
                  </Panel>
                </TabsContent>

                <TabsContent value="leadership" className="space-y-4 pt-4">
                  <Panel>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                        Primary Decision Maker (Mandatory)
                      </span>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        Primary
                      </span>
                    </div>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                        <span className="shrink-0 text-xs text-muted-foreground">08. Contact Name</span>
                        <span className="font-semibold text-foreground">{currentIntel.contact_name}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                        <span className="shrink-0 text-xs text-muted-foreground">09. Job Title</span>
                        <span className="text-foreground">{currentIntel.job_title}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                        <span className="shrink-0 text-xs text-muted-foreground">10. Personal LinkedIn</span>
                        {currentIntel.linkedin_url ? (
                          <a
                            href={currentIntel.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sky-400 hover:underline"
                          >
                            Verified Profile
                            <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                        <span className="shrink-0 text-xs text-muted-foreground">11. Tenure at Company</span>
                        <span className="text-foreground">{currentIntel.tenure_at_company || "—"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                        <span className="shrink-0 text-xs text-muted-foreground">12. Follower Count</span>
                        <span className="font-mono text-foreground">{currentIntel.follower_count || "—"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 pt-1 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                        <span className="shrink-0 text-xs text-muted-foreground">13. Corporate Work Email</span>
                        {currentIntel.work_email ? (
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="break-all text-right font-mono text-primary">
                              {currentIntel.work_email}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyText("dossier-email", currentIntel.work_email)}
                              className="text-muted-foreground hover:text-primary"
                            >
                              {copiedKey === "dossier-email" ? (
                                <Check className="size-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">Not publicly verifiable</span>
                        )}
                      </div>
                    </div>
                  </Panel>

                  <Panel>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                        Secondary Decision Maker (Multi-Threading)
                      </span>
                      <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400">
                        Secondary
                      </span>
                    </div>
                    {currentIntel.secondary_contact_name ? (
                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-start justify-between gap-3 border-b border-border pb-2 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                          <span className="shrink-0 text-xs text-muted-foreground">14. Contact Name</span>
                          <span className="font-semibold text-foreground">{currentIntel.secondary_contact_name}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3 border-b border-border pb-2 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                          <span className="shrink-0 text-xs text-muted-foreground">15. Designation</span>
                          <span className="text-foreground">{currentIntel.secondary_contact_title || "Executive"}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3 pt-1 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                          <span className="shrink-0 text-xs text-muted-foreground">16. Personal LinkedIn</span>
                          {currentIntel.secondary_linkedin_url ? (
                            <a
                              href={currentIntel.secondary_linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-sky-400 hover:underline"
                            >
                              Verified Profile
                              <ExternalLink className="size-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        No secondary decision maker recorded for this account.
                      </p>
                    )}
                  </Panel>

                  <Panel>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                        Tertiary Decision Maker (Multi-Threading)
                      </span>
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                        Tertiary
                      </span>
                    </div>
                    {currentIntel.tertiary_contact_name ? (
                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-start justify-between gap-3 border-b border-border pb-2 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                          <span className="shrink-0 text-xs text-muted-foreground">17. Contact Name</span>
                          <span className="font-semibold text-foreground">{currentIntel.tertiary_contact_name}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3 border-b border-border pb-2 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                          <span className="shrink-0 text-xs text-muted-foreground">18. Designation</span>
                          <span className="text-foreground">{currentIntel.tertiary_contact_title || "Technical Lead"}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3 pt-1 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                          <span className="shrink-0 text-xs text-muted-foreground">19. Personal LinkedIn</span>
                          {currentIntel.tertiary_linkedin_url ? (
                            <a
                              href={currentIntel.tertiary_linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-sky-400 hover:underline"
                            >
                              Verified Profile
                              <ExternalLink className="size-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        No tertiary decision maker recorded for this account.
                      </p>
                    )}
                  </Panel>
                </TabsContent>

                <TabsContent value="signals" className="space-y-4 pt-4">
                  <Panel>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Commercial Urgency & Buying Signals
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{currentIntel.trigger_age}</span>
                    </div>
                    <div className="mt-4 space-y-3 text-sm">
                      <div>
                        <span className="shrink-0 text-xs text-muted-foreground">20. Buying Trigger</span>
                        <p className="mt-1 text-xs leading-relaxed text-foreground">
                          {currentIntel.buying_trigger}
                        </p>
                      </div>
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                        <span className="shrink-0 text-xs text-muted-foreground">21. Trigger Age / Timestamp</span>
                        <span className="font-mono text-foreground">{currentIntel.trigger_age || "Active"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                        <span className="shrink-0 text-xs text-muted-foreground">22. Proof Link</span>
                        {currentIntel.trigger_url ? (
                          <a
                            href={currentIntel.trigger_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            Primary Proof Trail
                            <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-3 border-b border-border pb-2 [&>span:last-child]:min-w-0 [&>span:last-child]:break-words [&>span:last-child]:text-right">
                        <span className="shrink-0 text-xs text-muted-foreground">23. Intent Level</span>
                        <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          {currentIntel.intent_level}
                        </span>
                      </div>
                      <div className="pt-1">
                        <span className="shrink-0 text-xs text-muted-foreground">24. Recent Company News / Expansion</span>
                        <p className="mt-1 text-xs leading-relaxed text-foreground">
                          {currentIntel.recent_company_news || "—"}
                        </p>
                      </div>
                    </div>
                  </Panel>
                </TabsContent>

                <TabsContent value="tech" className="space-y-4 pt-4">
                  <Panel>
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      25. Website Tech Stack Footprint
                    </span>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {currentIntel.website_tech_stack.length ? (
                        currentIntel.website_tech_stack.map((t) => (
                          <span
                            key={t}
                            className="rounded-md border border-border bg-card px-2 py-0.5 text-xs text-foreground"
                          >
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </Panel>

                  <Panel>
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      26. Required Engineering Stack (From Active Hiring)
                    </span>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {currentIntel.required_engineering_stack.length ? (
                        currentIntel.required_engineering_stack.map((t) => (
                          <span
                            key={t}
                            className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary"
                          >
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">Standard requirements</span>
                      )}
                    </div>
                  </Panel>
                </TabsContent>

                <TabsContent value="outreach" className="space-y-4 pt-4">
                  <Panel>
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Outreach & Founder Assets
                    </span>
                    <div className="mt-4 space-y-3 text-sm">
                      <div>
                        <span className="shrink-0 text-xs text-muted-foreground">27. Recent Founder Post Context</span>
                        <p className="mt-1 text-xs leading-relaxed text-foreground">
                          {currentIntel.recent_founder_activity || "—"}
                        </p>
                      </div>
                      <div className="border-t border-border pt-3">
                        <span className="shrink-0 text-xs text-muted-foreground">28. High-Conversion Subject Line</span>
                        <p className="mt-1 font-mono text-xs text-foreground">
                          {currentIntel.email_subject_line}
                        </p>
                      </div>
                      <div className="border-t border-border pt-3">
                        <span className="shrink-0 text-xs text-muted-foreground">29. AI Icebreaker Hook</span>
                        <p className="mt-1 text-xs leading-relaxed text-foreground">
                          {currentIntel.ai_icebreaker}
                        </p>
                      </div>
                      <div className="flex justify-between border-t border-border pt-3">
                        <span className="shrink-0 text-xs text-muted-foreground">30. Verification Integrity</span>
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                          {currentIntel.verification_status}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-3">
                        <span className="shrink-0 text-xs text-muted-foreground">31. Source Attribution</span>
                        {currentIntel.source_attribution ? (
                          <a
                            href={currentIntel.source_attribution}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Audit Provenance
                            <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  </Panel>

                  {currentIntel.work_email && (
                    <div className="flex justify-end pt-2">
                      <Link
                        href="/dashboard/outreach"
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        <Send className="size-3.5" />
                        Open in Outreach Studio
                      </Link>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="mt-8 text-center text-xs text-muted-foreground">
              No full intelligence dossier recorded.
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
export function TasksPage() {
  const d = useWorkspace();
  const [filter, setFilter] = useState("open");
  const [priority, setPriority] = useState("all");
  const toggle = useWorkspaceMutation(api.toggleTask);
  const optimistic = useOptimistic();
  const del = useWrite(api.deleteTask, "Task deleted");
  const rows = d.tasks.filter(
    (t) =>
      (filter === "all" || (filter === "completed" ? t.completed : !t.completed)) &&
      (priority === "all" || t.priority === priority),
  );
  const openTasks = d.tasks.filter((t) => !t.completed);
  const overdue = openTasks.filter((t) => t.due_at && new Date(t.due_at).getTime() < Date.now());
  const highPriority = openTasks.filter((t) => t.priority === "high");
  return (
    <>
      <Header
        eyebrow="Execution · Daily queue"
        icon={CheckSquare}
        tone="rose"
        title="Small steps. Real momentum."
        description={`${openTasks.length} open tasks. Keep the queue focused and the conversations moving.`}
        action={<CreateRecord kind="task" />}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="Open tasks" value={openTasks.length} hint="Across the workspace" icon={CheckSquare} tone="primary" />
        <StatTile label="High priority" value={highPriority.length} hint="Needs attention first" icon={Target} tone="rose" />
        <StatTile label="Overdue" value={overdue.length} hint="Past their due date" icon={Radar} tone="amber" />
        <StatTile label="Completed" value={d.tasks.length - openTasks.length} hint={`${d.tasks.length} tasks tracked`} icon={Check} tone="emerald" />
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          aria-label="Task status"
          className={cn(fieldClass, "w-auto")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="open">Open</option>
          <option value="completed">Completed</option>
          <option value="all">All tasks</option>
        </select>
        <select
          aria-label="Priority filter"
          className={cn(fieldClass, "w-auto")}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="all">All priorities</option>
          {["high", "medium", "low"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <span className="text-xs tabular-nums text-muted-foreground">
          {rows.length} shown
        </span>
      </div>
      {rows.length ? (
        <Panel variant="flush">
          <div className="divide-y divide-border">
            {rows.map((t: Task) => {
              const isOverdue = !t.completed && Boolean(t.due_at) && new Date(t.due_at!).getTime() < Date.now();
              return (
                <div key={t.id} className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-primary/[0.04]">
                  <input
                    type="checkbox"
                    aria-label={`Complete ${t.title}`}
                    checked={t.completed}
                    onChange={() =>
                      void optimistic(
                        (data) => ({
                          ...data,
                          tasks: data.tasks.map((row) =>
                            row.id === t.id ? { ...row, completed: !t.completed } : row,
                          ),
                        }),
                        () => toggle.mutateAsync({ id: t.id, completed: !t.completed }),
                      )
                    }
                    className="mt-0.5 size-5 accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={cn(
                          "break-words text-[14px] font-medium leading-5 text-foreground",
                          t.completed && "text-muted-foreground line-through",
                        )}
                      >
                        {t.title}
                      </p>
                      <PriorityPill priority={t.priority} />
                      {isOverdue && <Pill tone="rose">Overdue</Pill>}
                    </div>
                    {t.description && (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{t.description}</p>
                    )}
                    <p className="mt-1 text-[11px] uppercase tracking-[.12em] text-muted-foreground">
                      {t.due_at ? `Due ${formatDate(t.due_at)}` : "No due date"}
                    </p>
                  </div>
                  <DeleteButton label="task" onDelete={() => void del.run(t.id)} />
                </div>
              );
            })}
          </div>
        </Panel>
      ) : (
        <Empty
          title="A clear path ahead"
          description="No tasks match this view. Add a follow-up and give your next conversation a little momentum."
          action={<CreateRecord kind="task" />}
        />
      )}
    </>
  );
}
export function TeamPage() {
  const d = useWorkspace();
  const role = useWrite(api.updateTeamMember, "Role updated");
  const remove = useWrite(api.removeTeamMember, "Member removed");
  return (
    <>
      <Header
        eyebrow="Agency · Roster"
        icon={Users}
        tone="primary"
        title="Good work grows together."
        description="Your agency sales roster. Adding a member sends a welcome notification to their email and tracks deal attribution."
        action={<CreateRecord kind="member" />}
      />
      {d.team_members?.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {d.team_members.map((m) => (
            <Panel key={m.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/25 bg-primary/10 font-mono text-sm font-semibold text-primary">
                    {initials(m.name) || "T"}
                  </div>
                  <div className="min-w-0">
                    <h2 className="break-words font-display text-xl leading-tight">{m.name}</h2>
                    <p className="mt-0.5 break-all text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <Pill tone={m.status === "Active" ? "emerald" : "amber"} dot className="shrink-0">
                  {m.status}
                </Pill>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-4">
                <span className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
                  Role
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Joined {formatDate(m.joined_at)}
                </span>
              </div>
              <select
                aria-label={`Role for ${m.name}`}
                className={cn(fieldClass, "mt-2")}
                value={m.role}
                disabled={role.isPending}
                onChange={(e) => void role.run({ id: m.id, role: e.target.value })}
              >
                {[
                  "Admin",
                  "SDR",
                  "Account Executive",
                  "Viewer",
                  "Owner",
                  "Sales Rep",
                  "BDE",
                  "Manager",
                ].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <div className="mt-3 text-right">
                <DeleteButton label="team member" onDelete={() => void remove.run(m.id)} />
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Empty
          title="Make room for your people"
          description="Add your first teammate to keep your agency roster in one calm, considered place."
          action={<CreateRecord kind="member" />}
        />
      )}
    </>
  );
}
export function SettingsPage() {
  const d = useWorkspace();
  const save = useWrite(api.updateProfile, "Workspace updated");
  return (
    <>
      <Header
        eyebrow="Account · Workspace"
        icon={Settings}
        tone="neutral"
        title="Make yourself at home."
        description="Your workspace identity, delivery preferences and the details that make LILY yours."
      />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel>
          <form
            key={`${d.profile.agency_name}-${d.profile.target_niche}-${d.profile.slack_webhook_url}`}
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await save.run({
                agency_name: String(f.get("agency_name") || ""),
                target_niche: String(f.get("target_niche") || ""),
                slack_webhook_url: String(f.get("slack_webhook_url") || ""),
              });
            }}
          >
            <h2 className="font-display text-2xl">Workspace details</h2>
            <Field
              name="agency_name"
              label="Agency name"
              defaultValue={d.profile.agency_name}
              required
            />
            {(() => {
              const icp = parseIcpConfig(d.profile.target_niche);
              if (icp) {
                return (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <input type="hidden" name="target_niche" value={d.profile.target_niche || ""} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Active ICP Configuration
                      </span>
                      <Link
                        href="/onboarding"
                        className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Edit Parameters <ArrowUpRight className="size-3" />
                      </Link>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Offer:</span>
                        <span className="line-clamp-2 break-words font-medium text-foreground">{icp.service_offer}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Geography:</span>
                        <span className="line-clamp-2 break-words font-medium text-foreground">{icp.target_geography}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Niche:</span>
                        <span className="line-clamp-2 break-words font-medium text-foreground">{icp.target_industry}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Headcount:</span>
                        <span className="line-clamp-2 break-words font-medium text-foreground">{icp.company_size}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Decision Makers:</span>
                        <span className="line-clamp-2 break-words font-medium text-foreground">{icp.decision_makers}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Trigger:</span>
                        <span className="line-clamp-2 break-words font-medium text-foreground">{icp.buying_trigger}</span>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <input type="hidden" name="target_niche" value={d.profile.target_niche || ""} />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-amber-400">ICP Profile Pending</p>
                      <p className="text-[11px] text-muted-foreground">Complete your 7-question profile to activate morning lead drops.</p>
                    </div>
                    <Link
                      href="/onboarding"
                      className="shrink-0 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/30"
                    >
                      Calibrate ICP →
                    </Link>
                  </div>
                </div>
              );
            })()}
            <Field
              name="slack_webhook_url"
              label="Slack incoming webhook"
              type="url"
              defaultValue={d.profile.slack_webhook_url || ""}
            />
            <p className="shrink-0 text-xs text-muted-foreground">
              Use https://hooks.slack.com/services/… to configure your drop digest destination.
            </p>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">Your growing space</h2>
          <dl className="mt-6 space-y-5 text-sm">
            <div>
              <dt className="text-muted-foreground">Contact email</dt>
              <dd className="mt-1 break-all">{d.profile.contact_email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Subscription</dt>
              <dd className="mt-1 text-primary">{d.profile.subscription_tier}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Daily lead quota</dt>
              <dd className="mt-1">{d.profile.daily_lead_quota} leads / day</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Release time</dt>
              <dd className="mt-1">08:00 IST</dd>
            </div>
          </dl>
          <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
            Plan and quota are managed by your operator and shown here as read-only.
          </p>
        </Panel>
      </div>
    </>
  );
}
