import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { domainFromWebsite, splitName } from "@/lib/utils";
import { serializeLeadIntelligence, type LeadIntelligence31 } from "@/lib/intelligence";
import { parseIcpConfig } from "@/lib/icp";
import { ALLOWED_OPERATOR_EMAILS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getTomorrow8amIST(): string {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);
  istNow.setUTCDate(istNow.getUTCDate() + 1);
  istNow.setUTCHours(2, 30, 0, 0);
  return istNow.toISOString();
}

async function verifyMcpAuth(
  request: Request,
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<{ ok: boolean; operator?: string; error?: string }> {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const operatorEmailHeader = (request.headers.get("x-operator-email") || "").trim().toLowerCase();

  const mcpSecret = process.env.LILY_MCP_SECRET_KEY;
  if (mcpSecret && token) {
    const expectedBuf = Buffer.from(mcpSecret);
    const actualBuf = Buffer.from(token);
    if (expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      if (operatorEmailHeader && !(ALLOWED_OPERATOR_EMAILS as readonly string[]).includes(operatorEmailHeader)) {
        return { ok: false, error: "Operator email is not authorized to inject leads." };
      }
      return { ok: true, operator: operatorEmailHeader || ALLOWED_OPERATOR_EMAILS[0] };
    }
  }

  if (admin && token) {
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);
    if (!error && user?.email && (ALLOWED_OPERATOR_EMAILS as readonly string[]).includes(user.email.toLowerCase())) {
      const { data: profile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role === "super_admin") {
        return { ok: true, operator: user.email.toLowerCase() };
      }
    }
  }

  return {
    ok: false,
    error: "Unauthorized: MCP engine access requires a valid operator token.",
  };
}

