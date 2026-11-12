import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { normalizeAgencyName } from "@/lib/validation";
import type {
  ActivityLog,
  Company,
  OpportunityRecord,
  Person,
  Profile,
  Stage,
  Task,
  TeamMember,
  WorkspaceData,
} from "@/lib/types";

export const workspaceKey = ["workspace"] as const;

function getSupabase() {
  const client = createClient();
  if (!client) throw new Error("Supabase client is not initialized.");
  return client;
}

async function getAuthUser() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error("We could not verify your session. Please refresh and try again.");
  if (!data.user) throw new Error("Your session expired. Please sign in again.");
  return data.user;
}

/**
 * Writes must land in the workspace the user actually reads: for an invited
 * teammate that is the agency owner's id, not their own. Writing to `auth.uid()`
 * created rows the workspace query then filtered out, so the record vanished
 * the moment the list refetched.
 */
async function requireWorkspaceId() {
  return (await resolveAgency(await getAuthUser())).agencyId;
}

/**
 * Resolve the workspace that the signed-in user reads and writes.
 *
 * An invited teammate shares their agency's rows; the lookups must match the
 * email case-insensitively and tolerate a duplicate membership instead of
 * silently falling back to an empty personal workspace.
 */
async function resolveAgency(user: { id: string; email?: string | null }) {
  const supabase = getSupabase();
  const userEmail = user.email?.toLowerCase() ?? "";
  let agencyId = user.id;

  if (userEmail) {
    const { data: memberRow, error } = await supabase
      .from("team_members")
      .select("agency_id")
      .ilike("email", userEmail)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[workspace] team membership lookup failed:", error.message);
    }
    if (memberRow?.agency_id) {
      agencyId = memberRow.agency_id;
    }
  }

  return { userId: user.id, userEmail, agencyId };
}

export async function fetchWorkspace(): Promise<WorkspaceData> {
  if (typeof window === "undefined") {
    // Server render has no session cookie access here. Return a clearly marked
    // empty shell so the ICP gate and sidebar wait for the real client fetch
    // instead of acting on invented profile data.
    return {
      profile: {
        id: "pending",
        agency_name: "",
        contact_email: "",
        role: "client",
        target_niche: null,
        daily_lead_quota: 0,
        slack_webhook_url: null,
        subscription_tier: "Starter",
        created_at: new Date(0).toISOString(),
      },
      isAdmin: false,
      pending: true,
      companies: [],
      people: [],
      opportunities: [],
      tasks: [],
      team_members: [],
      activities: [],
    };
  }

  const supabase = getSupabase();
  const user = await getAuthUser();
  const { agencyId: effectiveAgencyId } = await resolveAgency(user);

  const [profileRes, companiesRes, peopleRes, oppsRes, tasksRes, teamRes, activitiesRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", effectiveAgencyId).maybeSingle(),
      supabase.from("companies").select("*").eq("user_id", effectiveAgencyId).order("name"),
      supabase.from("people").select("*").eq("user_id", effectiveAgencyId).order("first_name"),
      supabase
        .from("opportunities")
        .select("*, company:companies(*), person:people(*)")
        .eq("user_id", effectiveAgencyId)
        .lte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("*")
        .eq("user_id", effectiveAgencyId)
        .order("due_at", { ascending: true, nullsFirst: false }),
      supabase
        .from("team_members")
        .select("*")
        .eq("agency_id", effectiveAgencyId)
        .order("joined_at", { ascending: true }),
      supabase
        .from("activity_logs")
        .select("*")
        .eq("user_id", effectiveAgencyId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  // Never turn a failed query into an empty array: the dashboard would report
  // "0 companies / 0 deals" and the user would think their pipeline vanished.
  for (const res of [profileRes, companiesRes, peopleRes, oppsRes, tasksRes, teamRes, activitiesRes]) {
    if (res.error) throw new Error(res.error.message);
  }
  if (!profileRes.data)
    throw new Error("Your workspace profile is still being created. Refresh in a moment.");

  const opportunities = (oppsRes.data ?? []).map((row) => {
    const r = row as unknown as OpportunityRecord;
    return { ...r, deal_value: Number(r.deal_value ?? 0) } as OpportunityRecord;
  });

  const profileData = profileRes.data as unknown as Profile;

  return {
    profile: profileData,
    isAdmin: profileData.role === "super_admin",
    companies: (companiesRes.data ?? []) as Company[],
    people: (peopleRes.data ?? []) as Person[],
    opportunities,
    tasks: (tasksRes.data ?? []) as Task[],
    team_members: (teamRes.data ?? []) as TeamMember[],
    activities: (activitiesRes.data ?? []) as ActivityLog[],
  };
}

export const workspaceQuery = () =>
  queryOptions({ queryKey: workspaceKey, queryFn: fetchWorkspace, staleTime: 15_000 });

export function useWorkspaceMutation<TInput, TResult = unknown>(
  fn: (input: TInput) => Promise<TResult>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ queryKey: workspaceKey }),
  });
}

