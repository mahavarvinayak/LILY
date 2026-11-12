import { NextResponse } from "next/server";
import { generateDrafts } from "@/lib/ai";
import { isDemoMode, isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/env";
import { addDemoLead, updateDemoProfileQuota } from "@/lib/demo-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { domainFromWebsite, splitName } from "@/lib/utils";
import { ALLOWED_OPERATOR_EMAILS } from "@/lib/constants";
import { serializeLeadIntelligence } from "@/lib/intelligence";
import type { IngestedLead, Profile } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { authorized: false, error: "Authentication service unavailable." },
      { status: 503 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email || !(ALLOWED_OPERATOR_EMAILS as readonly string[]).includes(user.email.toLowerCase())) {
    return NextResponse.json(
      { authorized: false, error: "Unauthorized operator." },
      { status: 403 },
    );
  }

  // The allow-list alone is not enough: the role is the authorisation the RLS
  // helper and the rest of the app rely on.
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if ((profileRow as { role?: string } | null)?.role !== "super_admin") {
    return NextResponse.json(
      { authorized: false, error: "Super admin role required." },
      { status: 403 },
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { authorized: false, error: "Admin client unconfigured." },
      { status: 503 },
    );
  }

  const [{ data: clients, error }, { data: teamMembers }] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "id, agency_name, contact_email, target_niche, daily_lead_quota, subscription_tier, payment_utr, payment_verified, payment_amount, created_at",
      )
      .eq("role", "client")
      .order("created_at", { ascending: false }),
    admin.from("team_members").select("email"),
  ]);

  if (error) {
    return NextResponse.json({ authorized: false, error: error.message }, { status: 500 });
  }

  const teamEmails = new Set(
    (teamMembers || [])
      .map((m) => (typeof m.email === "string" ? m.email.trim().toLowerCase() : ""))
      .filter(Boolean),
  );

  const primaryClients = (clients || []).filter(
    (c) => !c.contact_email || !teamEmails.has(c.contact_email.trim().toLowerCase()),
  );

  return NextResponse.json({
    authorized: true,
    operator: user.email,
    clients: primaryClients,
  });
}

interface IngestBody {
  clientId?: string;
  releaseAt?: string;
  dailyQuota?: number;
  enrich?: boolean;
  leads?: IngestedLead[];
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function defaultReleaseAt(): string {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);
  istNow.setUTCDate(istNow.getUTCDate() + 1);
  istNow.setUTCHours(2, 30, 0, 0);
  return istNow.toISOString();
}

function parseReleaseAt(value: unknown) {
  if (!isNonEmpty(value)) return defaultReleaseAt();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? defaultReleaseAt() : parsed.toISOString();
}

function leadOrDefault(lead: IngestedLead, releaseAt: string, draft?: { subject: string; body: string }) {
  const { first_name, last_name } = splitName(lead.contact_name);
  const subject = lead.email_subject || lead.ai_subject_line || draft?.subject || null;
  const body = lead.email_body || lead.ai_icebreaker || draft?.body || null;
  return {
    companyName: lead.company_name.trim(),
    website: lead.website?.trim() || null,
    domain: (lead.domain ?? (lead.website ? domainFromWebsite(lead.website) : "")) || null,
    location: lead.location?.trim() || null,
    techStack: Array.isArray(lead.tech_stack) ? lead.tech_stack.slice(0, 12) : null,
    firstName: first_name,
    lastName: last_name,
    jobTitle: lead.job_title.trim(),
    email: lead.email?.trim() || null,
    linkedinUrl: lead.linkedin_url.trim(),
    trigger: lead.buying_trigger.trim(),
    triggerUrl: lead.trigger_url?.trim() || null,
    dealName: lead.deal_name?.trim() || `${lead.company_name.trim()} — Growth Partnership`,
    dealValue: Number.isFinite(Number(lead.deal_value)) ? Number(lead.deal_value) : 0,
    notes: lead.notes?.trim() || null,
    subject,
    body,
    linkedinNote: lead.linkedin_note?.trim() || null,
    linkedinMessage: lead.linkedin_message?.trim() || null,
    releaseAt,
  };
}