const MCP_TOOLS = [
  {
    name: "lily_list_client_workspaces",
    description: "Returns all active agency clients, target niches, and daily quotas in LILY.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "lily_inject_verified_lead",
    description: "Atomically injects a verified 24-field lead into a client pipeline with scheduled_at set to 08:00 AM IST.",
    inputSchema: {
      type: "object",
      required: [
        "client_id",
        "company_name",
        "contact_name",
        "job_title",
        "linkedin_url",
        "buying_trigger",
      ],
      properties: {
        client_id: { type: "string" },
        company_name: { type: "string" },
        website: { type: "string" },
        company_linkedin_url: { type: "string" },
        headquarters: { type: "string" },
        employee_count: { type: "string" },
        industry_niche: { type: "string" },
        value_proposition: { type: "string" },
        recent_company_news: { type: "string" },
        website_tech_stack: { type: "array", items: { type: "string" } },
        contact_name: { type: "string" },
        contact_title: { type: "string" },
        linkedin_url: { type: "string" },
        tenure_at_company: { type: "string" },
        follower_count: { type: "string" },
        work_email: { type: "string" },
        secondary_contact_name: { type: "string" },
        secondary_contact_title: { type: "string" },
        secondary_linkedin_url: { type: "string" },
        tertiary_contact_name: { type: "string" },
        tertiary_contact_title: { type: "string" },
        tertiary_linkedin_url: { type: "string" },
        recent_founder_activity: { type: "string" },
        buying_trigger: { type: "string" },
        trigger_age: { type: "string" },
        trigger_url: { type: "string" },
        intent_level: { type: "string" },
        required_engineering_stack: { type: "array", items: { type: "string" } },
        ai_icebreaker: { type: "string" },
        email_subject_line: { type: "string" },
        verification_status: { type: "string" },
        source_attribution: { type: "string" },
        deal_value: { type: "number" },
        scheduled_at: { type: "string" },
      },
    },
  },
  {
    name: "lily_trigger_morning_drop",
    description: "Instantly unlocks all scheduled leads for a client workspace by setting scheduled_at to now.",
    inputSchema: {
      type: "object",
      required: ["client_id"],
      properties: {
        client_id: { type: "string" },
      },
    },
  },
  {
    name: "lily_check_pipeline_health",
    description: "Inspects live pipeline metrics and quotas for a client.",
    inputSchema: {
      type: "object",
      required: ["client_id"],
      properties: {
        client_id: { type: "string" },
      },
    },
  },
  {
    name: "lily_get_client_icp",
    description: "Retrieves the parsed 7-parameter Ideal Customer Profile (ICP) for a client to guide lead generation.",
    inputSchema: {
      type: "object",
      required: ["client_id"],
      properties: {
        client_id: { type: "string" },
      },
    },
  },
];

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  const auth = await verifyMcpAuth(request, admin);
  if (!auth.ok) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32000, message: auth.error || "Unauthorized operator." },
        id: null,
      },
      { status: 401 },
    );
  }

  let body: {
    jsonrpc?: string;
    id?: string | number | null;
    method?: string;
    params?: { name?: string; arguments?: Record<string, unknown> };
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null },
      { status: 400 },
    );
  }

  const { id = 1, method = "", params } = body;
  if (!admin) {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32603, message: "Database engine unavailable." }, id },
      { status: 500 },
    );
  }

  if (method === "initialize") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "lily-revenue-mcp", version: "1.0.0" },
      },
    });
  }

  if (method === "tools/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: { tools: MCP_TOOLS },
    });
  }

  if (method === "tools/call") {
    const toolName = params?.name;
    const args = params?.arguments || {};

    if (toolName === "lily_list_client_workspaces") {
      const { data: clients, error } = await admin
        .from("profiles")
        .select("id, agency_name, contact_email, target_niche, daily_lead_quota, subscription_tier, created_at")
        .eq("role", "client")
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32603, message: error.message },
        });
      }

      const formattedClients = (clients || []).map((c) => {
        const icp = parseIcpConfig(c.target_niche);
        return {
          ...c,
          icp_configured: Boolean(icp?.completed),
          icp: icp || null,
        };
      });

      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify({ ok: true, clients: formattedClients }, null, 2) }],
        },
      });
    }

    if (toolName === "lily_inject_verified_lead") {
      const clientId = String(args.client_id || "").trim();
      const companyName = String(args.company_name || "").trim();
      const contactName = String(args.contact_name || "").trim();
      const jobTitle = String(args.job_title || "").trim();
      const linkedinUrl = String(args.linkedin_url || "").trim();
      const buyingTrigger = String(args.buying_trigger || "").trim();

      if (!clientId || !companyName || !contactName || !jobTitle || !linkedinUrl || !buyingTrigger) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32602,
            message: "Missing required lead fields: client_id, company_name, contact_name, job_title, linkedin_url, buying_trigger.",
          },
        });
      }

      const website = String(args.website || "").trim();
      const domain = website ? domainFromWebsite(website) : null;
      const location = String(args.headquarters || "").trim() || null;
      const techStack = Array.isArray(args.website_tech_stack)
        ? (args.website_tech_stack as string[])
        : null;

      let companyId: string | null = null;
      if (domain) {
        const { data: existingCompany } = await admin
          .from("companies")
          .select("id")
          .eq("user_id", clientId)
          .ilike("domain", domain.toLowerCase())
          .maybeSingle();
        companyId = existingCompany?.id ?? null;
      }

      const compLinkedin = String(args.company_linkedin_url || "").trim() || null;
      const compEmployees = String(args.employee_count || "").trim() || null;
      const compIndustry = String(args.industry_niche || "").trim() || null;

      if (!companyId) {
        const { data: createdCompany, error: companyErr } = await admin
          .from("companies")
          .insert({
            user_id: clientId,
            name: companyName,
            domain: domain ? domain.toLowerCase() : null,
            website: website || null,
            linkedin_url: compLinkedin,
            employee_count: compEmployees,
            industry: compIndustry,
            location,
            tech_stack: techStack,
          })
          .select("id")
          .single();

        if (companyErr) {
          return NextResponse.json({
            jsonrpc: "2.0",
            id,
            error: { code: -32603, message: `Company creation failed: ${companyErr.message}` },
          });
        }
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

      const { first_name, last_name } = splitName(contactName);
      const email = String(args.work_email || "").trim() || null;

      const { data: existingPerson } = await admin
        .from("people")
        .select("id, company_id")
        .eq("user_id", clientId)
        .eq("linkedin_url", linkedinUrl)
        .maybeSingle();

      let personId = existingPerson?.id as string | undefined;
      if (!personId) {
        const { data: createdPerson, error: personErr } = await admin
          .from("people")
          .insert({
            user_id: clientId,
            company_id: companyId,
            first_name,
            last_name,
            job_title: jobTitle,
            email,
            linkedin_url: linkedinUrl,
            role_tier: "primary",
          })
          .select("id")
          .single();

        if (personErr) {
          return NextResponse.json({
            jsonrpc: "2.0",
            id,
            error: { code: -32603, message: `Person creation failed: ${personErr.message}` },
          });
        }
        personId = createdPerson.id as string;
      } else if (companyId) {
        await admin.from("people").update({ company_id: companyId }).eq("id", personId);
      }

      const secName = String(args.secondary_contact_name || "").trim();
      const secUrl = String(args.secondary_linkedin_url || "").trim();
      if (secName) {
        const parts = secName.split(" ");
        const sFirst = parts[0];
        const sLast = parts.slice(1).join(" ") || null;
        const sTitle = String(args.secondary_contact_title || "Executive").trim();
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

      const tertName = String(args.tertiary_contact_name || "").trim();
      const tertUrl = String(args.tertiary_linkedin_url || "").trim();
      if (tertName) {
        const parts = tertName.split(" ");
        const tFirst = parts[0];
        const tLast = parts.slice(1).join(" ") || null;
        const tTitle = String(args.tertiary_contact_title || "Technical Leader").trim();
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

      const scheduledAt = String(args.scheduled_at || getTomorrow8amIST()).trim();
      const dealValue = Number(args.deal_value || 0);

      const intelPayload: LeadIntelligence31 = {
        company_name: companyName,
        website: website || "",
        company_linkedin_url: compLinkedin || "",
        headquarters: location || "",
        employee_count: compEmployees || "",
        industry_niche: compIndustry || "",
        value_proposition: String(args.value_proposition || ""),
        contact_name: contactName,
        job_title: jobTitle,
        linkedin_url: linkedinUrl,
        tenure_at_company: String(args.tenure_at_company || ""),
        follower_count: String(args.follower_count || ""),
        work_email: email || "",
        secondary_contact_name: secName,
        secondary_contact_title: String(args.secondary_contact_title || ""),
        secondary_linkedin_url: secUrl,
        tertiary_contact_name: tertName,
        tertiary_contact_title: String(args.tertiary_contact_title || ""),
        tertiary_linkedin_url: tertUrl,
        buying_trigger: buyingTrigger,
        trigger_age: String(args.trigger_age || ""),
        trigger_url: String(args.trigger_url || ""),
        intent_level: String(args.intent_level || "Standard"),
        recent_company_news: String(args.recent_company_news || ""),
        website_tech_stack: techStack || [],
        required_engineering_stack: Array.isArray(args.required_engineering_stack)
          ? (args.required_engineering_stack as string[])
          : [],
        recent_founder_activity: String(args.recent_founder_activity || ""),
        ai_icebreaker: String(args.ai_icebreaker || ""),
        email_subject_line: String(args.email_subject_line || `Regarding ${companyName}`),
        verification_status: String(args.verification_status || "Verified 100%"),
        source_attribution: String(args.source_attribution || args.trigger_url || website || ""),
      };

      const { data: createdOpp, error: oppErr } = await admin
        .from("opportunities")
        .insert({
          user_id: clientId,
          company_id: companyId,
          person_id: personId,
          deal_name: `${companyName} — Growth Partnership`,
          deal_value: dealValue,
          stage: "New Lead",
          buying_trigger: buyingTrigger,
          trigger_url: String(args.trigger_url || "") || null,
          ai_subject_line: intelPayload.email_subject_line,
          ai_icebreaker: intelPayload.ai_icebreaker,
          scheduled_at: scheduledAt,
          outreach_dispatched: false,
          notes: serializeLeadIntelligence(intelPayload),
        })
        .select("id")
        .single();

      if (oppErr) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32603, message: `Opportunity creation failed: ${oppErr.message}` },
        });
      }

      await admin.from("activity_logs").insert({
        user_id: clientId,
        action: "lead_injected",
        title: `Verified Account: ${companyName}`,
        description: `${contactName} (${jobTitle}) · Trigger: ${buyingTrigger}`,
        metadata: { opportunity_id: createdOpp.id, company_name: companyName },
      });

      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: true,
                  opportunity_id: createdOpp.id,
                  company_id: companyId,
                  person_id: personId,
                  scheduled_at: scheduledAt,
                  message: `Lead successfully injected. Synchronized with Company and Person. Unlocks at ${new Date(scheduledAt).toLocaleString("en-IN")}.`,
                },
                null,
                2,
              ),
            },
          ],
        },
      });
    }

    if (toolName === "lily_trigger_morning_drop") {
      const clientId = String(args.client_id || "").trim();
      if (!clientId) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: "client_id is required." },
        });
      }

      const nowIso = new Date().toISOString();
      const { data: updated, error } = await admin
        .from("opportunities")
        .update({ scheduled_at: nowIso })
        .eq("user_id", clientId)
        .gt("scheduled_at", nowIso)
        .select("id");

      if (error) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32603, message: error.message },
        });
      }

      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: true,
                released_leads: updated?.length || 0,
                message: `Morning drop triggered. ${updated?.length || 0} leads unlocked immediately.`,
              }),
            },
          ],
        },
      });
    }

    if (toolName === "lily_check_pipeline_health") {
      const clientId = String(args.client_id || "").trim();
      if (!clientId) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: "client_id is required." },
        });
      }

      const [oppsRes, compRes, peopleRes, profileRes] = await Promise.all([
        admin.from("opportunities").select("id, stage, deal_value, scheduled_at").eq("user_id", clientId),
        admin.from("companies").select("id").eq("user_id", clientId),
        admin.from("people").select("id").eq("user_id", clientId),
        admin.from("profiles").select("daily_lead_quota, agency_name").eq("id", clientId).single(),
      ]);

      const nowIso = new Date().toISOString();
      const allOpps = oppsRes.data || [];
      const visibleOpps = allOpps.filter((o) => o.scheduled_at <= nowIso);
      const stagedOpps = allOpps.filter((o) => o.scheduled_at > nowIso);

      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: true,
                agency_name: profileRes.data?.agency_name,
                daily_quota: profileRes.data?.daily_lead_quota,
                total_companies: compRes.data?.length || 0,
                total_people: peopleRes.data?.length || 0,
                live_opportunities: visibleOpps.length,
                staged_behind_gate: stagedOpps.length,
                stages: visibleOpps.reduce((acc: Record<string, number>, o) => {
                  acc[o.stage] = (acc[o.stage] || 0) + 1;
                  return acc;
                }, {}),
              }),
            },
          ],
        },
      });
    }

    if (toolName === "lily_get_client_icp") {
      const clientId = String(args.client_id || "").trim();
      if (!clientId) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: "Missing required argument: client_id." },
        });
      }

      const { data: client, error } = await admin
        .from("profiles")
        .select("id, agency_name, contact_email, target_niche, daily_lead_quota, subscription_tier")
        .eq("id", clientId)
        .maybeSingle();

      if (error || !client) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: error?.message || "Client workspace not found." },
        });
      }

      const icp = parseIcpConfig(client.target_niche);
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: true,
                  client_id: client.id,
                  agency_name: client.agency_name,
                  contact_email: client.contact_email,
                  icp_configured: Boolean(icp?.completed),
                  icp: icp || null,
                },
                null,
                2,
              ),
            },
          ],
        },
      });
    }

    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method or tool '${toolName}' not found.` },
    });
  }

  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Unsupported JSON-RPC method '${method}'.` },
  });
}

