import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Building2, UserCheck, ExternalLink, ArrowUpRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const moonArt = "/assets/lily-valley-moon.webp";
import { animate, motion, useReducedMotion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api, useWorkspaceMutation } from "@/lib/workspace";
import { STAGES, STAGE_META, type Task } from "@/lib/types";
import { parseIcpConfig } from "@/lib/icp";
import { formatInr, formatDate, cn, nameFromEmail } from "@/lib/utils";
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
        title={`Welcome back, ${nameFromEmail(d.profile.contact_email) || d.profile.agency_name}.`}
        description="A little clarity. A lot of possibility. Here’s where your next chapter begins."
      />
      <Panel className="relative mb-6 flex flex-wrap items-center justify-between gap-6 overflow-hidden border-primary/25 bg-primary/5">
        <Image src={moonArt} alt="" fill sizes="(min-width: 768px) 60vw, 100vw" className="pointer-events-none -z-10 object-cover opacity-40 animate-[hero-zoom_30s_ease-in-out_infinite_alternate]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="relative">
          <p className="text-xs uppercase tracking-widest text-primary">The morning ritual</p>
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
        {[
          {
            label: "Open pipeline",
            value: open.reduce((s, o) => s + o.deal_value, 0),
            currency: true,
          },
          { label: "Opportunities", value: d.opportunities.length },
          { label: "Companies", value: d.companies.length },
          { label: "Tasks to do", value: d.tasks.filter((t) => !t.completed).length },
        ].map((k, i) => (
          <Panel key={k.label} className="animate-[rise_.6s_ease-out_both] transition-transform duration-300 hover:-translate-y-1 hover:border-primary/40" style={{ animationDelay: `${i * 80}ms` }}>
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-3 font-display text-3xl">
              <Counter value={k.value} currency={k.currency} />
            </p>
          </Panel>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-6 font-display text-2xl">A pipeline taking shape</h2>
          {STAGES.map((s) => {
            const rows = d.opportunities.filter((o) => o.stage === s);
            return (
              <div key={s} className="mb-5">
                <div className="mb-2 flex justify-between text-sm">
                  <span className={STAGE_META[s].tone}>{s}</span>
                  <span className="text-muted-foreground">
                    {rows.length} ·{" "}
                    {formatInr(
                      rows.reduce((a, o) => a + o.deal_value, 0),
                      true,
                    )}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
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
          <Link href="/dashboard/opportunities" className="text-sm text-primary">
            Open pipeline →
          </Link>
        </Panel>
        <Panel>
          <h2 className="mb-5 font-display text-2xl">Today, with intention</h2>
          {tasks.length ? (
            tasks.map((t) => (
              <div key={t.id} className="border-b border-border py-3 text-sm">
                {t.title}
                <span className="ml-2 text-xs text-muted-foreground">{t.priority}</span>
              </div>
            ))
          ) : (
            <Empty
              title="A little breathing room"
              description="No tasks due today. Make space for your next meaningful conversation."
              action={<CreateRecord kind="task" />}
            />
          )}
        </Panel>
        <Panel className="lg:col-span-2">
          <div className="mb-5 flex justify-between">
            <h2 className="font-display text-2xl">Fresh from the valley</h2>
            <CreateRecord kind="deal" />
          </div>
          {d.opportunities.length ? (
            <div className="grid gap-3 md:grid-cols-3">
              {d.opportunities.slice(0, 6).map((o) => (
                <Link
                  key={o.id}
                  href={`/dashboard/opportunities?lead=${o.id}`}
                  className="rounded-xl border border-border p-4 transition-colors hover:border-primary/40"
                >
                  <p className="text-xs text-primary">{o.stage}</p>
                  <h3 className="my-2 font-display text-xl">{o.deal_name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {o.company?.name || "Independent opportunity"} · {formatInr(o.deal_value)}
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
  const dc = useWrite(api.deleteCompany, "Company deleted");
  const dp = useWrite(api.deletePerson, "Person deleted");

  const companyRows = d.companies.map((c) => {
    const matchedPeople = d.people.filter((p) => p.company_id === c.id);
    const matchedOpp = d.opportunities.find((o) => o.company_id === c.id);
    return {
      id: c.id,
      name: c.name,
      domain: c.domain || c.location || "Company",
      location: c.location || "—",
      tech_stack: c.tech_stack || [],
      website: c.website,
      contacts: matchedPeople,
      opportunity: matchedOpp,
    };
  });

  const peopleRows = d.people.map((p) => {
    const matchedCompany = d.companies.find((c) => c.id === p.company_id);
    const matchedOpp = d.opportunities.find((o) => o.person_id === p.id);
    return {
      id: p.id,
      name: `${p.first_name} ${p.last_name || ""}`.trim(),
      title: p.job_title || "Decision Maker",
      company: matchedCompany,
      email: p.email || "",
      linkedin_url: p.linkedin_url,
      opportunity: matchedOpp,
    };
  });

  const filteredCompanies = companyRows
    .filter((c) =>
      `${c.name} ${c.domain} ${c.location} ${c.contacts.map((p) => `${p.first_name} ${p.last_name || ""} ${p.job_title}`).join(" ")}`
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

  const inspectedCompany = kind === "companies" ? companyRows.find((c) => c.id === inspectId) : null;
  const inspectedPerson = kind === "people" ? peopleRows.find((p) => p.id === inspectId) : null;

  return (
    <>
      <Header
        title={kind === "companies" ? "Companies" : "People"}
        description={
          kind === "companies"
            ? "Verified account intelligence. Every organization is linked directly to its decision-maker."
            : "Direct commercial decision-makers. Every contact is linked directly to their organization."
        }
        action={<CreateRecord kind={kind === "companies" ? "company" : "person"} />}
      />
      <Panel>
        <div className="mb-5 flex gap-3">
          <Input
            aria-label={`Search ${kind}`}
            placeholder={`Search ${kind}…`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button variant="outline" onClick={() => setAsc((v) => !v)}>
            Name {asc ? "↑" : "↓"}
          </Button>
        </div>

        {kind === "companies" ? (
          filteredCompanies.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3">Organization (Field 1, 2)</th>
                    <th className="p-3">Headquarters (Field 3)</th>
                    <th className="p-3">Decision Maker (Field 7, 8)</th>
                    <th className="p-3">Active Pipeline</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.map((c) => (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => setInspectId(c.id)}
                          className="text-left font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {c.name}
                        </button>
                        {c.website && (
                          <a
                            href={c.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                          >
                            {c.website.replace(/^https?:\/\//, "")} <ExternalLink className="size-2.5" />
                          </a>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{c.location}</td>
                      <td className="p-3">
                        {c.contacts.length ? (
                          <div className="space-y-0.5">
                            {c.contacts.map((p) => (
                              <div key={p.id} className="text-xs">
                                <span className="font-medium text-foreground">
                                  {p.first_name} {p.last_name || ""}
                                </span>
                                <span className="text-muted-foreground"> · {p.job_title}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No linked contact</span>
                        )}
                      </td>
                      <td className="p-3">
                        {c.opportunity ? (
                          <Link
                            href={`/dashboard/opportunities?lead=${c.opportunity.id}`}
                            className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                          >
                            {c.opportunity.deal_name} <ArrowUpRight className="size-3" />
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mr-2 h-7 text-xs"
                          onClick={() => setInspectId(c.id)}
                        >
                          Inspect
                        </Button>
                        <DeleteButton
                          label="company"
                          onDelete={() => void dc.run(c.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title={q ? "No matching companies." : "No accounts registered yet."}
              description="Add a target company or wait for the 08:00 AM IST morning lead drop."
              action={!q && <CreateRecord kind="company" />}
            />
          )
        ) : filteredPeople.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Decision Maker (Field 7, 8)</th>
                  <th className="p-3">Organization (Field 1)</th>
                  <th className="p-3">Channels (Field 9, 12)</th>
                  <th className="p-3">Active Pipeline</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPeople.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => setInspectId(p.id)}
                        className="text-left font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {p.name}
                      </button>
                      <p className="text-xs text-muted-foreground">{p.title}</p>
                    </td>
                    <td className="p-3">
                      {p.company ? (
                        <div className="text-xs">
                          <span className="font-medium text-foreground">{p.company.name}</span>
                          {p.company.location && (
                            <span className="block text-muted-foreground">{p.company.location}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No company linked</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1 text-xs">
                        {p.email && (
                          <a href={`mailto:${p.email}`} className="text-primary hover:underline">
                            {p.email}
                          </a>
                        )}
                        {p.linkedin_url && (
                          <a
                            href={p.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
                          >
                            LinkedIn <ExternalLink className="size-2.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      {p.opportunity ? (
                        <Link
                          href={`/dashboard/opportunities?lead=${p.opportunity.id}`}
                          className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                        >
                          {p.opportunity.deal_name} <ArrowUpRight className="size-3" />
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mr-2 h-7 text-xs"
                        onClick={() => setInspectId(p.id)}
                      >
                        Inspect
                      </Button>
                      <DeleteButton
                        label="person"
                        onDelete={() => void dp.run(p.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={q ? "No matching decision-makers." : "No contacts registered yet."}
            description="Add a commercial contact or wait for your morning lead drop."
            action={!q && <CreateRecord kind="person" />}
          />
        )}
      </Panel>

      <Sheet open={Boolean(inspectId)} onOpenChange={(open) => !open && setInspectId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">
              {inspectedCompany ? inspectedCompany.name : inspectedPerson ? inspectedPerson.name : "Dossier"}
            </SheetTitle>
            <SheetDescription>
              {inspectedCompany
                ? "Organization intelligence and connected decision-makers."
                : "Decision-maker profile and corporate alignment."}
            </SheetDescription>
          </SheetHeader>

          {inspectedCompany && (
            <div className="mt-6 space-y-4">
              <Panel>
                <div className="flex items-center gap-2 text-primary">
                  <Building2 className="size-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Company Profile</span>
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between border-b border-border pb-2">
                    <span className="text-xs text-muted-foreground">Website:</span>
                    <span className="font-medium text-foreground">{inspectedCompany.website || "—"}</span>
                  </div>
                  <div className="flex justify-between border-b border-border pb-2">
                    <span className="text-xs text-muted-foreground">Location:</span>
                    <span className="text-foreground">{inspectedCompany.location}</span>
                  </div>
                  <div className="pt-1">
                    <span className="text-xs text-muted-foreground">Tech Stack:</span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {inspectedCompany.tech_stack.length ? (
                        inspectedCompany.tech_stack.map((t) => (
                          <span key={t} className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs text-muted-foreground">
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Linked Decision Makers</span>
                <div className="mt-3 space-y-2">
                  {inspectedCompany.contacts.length ? (
                    inspectedCompany.contacts.map((p) => (
                      <div key={p.id} className="rounded-xl border border-border p-3 text-xs">
                        <p className="font-semibold text-foreground">{p.first_name} {p.last_name || ""}</p>
                        <p className="text-muted-foreground">{p.job_title}</p>
                        {p.email && <p className="mt-1 font-mono text-primary">{p.email}</p>}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No decision-maker recorded for this organization.</p>
                  )}
                </div>
              </Panel>
            </div>
          )}

          {inspectedPerson && (
            <div className="mt-6 space-y-4">
              <Panel>
                <div className="flex items-center gap-2 text-primary">
                  <UserCheck className="size-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Decision Maker Dossier</span>
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between border-b border-border pb-2">
                    <span className="text-xs text-muted-foreground">Designation:</span>
                    <span className="font-medium text-foreground">{inspectedPerson.title}</span>
                  </div>
                  <div className="flex justify-between border-b border-border pb-2">
                    <span className="text-xs text-muted-foreground">Affiliated Organization:</span>
                    <span className="font-medium text-foreground">{inspectedPerson.company?.name || "—"}</span>
                  </div>
                  <div className="flex justify-between border-b border-border pb-2">
                    <span className="text-xs text-muted-foreground">Work Email:</span>
                    <span className="font-mono text-primary">{inspectedPerson.email || "—"}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-xs text-muted-foreground">LinkedIn:</span>
                    {inspectedPerson.linkedin_url ? (
                      <a href={inspectedPerson.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        Profile Link ↗
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </Panel>
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
  return (
    <>
      <Header
        title="Small steps. Real momentum."
        description={`${d.tasks.filter((t) => !t.completed).length} open tasks. Keep the queue focused and the conversations moving.`}
        action={<CreateRecord kind="task" />}
      />
      <div className="mb-5 flex flex-wrap gap-3">
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
      </div>
      {rows.length ? (
        <Panel>
          {rows.map((t: Task) => (
            <div
              key={t.id}
              className="flex items-center gap-4 border-b border-border py-4 last:border-0"
            >
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
                className="size-5 accent-primary"
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "break-words text-sm",
                    t.completed && "text-muted-foreground line-through",
                  )}
                >
                  {t.title}
                </p>
                {t.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.priority} priority · {t.due_at ? formatDate(t.due_at) : "No due date"}
                </p>
              </div>
              <DeleteButton label="task" onDelete={() => void del.run(t.id)} />
            </div>
          ))}
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
        title="Good work grows together."
        description="Your agency roster. Adding a member records their details; it does not grant account access or send email."
        action={<CreateRecord kind="member" />}
      />
      {d.team_members?.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {d.team_members.map((m) => (
            <Panel key={m.id}>
              <h2 className="font-display text-2xl">{m.name}</h2>
              <p className="mt-1 break-all text-sm text-muted-foreground">{m.email}</p>
              <p className="my-4 text-xs text-primary">
                {m.status} · added {formatDate(m.joined_at)}
              </p>
              <select
                aria-label={`Role for ${m.name}`}
                className={fieldClass}
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
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                        Active ICP Configuration
                      </span>
                      <Link
                        href="/onboarding"
                        className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Edit Parameters <ArrowUpRight className="size-3" />
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Offer:</span>
                        <span className="font-medium text-foreground line-clamp-1">{icp.service_offer}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Geography:</span>
                        <span className="font-medium text-foreground line-clamp-1">{icp.target_geography}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Niche:</span>
                        <span className="font-medium text-foreground line-clamp-1">{icp.target_industry}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Headcount:</span>
                        <span className="font-medium text-foreground line-clamp-1">{icp.company_size}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Decision Makers:</span>
                        <span className="font-medium text-foreground line-clamp-1">{icp.decision_makers}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Trigger:</span>
                        <span className="font-medium text-foreground line-clamp-1">{icp.buying_trigger}</span>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <input type="hidden" name="target_niche" value={d.profile.target_niche || ""} />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-amber-400">ICP Profile Pending</p>
                      <p className="text-[11px] text-muted-foreground">Complete your 7-question profile to activate morning lead drops.</p>
                    </div>
                    <Link
                      href="/onboarding"
                      className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/30"
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
            <p className="text-xs text-muted-foreground">
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