export async function POST(request: Request) {
  const demo = isDemoMode();

  if (!demo && !isSupabaseConfigured()) {
    // Fail closed: a missing database must never fall through to the demo
    // store, which would skip operator authorization entirely.
    return NextResponse.json(
      { ok: false, error: "Workspace database is not configured on this deployment." },
      { status: 503 },
    );
  }

  // Authorise before reading the body: operator access is decided by the
  // session, so an anonymous caller must never reach payload validation.
  let adminClient: ReturnType<typeof createSupabaseAdminClient> = null;

  if (!demo) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 503 });
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
    }
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    const operator = profileRow as Profile | null;
    if (
      !operator ||
      operator.role !== "super_admin" ||
      !user.email ||
      !(ALLOWED_OPERATOR_EMAILS as readonly string[]).includes(user.email.toLowerCase())
    ) {
      return NextResponse.json({ ok: false, error: "Operator access required." }, { status: 403 });
    }

    adminClient = createSupabaseAdminClient();
    if (!adminClient || !isServiceRoleConfigured()) {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is missing on the server." },
        { status: 503 },
      );
    }
  }

  let body: IngestBody;
  try {
    body = (await request.json()) as IngestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (Array.isArray(body.leads) && body.leads.length > 50) {
    return NextResponse.json(
      { ok: false, error: "Batches are limited to 50 leads per request." },
      { status: 400 },
    );
  }

  const leads = Array.isArray(body.leads) ? body.leads : [];
  if (leads.length === 0) {
    return NextResponse.json({ ok: false, error: "At least one lead is required." }, { status: 400 });
  }

  for (const [index, lead] of leads.entries()) {
    if (!lead || typeof lead !== "object" || Array.isArray(lead)) {
      return NextResponse.json(
        { ok: false, error: `Lead ${index + 1} is not a valid object.` },
        { status: 400 },
      );
    }
    if (
      !isNonEmpty(lead.company_name) ||
      !isNonEmpty(lead.contact_name) ||
      !isNonEmpty(lead.job_title) ||
      !isNonEmpty(lead.linkedin_url) ||
      !isNonEmpty(lead.buying_trigger)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `Lead ${index + 1} is missing a required field (company, contact, title, LinkedIn URL, or trigger).`,
        },
        { status: 400 },
      );
    }
    if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
      return NextResponse.json(
        { ok: false, error: `Lead ${index + 1} has an invalid work email.` },
        { status: 400 },
      );
    }
  }

  const releaseAt = parseReleaseAt(body.releaseAt);
  const dailyQuota = Math.min(50, Math.max(1, Number(body.dailyQuota ?? 15) || 15));
  const clientId = body.clientId;

  if (adminClient) {
    if (!clientId) {
      return NextResponse.json({ ok: false, error: "Select a client workspace." }, { status: 400 });
    }
    const { data: clientRow } = await adminClient
      .from("profiles")
      .select("id,role")
      .eq("id", clientId)
      .maybeSingle();
    if (!clientRow) {
      return NextResponse.json({ ok: false, error: "Client workspace not found." }, { status: 404 });
    }
    if (clientRow.role !== "client") {
      return NextResponse.json({ ok: false, error: "Target workspace must be a client." }, { status: 400 });
    }
  }

  const drafts = body.enrich === false ? [] : await generateDrafts(
    leads.map((lead, index) => ({
      id: String(index),
      company: lead.company_name,
      person: lead.contact_name,
      role: lead.job_title,
      trigger: lead.buying_trigger,
      dealName: lead.deal_name ?? "Growth Partnership",
    })),
  );

  if (demo) {
    updateDemoProfileQuota(dailyQuota, body.clientId);
    leads.forEach((lead, index) => {
      const normalized = leadOrDefault(lead, releaseAt, drafts[index]);
      const id = crypto.randomUUID();
      addDemoLead({
        company: {
          id: `c-${id}`,
          name: normalized.companyName,
          domain: normalized.domain,
          website: normalized.website,
          location: normalized.location,
          tech_stack: normalized.techStack,
        },
        person: {
          id: `p-${id}`,
          company_id: `c-${id}`,
          first_name: normalized.firstName,
          last_name: normalized.lastName,
          job_title: normalized.jobTitle,
          email: normalized.email,
          linkedin_url: normalized.linkedinUrl,
        },
        opportunity: {
          id: `o-${id}`,
          company_id: `c-${id}`,
          person_id: `p-${id}`,
          deal_name: normalized.dealName,
          deal_value: normalized.dealValue,
          stage: "New Lead",
          buying_trigger: normalized.trigger,
          trigger_url: normalized.triggerUrl,
          ai_subject_line: normalized.subject,
          ai_icebreaker: normalized.body,
          scheduled_at: releaseAt,
          outreach_dispatched: false,
          notes: normalized.notes,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      demo: true,
      inserted: leads.length,
      releaseAt,
      drafts: drafts.map((draft, index) => ({
        company: leads[index]?.company_name,
        subject: draft.subject,
        body: draft.body,
      })),
      message: `Successfully staged ${leads.length} lead(s) behind the ${new Date(releaseAt).toLocaleString("en-IN")} release gate.`,
    });
  }

  const admin = adminClient!;
  let inserted = 0;
  const failures: string[] = [];

  for (const [index, lead] of leads.entries()) {
    const normalized = leadOrDefault(lead, releaseAt, drafts[index]);
    try {
      let companyId: string | null = null;
      if (normalized.domain) {
        const lowerDomain = normalized.domain.toLowerCase();
        // `%` and `_` are ILIKE wildcards; an attacker-supplied domain could
        // otherwise match (and then mutate) an unrelated company.
        const safeDomain = lowerDomain.replace(/[\\%_]/g, (char) => `\\${char}`);
        const { data: existingCompany } = await admin
          .from("companies")
          .select("id")
          .eq("user_id", clientId)
          .ilike("domain", safeDomain)
          .maybeSingle();
        companyId = existingCompany?.id ?? null;
      }
      const rawLead = lead as unknown as Record<string, unknown>;
      const compLinkedin = String(rawLead.company_linkedin_url || "").trim() || null;
      const compEmployees = String(rawLead.employee_count || "").trim() || null;
      const compIndustry = String(rawLead.industry || rawLead.industry_niche || "").trim() || null;

      if (!companyId) {
        const { data: createdCompany, error: companyError } = await admin
          .from("companies")
          .insert({
            user_id: clientId,
            name: normalized.companyName,
            domain: normalized.domain ? normalized.domain.toLowerCase() : null,
            website: normalized.website,
            linkedin_url: compLinkedin,
            employee_count: compEmployees,
            industry: compIndustry,
            location: normalized.location,
            tech_stack: normalized.techStack,
          })
          .select("id")
          .single();
        if (companyError) throw new Error(companyError.message);
        companyId = createdCompany.id as string;
      } else {
        await admin
          .from("companies")
          .update({
            ...(compLinkedin ? { linkedin_url: compLinkedin } : {}),
            ...(compEmployees ? { employee_count: compEmployees } : {}),
            ...(compIndustry ? { industry: compIndustry } : {}),
          })
          .eq("id", companyId);
      }

      const { data: existingPerson } = await admin
        .from("people")
        .select("id")
        .eq("user_id", clientId)
        .eq("linkedin_url", normalized.linkedinUrl)
        .maybeSingle();

      let personId = existingPerson?.id as string | undefined;
      if (!personId) {
        const { data: createdPerson, error: personError } = await admin
          .from("people")
          .insert({
            user_id: clientId,
            company_id: companyId,
            first_name: normalized.firstName,
            last_name: normalized.lastName,
            job_title: normalized.jobTitle,
            email: normalized.email,
            linkedin_url: normalized.linkedinUrl,
            role_tier: "primary",
          })
          .select("id")
          .single();
        if (personError) throw new Error(personError.message);
        personId = createdPerson.id as string;
      } else if (companyId) {
        await admin
          .from("people")
          .update({ company_id: companyId })
          .eq("id", personId);
      }

      const secName = String(rawLead.secondary_contact_name || "").trim();
      const secUrl = String(rawLead.secondary_linkedin_url || "").trim();
      if (secName) {
        const parts = secName.split(" ");
        const sFirst = parts[0];
        const sLast = parts.slice(1).join(" ") || null;
        const sTitle = String(rawLead.secondary_contact_title || "Executive").trim();
        let existingSec = null;
        if (secUrl) {
          const { data } = await admin.from("people").select("id").eq("user_id", clientId).eq("linkedin_url", secUrl).maybeSingle();
          existingSec = data;
        } else if (companyId && sFirst) {
          let query = admin.from("people").select("id").eq("user_id", clientId).eq("company_id", companyId).eq("first_name", sFirst);
          if (sLast) query = query.eq("last_name", sLast);
          const { data } = await query.maybeSingle();
          existingSec = data;
        }
        if (!existingSec) {
          await admin.from("people").insert({
            user_id: clientId,
            company_id: companyId,
            first_name: sFirst,
            last_name: sLast,
            job_title: sTitle,
            linkedin_url: secUrl || `https://linkedin.com/search/results/all/?keywords=${encodeURIComponent(secName)}`,
            role_tier: "secondary",
          });
        }
      }

      const tertName = String(rawLead.tertiary_contact_name || "").trim();
      const tertUrl = String(rawLead.tertiary_linkedin_url || "").trim();
      if (tertName) {
        const parts = tertName.split(" ");
        const tFirst = parts[0];
        const tLast = parts.slice(1).join(" ") || null;
        const tTitle = String(rawLead.tertiary_contact_title || "Technical Leader").trim();
        let existingTert = null;
        if (tertUrl) {
          const { data } = await admin.from("people").select("id").eq("user_id", clientId).eq("linkedin_url", tertUrl).maybeSingle();
          existingTert = data;
        } else if (companyId && tFirst) {
          let query = admin.from("people").select("id").eq("user_id", clientId).eq("company_id", companyId).eq("first_name", tFirst);
          if (tLast) query = query.eq("last_name", tLast);
          const { data } = await query.maybeSingle();
          existingTert = data;
        }
        if (!existingTert) {
          await admin.from("people").insert({
            user_id: clientId,
            company_id: companyId,
            first_name: tFirst,
            last_name: tLast,
            job_title: tTitle,
            linkedin_url: tertUrl || `https://linkedin.com/search/results/all/?keywords=${encodeURIComponent(tertName)}`,
            role_tier: "tertiary",
          });
        }
      }

      const fullIntelNotes = serializeLeadIntelligence({
        company_name: normalized.companyName,
        website: normalized.website || "",
        company_linkedin_url: compLinkedin || "",
        headquarters: normalized.location || "",
        employee_count: compEmployees || "",
        industry_niche: compIndustry || "",
        value_proposition: String(rawLead.value_proposition || ""),
        contact_name: `${normalized.firstName} ${normalized.lastName || ""}`.trim(),
        job_title: normalized.jobTitle,
        linkedin_url: normalized.linkedinUrl,
        tenure_at_company: String(rawLead.tenure || rawLead.tenure_at_company || ""),
        follower_count: String(rawLead.follower_count || ""),
        work_email: normalized.email || "",
        secondary_contact_name: secName,
        secondary_contact_title: String(rawLead.secondary_contact_title || ""),
        secondary_linkedin_url: secUrl,
        tertiary_contact_name: tertName,
        tertiary_contact_title: String(rawLead.tertiary_contact_title || ""),
        tertiary_linkedin_url: tertUrl,
        buying_trigger: normalized.trigger,
        trigger_age: String(rawLead.trigger_age || ""),
        trigger_url: normalized.triggerUrl || "",
        intent_level: String(rawLead.intent_level || "Standard"),
        recent_company_news: String(rawLead.recent_news || rawLead.recent_company_news || ""),
        website_tech_stack: normalized.techStack || [],
        required_engineering_stack: Array.isArray(rawLead.required_skills)
          ? (rawLead.required_skills as string[])
          : Array.isArray(rawLead.required_engineering_stack)
            ? (rawLead.required_engineering_stack as string[])
            : [],
        recent_founder_activity: String(rawLead.recent_activity || rawLead.recent_founder_activity || ""),
        ai_icebreaker: normalized.body || "",
        email_subject_line: normalized.subject || "",
        linkedin_note: normalized.linkedinNote || "",
        linkedin_message: normalized.linkedinMessage || "",
        verification_status: String(rawLead.verification_status || ""),
        source_attribution: normalized.triggerUrl || normalized.website || "",
      });

      const { error: opportunityError } = await admin.from("opportunities").insert({
        user_id: clientId,
        company_id: companyId,
        person_id: personId,
        deal_name: normalized.dealName,
        deal_value: normalized.dealValue,
        stage: "New Lead",
        buying_trigger: normalized.trigger,
        trigger_url: normalized.triggerUrl,
        ai_subject_line: normalized.subject,
        ai_icebreaker: normalized.body,
        scheduled_at: normalized.releaseAt,
        outreach_dispatched: false,
        notes: fullIntelNotes,
      });
      if (opportunityError) throw new Error(opportunityError.message);
      inserted += 1;
    } catch (error) {
      failures.push(
        `${lead.company_name}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  await admin.from("profiles").update({ daily_lead_quota: dailyQuota }).eq("id", clientId);

  if (inserted > 0) {
    await admin.from("activity_logs").insert({
      user_id: clientId,
      action: "batch_ingest",
      title: `${inserted} Verified Account${inserted > 1 ? "s" : ""} Injected`,
      description: `Pipeline drop scheduled for ${new Date(releaseAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST.`,
      metadata: { inserted, releaseAt },
    });
  }

  return NextResponse.json({
    ok: inserted > 0,
    inserted,
    failed: failures.length,
    failures,
    releaseAt,
    message:
      inserted > 0
        ? `${inserted} lead(s) injected. They unlock at ${new Date(releaseAt).toLocaleString("en-IN")}.`
        : "No leads were inserted. Check the failures list.",
  });
}
