import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
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

async function requireUserId() {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Your session expired. Please sign in again.");
  return data.user.id;
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
    };
  }

  const supabase = getSupabase();
  const userId = await requireUserId();
  const [profileRes, companiesRes, peopleRes, oppsRes, tasksRes, teamRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("companies").select("*").eq("user_id", userId).order("name"),
      supabase.from("people").select("*").eq("user_id", userId).order("first_name"),
      supabase
        .from("opportunities")
        .select("*, company:companies(*), person:people(*)")
        .eq("user_id", userId)
        .lte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .order("due_at", { ascending: true, nullsFirst: false }),
      supabase
        .from("team_members")
        .select("*")
        .eq("agency_id", userId)
        .order("joined_at", { ascending: true }),
    ]);

  if (profileRes.error) throw profileRes.error;
  if (!profileRes.data)
    throw new Error("Your workspace profile is still being created. Refresh in a moment.");

  const opportunities = (oppsRes.data ?? []).map((row) => {
    const r = row as unknown as OpportunityRecord;
    return { ...r, deal_value: Number(r.deal_value ?? 0) } as OpportunityRecord;
  });

  const profileData = profileRes.data as unknown as Profile;

  return {
    profile: profileData,
    isAdmin: (profileData as { role?: string })?.role === "super_admin",
    companies: (companiesRes.data ?? []) as Company[],
    people: (peopleRes.data ?? []) as Person[],
    opportunities,
    tasks: (tasksRes.data ?? []) as Task[],
    team_members: (teamRes.data ?? []) as TeamMember[],
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

export const api = {
  async updateStage(input: { id: string; stage: Stage }) {
    const supabase = getSupabase();
    check(await supabase.from("opportunities").update({ stage: input.stage }).eq("id", input.id));
  },
  async updateDraft(input: { id: string; subject: string; body: string }) {
    const supabase = getSupabase();
    const subject = input.subject.trim().slice(0, 200);
    const body = input.body.trim().slice(0, 4000);
    if (!subject || !body) throw new Error("Subject and body are required.");
    check(
      await supabase
        .from("opportunities")
        .update({ ai_subject_line: subject, ai_icebreaker: body })
        .eq("id", input.id),
    );
  },
  async updateOpportunity(input: { id: string; patch: Partial<OpportunityRecord> }) {
    const supabase = getSupabase();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { company: _c, person: _p, ...patch } = input.patch as OpportunityRecord;
    check(await supabase.from("opportunities").update(patch).eq("id", input.id));
  },
  async deleteOpportunity(id: string) {
    const supabase = getSupabase();
    check(await supabase.from("opportunities").delete().eq("id", id));
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
    const user_id = await requireUserId();
    const deal_name = input.deal_name.trim();
    if (!deal_name) throw new Error("Deal name is required.");
    check(
      await supabase.from("opportunities").insert({
        user_id,
        deal_name,
        deal_value: Math.max(0, Number(input.deal_value ?? 0)),
        stage: input.stage ?? "New Lead",
        buying_trigger: input.buying_trigger?.trim() ?? "",
        company_id: input.company_id ?? null,
        person_id: input.person_id ?? null,
        notes: input.notes ?? null,
      }),
    );
  },
  async toggleTask(input: { id: string; completed: boolean }) {
    const supabase = getSupabase();
    check(await supabase.from("tasks").update({ completed: input.completed }).eq("id", input.id));
  },
  async deleteTask(id: string) {
    const supabase = getSupabase();
    check(await supabase.from("tasks").delete().eq("id", id));
  },
  async createTask(input: {
    title: string;
    priority: Task["priority"];
    due_at?: string | null;
    description?: string | null;
  }) {
    const supabase = getSupabase();
    const user_id = await requireUserId();
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
    const user_id = await requireUserId();
    const agency_name = input.agency_name.trim().slice(0, 120);
    const webhook = input.slack_webhook_url.trim();
    if (!agency_name) throw new Error("Agency name is required.");
    if (webhook && !/^https:\/\/hooks\.slack\.com\/services\//.test(webhook)) {
      throw new Error("Use a Slack incoming webhook URL (https://hooks.slack.com/services/...).");
    }
    check(
      await supabase
        .from("profiles")
        .update({
          agency_name,
          target_niche: input.target_niche.trim().slice(0, 4000) || null,
          slack_webhook_url: webhook || null,
        })
        .eq("id", user_id),
    );
  },
  async createCompany(input: {
    name: string;
    website?: string;
    location?: string;
    tech_stack?: string[];
  }) {
    const supabase = getSupabase();
    const user_id = await requireUserId();
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
    check(await supabase.from("companies").delete().eq("id", id));
  },
  async createPerson(input: {
    first_name: string;
    last_name?: string | null;
    job_title?: string;
    email?: string | null;
    linkedin_url?: string;
    company_id?: string | null;
  }) {
    const supabase = getSupabase();
    const user_id = await requireUserId();
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
        })
        .select("id")
        .single(),
    );
    return res.data!.id as string;
  },
  async deletePerson(id: string) {
    const supabase = getSupabase();
    check(await supabase.from("people").delete().eq("id", id));
  },
  async addTeamMember(input: { name: string; email: string; role: string }) {
    const supabase = getSupabase();
    const agency_id = await requireUserId();
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a name and a valid email.");
    check(
      await supabase
        .from("team_members")
        .insert({ agency_id, name, email, role: input.role, status: "Invited" }),
    );
  },
  async updateTeamMember(input: { id: string; role?: string; status?: string }) {
    const supabase = getSupabase();
    const { id, ...patch } = input;
    check(await supabase.from("team_members").update(patch).eq("id", id));
  },
  async removeTeamMember(id: string) {
    const supabase = getSupabase();
    check(await supabase.from("team_members").delete().eq("id", id));
  },
};

