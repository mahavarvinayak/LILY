import "server-only";
import { demoProfiles, demoWorkspace } from "@/lib/demo-data";
import type {
  Company,
  MemberRole,
  OpportunityRecord,
  Person,
  Stage,
  Task,
  TeamMember,
  WorkspaceData,
} from "@/types";

/**
 * Demo mode uses a module-scoped store so the preview stays interactive without
 * Supabase credentials. It resets whenever the server restarts and is never
 * used when NEXT_PUBLIC_SUPABASE_URL is configured.
 */
const state: { workspace: WorkspaceData } = {
  workspace: structuredClone(demoWorkspace),
};

export function getDemoWorkspace(): WorkspaceData {
  return state.workspace;
}

export function setDemoStage(id: string, stage: Stage) {
  const opportunity = state.workspace.opportunities.find((item) => item.id === id);
  if (opportunity) opportunity.stage = stage;
  return opportunity ?? null;
}

export function setDemoDraft(id: string, subject: string, body: string) {
  const opportunity = state.workspace.opportunities.find((item) => item.id === id);
  if (opportunity) {
    opportunity.ai_subject_line = subject;
    opportunity.ai_icebreaker = body;
  }
  return opportunity ?? null;
}

export function setDemoDispatched(id: string, dispatched = true) {
  const opportunity = state.workspace.opportunities.find((item) => item.id === id);
  if (opportunity) opportunity.outreach_dispatched = dispatched;
  return opportunity ?? null;
}

export function toggleDemoTask(id: string, completed: boolean) {
  const task = state.workspace.tasks.find((item) => item.id === id);
  if (task) task.completed = completed;
  return task ?? null;
}

export function addDemoTask(input: {
  title: string;
  description?: string | null;
  due_at?: string | null;
  priority: Task["priority"];
}): Task {
  const task: Task = {
    id: `t-${crypto.randomUUID()}`,
    user_id: state.workspace.profile.id,
    title: input.title,
    description: input.description ?? null,
    due_at: input.due_at ?? null,
    priority: input.priority,
    completed: false,
    created_at: new Date().toISOString(),
  };
  state.workspace.tasks.unshift(task);
  return task;
}

export function addDemoLead(input: {
  company: Omit<Company, "user_id" | "created_at">;
  person: Omit<Person, "user_id" | "created_at">;
  opportunity: Omit<OpportunityRecord, "user_id" | "created_at" | "company" | "person">;
}): OpportunityRecord {
  const company: Company = {
    ...input.company,
    user_id: state.workspace.profile.id,
    created_at: new Date().toISOString(),
  };
  const person: Person = {
    ...input.person,
    user_id: state.workspace.profile.id,
    created_at: new Date().toISOString(),
  };
  const opportunity: OpportunityRecord = {
    ...input.opportunity,
    user_id: state.workspace.profile.id,
    created_at: new Date().toISOString(),
    company,
    person,
  };
  state.workspace.companies.unshift(company);
  state.workspace.people.unshift(person);
  state.workspace.opportunities.unshift(opportunity);
  return opportunity;
}

export function updateDemoProfileQuota(quota: number, clientId?: string) {
  if (!clientId || state.workspace.profile.id === clientId) {
    state.workspace.profile.daily_lead_quota = quota;
  }
  const profile = demoProfiles.find((item) => item.id === clientId);
  if (profile) profile.daily_lead_quota = quota;
}

export function updateDemoProfile(patch: {
  agency_name?: string;
  target_niche?: string;
  daily_lead_quota?: number;
  slack_webhook_url?: string;
}) {
  Object.assign(state.workspace.profile, patch);
}

export function getDemoTasks(): Task[] {
  return state.workspace.tasks;
}

export function getDemoTeamMembers(): TeamMember[] {
  return state.workspace.team_members ?? [];
}

export function addDemoTeamMember(input: {
  name: string;
  email: string;
  role: MemberRole;
}): TeamMember {
  const member: TeamMember = {
    id: `tm-${crypto.randomUUID()}`,
    agency_id: state.workspace.profile.id,
    name: input.name,
    email: input.email,
    role: input.role,
    status: "Active",
    joined_at: new Date().toISOString(),
  };
  if (!state.workspace.team_members) state.workspace.team_members = [];
  state.workspace.team_members.push(member);
  return member;
}

export function removeDemoTeamMember(id: string) {
  if (!state.workspace.team_members) return;
  state.workspace.team_members = state.workspace.team_members.filter((m) => m.id !== id);
}

export function addDemoCompany(input: {
  name: string;
  domain: string | null;
  website: string | null;
  location: string | null;
  address: string | null;
  tech_stack: string[];
}): Company {
  const company: Company = {
    id: `co-${crypto.randomUUID()}`,
    user_id: state.workspace.profile.id,
    created_at: new Date().toISOString(),
    ...input,
  };
  state.workspace.companies.unshift(company);
  return company;
}

export function addDemoPerson(input: {
  first_name: string;
  last_name: string | null;
  job_title: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string;
  company_id: string | null;
}): Person {
  const person: Person = {
    id: `p-${crypto.randomUUID()}`,
    user_id: state.workspace.profile.id,
    created_at: new Date().toISOString(),
    ...input,
  };
  state.workspace.people.unshift(person);
  return person;
}