function check<T extends { error: { message: string } | null }>(res: T) {
  if (res.error) throw new Error(res.error.message);
  return res;
}

/**
 * RLS-filtered updates and deletes resolve with `{ data: null, error: null }`
 * instead of failing, so a 0-row write must be reported to the user rather
 * than toasted as a success and then reverted on the next refetch.
 */
async function mutate(
  query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
) {
  const res = await query;
  if (res.error) throw new Error(res.error.message);
  if (!allowEmpty && (!Array.isArray(res.data) || res.data.length === 0)) {
    throw new Error(
      "That change was not applied. You may not have permission, or the record no longer exists.",
    );
  }
}

export const api = {
  async updateStage(input: { id: string; stage: Stage }) {
    const supabase = getSupabase();
    await mutate(
      supabase
        .from("opportunities")
        .update({ stage: input.stage })
        .eq("id", input.id)
        .select("id"),
    );
  },
  async updateDraft(input: { id: string; subject: string; body: string }) {
    const supabase = getSupabase();
    const subject = input.subject.trim().slice(0, 200);
    const body = input.body.trim().slice(0, 4000);
    if (!subject || !body) throw new Error("Subject and body are required.");
    await mutate(
      supabase
        .from("opportunities")
        .update({ ai_subject_line: subject, ai_icebreaker: body })
        .eq("id", input.id)
        .select("id"),
    );
  },
  async updateOpportunity(input: { id: string; patch: Partial<OpportunityRecord> }) {
    const supabase = getSupabase();
    // Whitelist columns: joined relations and server-owned fields (id, user_id,
    // created_at) must never reach the update payload.
    const patch: Record<string, unknown> = {};
    const allowed = [
      "deal_name",
      "deal_value",
      "stage",
      "buying_trigger",
      "trigger_url",
      "company_id",
      "person_id",
      "notes",
      "ai_subject_line",
      "ai_icebreaker",
      "outreach_dispatched",
      "scheduled_at",
    ] as const;
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(input.patch, key)) {
        patch[key] = (input.patch as Record<string, unknown>)[key];
      }
    }
    if (Object.keys(patch).length === 0) return;
    await mutate(
      supabase.from("opportunities").update(patch).eq("id", input.id).select("id"),
    );
  },
  async deleteOpportunity(id: string) {
    const supabase = getSupabase();
    await mutate(supabase.from("opportunities").delete().eq("id", id).select("id"));
  },
  async createOpportunity(input: {
    deal_name: string;
    deal_value?: number;
    stage?: Stage;
    buying_trigger?: string;
    company_id?: string | null;
    person_id?: string | null;
    notes?: string | null;
  }) {
    const supabase = getSupabase();
    const user_id = await requireWorkspaceId();
    const deal_name = input.deal_name.trim();
    if (!deal_name) throw new Error("Deal name is required.");
    const rawValue = Number(input.deal_value ?? 0);
    if (!Number.isFinite(rawValue) || rawValue < 0 || rawValue > 9_999_999_999) {
      throw new Error("Enter a valid deal value.");
    }
    await check(
      await supabase
        .from("opportunities")
        .insert({
          user_id,
          deal_name,
          deal_value: rawValue,
          stage: input.stage ?? "New Lead",
          buying_trigger: input.buying_trigger?.trim() ?? "",
          company_id: input.company_id ?? null,
          person_id: input.person_id ?? null,
          notes: input.notes ?? null,
          // The table default releases new rows tomorrow at 08:00 IST, and the
          // read policy hides anything scheduled in the future. A manually
          // created deal must be visible immediately.
          scheduled_at: new Date().toISOString(),
        })
        .select("id"),
    );
  },
  async toggleTask(input: { id: string; completed: boolean }) {
    const supabase = getSupabase();
    await mutate(
      supabase.from("tasks").update({ completed: input.completed }).eq("id", input.id).select("id"),
    );
  },
  async deleteTask(id: string) {
    const supabase = getSupabase();
    await mutate(supabase.from("tasks").delete().eq("id", id).select("id"));
  },
  async createTask(input: {
    title: string;
    priority: Task["priority"];
    due_at?: string | null;
    description?: string | null;
  }) {
    const supabase = getSupabase();
    const user_id = await requireWorkspaceId();
    const title = input.title.trim().slice(0, 180);
    if (!title) throw new Error("Task title is required.");
    check(
      await supabase.from("tasks").insert({
        user_id,
        title,
        priority: input.priority,
        description: input.description ?? null,
        due_at: input.due_at ? new Date(input.due_at).toISOString() : null,
      }),
    );
  },
  async updateProfile(input: {
    agency_name: string;
    target_niche: string;
    slack_webhook_url: string;
  }) {
    const supabase = getSupabase();
    const user = await getAuthUser();
    const { userId, agencyId } = await resolveAgency(user);
    if (agencyId !== userId) {
      throw new Error("Only the agency owner can change workspace settings.");
    }
    const agency_name = normalizeAgencyName(input.agency_name);
    const webhook = input.slack_webhook_url.trim();
    if (agency_name.length < 2) throw new Error("Agency name must be at least 2 characters.");
    // Mirror the DB check constraint exactly so the user gets a form error
    // instead of a raw Postgres violation toast.
    if (webhook && !/^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9+/=_-]+$/.test(webhook)) {
      throw new Error("Use a Slack incoming webhook URL (https://hooks.slack.com/services/...).");
    }
    await mutate(
      supabase
        .from("profiles")
        .update({
          agency_name,
          target_niche: input.target_niche.trim().slice(0, 4000) || null,
          slack_webhook_url: webhook || null,
        })
        .eq("id", userId)
        .select("id"),
    );
  },
  async createCompany(input: {
    name: string;
    website?: string;
    linkedin_url?: string;
    employee_count?: string;
    industry?: string;
    location?: string;
    tech_stack?: string[];
  }) {
    const supabase = getSupabase();
    const user_id = await requireWorkspaceId();
    const name = input.name.trim();
    if (!name) throw new Error("Company name is required.");
    const website = input.website?.trim() || null;
    const domain = website
      ? (website
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .split("/")[0]
          ?.toLowerCase() ?? null)
      : null;
    const res = check(
      await supabase
        .from("companies")
        .insert({
          user_id,
          name,
          website,
          linkedin_url: input.linkedin_url?.trim() || null,
          employee_count: input.employee_count?.trim() || null,
          industry: input.industry?.trim() || null,
          domain,
          location: input.location?.trim() || null,
          tech_stack: input.tech_stack?.length ? input.tech_stack : null,
        })
        .select("id")
        .single(),
    );
    return res.data!.id as string;
  },
  async deleteCompany(id: string) {
    const supabase = getSupabase();
    await mutate(supabase.from("companies").delete().eq("id", id).select("id"));
  },
  async createPerson(input: {
    first_name: string;
    last_name?: string | null;
    job_title?: string;
    email?: string | null;
    linkedin_url?: string;
    company_id?: string | null;
    role_tier?: "primary" | "secondary" | "tertiary";
  }) {
    const supabase = getSupabase();
    const user_id = await requireWorkspaceId();
    if (!input.first_name.trim()) throw new Error("First name is required.");
    const res = check(
      await supabase
        .from("people")
        .insert({
          user_id,
          first_name: input.first_name.trim(),
          last_name: input.last_name?.trim() || null,
          job_title: input.job_title?.trim() ?? "",
          email: input.email?.trim() || null,
          linkedin_url: input.linkedin_url?.trim() ?? "",
          company_id: input.company_id ?? null,
          role_tier: input.role_tier ?? "primary",
        })
        .select("id")
        .single(),
    );
    return res.data!.id as string;
  },
  async deletePerson(id: string) {
    const supabase = getSupabase();
    await mutate(supabase.from("people").delete().eq("id", id).select("id"));
  },
  async markActivityRead(id: string) {
    const supabase = getSupabase();
    await mutate(supabase.from("activity_logs").update({ read: true }).eq("id", id).select("id"));
  },
  async markAllActivitiesRead() {
    const supabase = getSupabase();
    const user_id = await requireWorkspaceId();
    // A workspace with nothing unread is a valid no-op, so allow 0 rows.
    await mutate(
      supabase.from("activity_logs").update({ read: true }).eq("user_id", user_id).select("id"),
      { allowEmpty: true },
    );
  },
  async logActivity(input: {
    action: string;
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    const supabase = getSupabase();
    const user_id = await requireWorkspaceId();
    check(
      await supabase.from("activity_logs").insert({
        user_id,
        action: input.action,
        title: input.title,
        description: input.description || null,
        metadata: input.metadata || null,
      }),
    );
  },
  async addTeamMember(input: { name: string; email: string; role: string }) {
    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to add team member.");
    }
    return data.member;
  },
  async updateTeamMember(input: { id: string; role?: string; status?: string }) {
    const supabase = getSupabase();
    const { id, ...patch } = input;
    await mutate(supabase.from("team_members").update(patch).eq("id", id).select("id"));
  },
  async removeTeamMember(id: string) {
    const supabase = getSupabase();
    await mutate(supabase.from("team_members").delete().eq("id", id).select("id"));
  },
  async submitPaymentUtr(utr: string) {
    const res = await fetch("/api/payment/submit-utr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ utr }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to submit UTR.");
    }
    return data;
  },
};

