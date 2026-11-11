import type React from "react";
import { useEffect, useState, type ReactNode } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LilyMark } from "@/components/lily/lily-mark";
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
import { api, workspaceQuery, workspaceKey, useWorkspaceMutation } from "@/lib/workspace";
import type { WorkspaceData } from "@/lib/types";
export const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";
export function useWorkspace() {
  return useSuspenseQuery(workspaceQuery()).data;
}
export function Header({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-xs uppercase tracking-[.24em] text-primary">
          Your agency, in bloom
        </p>
        <h1 className="font-display text-4xl tracking-tight md:text-5xl">{title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Panel({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section style={style} className={`glass isolate rounded-2xl border border-border p-5 ${className}`}>
      {children}
    </section>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-8 text-center">
      <LilyMark className="mb-5 size-16 text-primary" />
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="mb-5 mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
export function Countdown() {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const day = 86400000;
      const offset = 19800000;
      const indiaDay = Math.floor((now + offset) / day);
      let next = indiaDay * day + 8 * 3600000 - offset;
      if (next <= now) next += day;
      setRemaining(Math.max(0, Math.floor((next - now) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono tabular-nums">
      {remaining === null
        ? "—"
        : `${String(Math.floor(remaining / 3600)).padStart(2, "0")}:${String(Math.floor((remaining % 3600) / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`}
    </span>
  );
}
export function Field({
  name,
  label,
  type = "text",
  required = false,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
    </div>
  );
}
export function useWrite<T, R>(fn: (input: T) => Promise<R>, message = "Saved") {
  const mutation = useWorkspaceMutation(fn);
  return {
    ...mutation,
    run: async (input: T) => {
      try {
        await mutation.mutateAsync(input);
        toast.success(message);
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong. Please try again.",
        );
        return false;
      }
    },
  };
}
export function useOptimistic() {
  const qc = useQueryClient();
  return async (update: (data: WorkspaceData) => WorkspaceData, write: () => Promise<unknown>) => {
    await qc.cancelQueries({ queryKey: workspaceKey });
    const previous = qc.getQueryData<WorkspaceData>(workspaceKey);
    if (previous) qc.setQueryData(workspaceKey, update(previous));
    try {
      await write();
      toast.success("Updated");
    } catch (error) {
      if (previous) qc.setQueryData(workspaceKey, previous);
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      await qc.invalidateQueries({ queryKey: workspaceKey });
    }
  };
}
export function DeleteButton({
  onDelete,
  label = "record",
}: {
  onDelete: () => void;
  label?: string;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-destructive"
      onClick={() => {
        if (window.confirm(`Delete this ${label}? This cannot be undone.`)) onDelete();
      }}
    >
      Delete
    </Button>
  );
}
type Kind = "company" | "person" | "deal" | "task" | "member";
export function CreateRecord({ kind }: { kind: Kind }) {
  const [open, setOpen] = useState(false);
  const [dealCompanyId, setDealCompanyId] = useState("");
  const [dealPersonId, setDealPersonId] = useState("");
  const data = useWorkspace();
  const company = useWrite(api.createCompany, "Company added");
  const person = useWrite(api.createPerson, "Person added");
  const deal = useWrite(api.createOpportunity, "Deal added");
  const task = useWrite(api.createTask, "Task added");
  const member = useWrite(
    api.addTeamMember,
    "Member added to roster; no invitation email has been sent",
  );
  const pending =
    company.isPending || person.isPending || deal.isPending || task.isPending || member.isPending;

  const availablePeople = dealCompanyId
    ? data.people.filter((p) => p.company_id === dealCompanyId)
    : data.people;
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        + {kind === "member" ? "Add member" : `New ${kind}`}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">A new {kind}</DialogTitle>
            <DialogDescription>Add a real record to your workspace.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const s = (key: string) => String(f.get(key) || "");
              let ok = false;
              if (kind === "company")
                ok = await company.run({
                  name: s("name"),
                  website: s("website"),
                  location: s("location"),
                  tech_stack: s("tech_stack")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                });
              if (kind === "person")
                ok = await person.run({
                  first_name: s("first_name"),
                  last_name: s("last_name"),
                  job_title: s("job_title"),
                  email: s("email"),
                  linkedin_url: s("linkedin_url"),
                  company_id: s("company_id") || null,
                });
              if (kind === "deal")
                ok = await deal.run({
                  deal_name: s("name"),
                  deal_value: Number(s("value")),
                  company_id: s("company_id") || null,
                  person_id: s("person_id") || null,
                  buying_trigger: s("trigger"),
                });
              if (kind === "task")
                ok = await task.run({
                  title: s("name"),
                  priority: s("priority") as "low" | "medium" | "high",
                  due_at: s("due_at") || null,
                  description: s("description"),
                });
              if (kind === "member")
                ok = await member.run({ name: s("name"), email: s("email"), role: s("role") });
              if (ok) setOpen(false);
            }}
          >
            {kind === "person" ? (
              <>
                <Field name="first_name" label="First name" required />
                <Field name="last_name" label="Last name" />
                <Field name="job_title" label="Job title" />
                <Field name="email" label="Email" type="email" />
                <Field name="linkedin_url" label="LinkedIn URL" type="url" />
              </>
            ) : (
              <Field
                name="name"
                label={
                  kind === "task"
                    ? "Task title"
                    : kind === "deal"
                      ? "Deal name"
                      : kind === "member"
                        ? "Teammate full name"
                        : "Name"
                }
                placeholder={kind === "member" ? "e.g. Rahul Sharma" : undefined}
                required
              />
            )}
            {kind === "company" && (
              <>
                <Field name="website" label="Website" type="url" />
                <Field name="location" label="Location" />
                <Field name="tech_stack" label="Technology stack (comma separated)" />
              </>
            )}
            {kind === "person" && (
              <div className="space-y-2">
                <Label htmlFor="company_id">Company</Label>
                <select id="company_id" name="company_id" className={fieldClass}>
                  <option value="">No company</option>
                  {data.companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {kind === "deal" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="company_id">Company</Label>
                  <select
                    id="company_id"
                    name="company_id"
                    className={fieldClass}
                    value={dealCompanyId}
                    onChange={(e) => {
                      const newCid = e.target.value;
                      setDealCompanyId(newCid);
                      if (dealPersonId) {
                        const matchedPerson = data.people.find((p) => p.id === dealPersonId);
                        if (matchedPerson && matchedPerson.company_id !== newCid) {
                          setDealPersonId("");
                        }
                      }
                    }}
                  >
                    <option value="">Select target company</option>
                    {data.companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="person_id">Decision Maker</Label>
                  <select
                    id="person_id"
                    name="person_id"
                    className={fieldClass}
                    value={dealPersonId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setDealPersonId(pid);
                      if (pid) {
                        const matchedPerson = data.people.find((p) => p.id === pid);
                        if (matchedPerson?.company_id) {
                          setDealCompanyId(matchedPerson.company_id);
                        }
                      }
                    }}
                  >
                    <option value="">Select decision maker</option>
                    {availablePeople.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name || ""} — {p.job_title}
                      </option>
                    ))}
                  </select>
                </div>
                <Field name="value" label="Deal value (INR)" type="number" defaultValue={0} />
                <Field name="trigger" label="Buying trigger" placeholder="e.g. Hiring 3 Senior Engineers" />
              </>
            )}
            {kind === "task" && (
              <>
                <Field name="due_at" label="Due date" type="datetime-local" />
                <Field name="description" label="Description" />
                <Label htmlFor="priority">Priority</Label>
                <select id="priority" name="priority" className={fieldClass}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </>
            )}
            {kind === "member" && (
              <>
                <Field
                  name="email"
                  label="Work email"
                  type="email"
                  placeholder="rahul@agency.in"
                  required
                />
                <Label htmlFor="role">Role</Label>
                <select id="role" name="role" className={fieldClass}>
                  {[
                    "SDR",
                    "BDE",
                    "Account Executive",
                    "Closer",
                    "Manager",
                    "Admin",
                    "Viewer",
                  ].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Adds a roster entry only. Account access and email delivery are not provisioned
                  here.
                </p>
              </>
            )}
            <Button disabled={pending} type="submit" className="w-full">
              {pending ? "Saving…" : "Create record"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
