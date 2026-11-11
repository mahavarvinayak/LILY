import { NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { getDemoWorkspace } from "@/lib/demo-store";
import { buildDigestContent } from "@/lib/digest-email";
import { env, isDemoMode, isResendConfigured, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIGEST_TYPES = ["drop", "nudge", "wrap"] as const;
type DigestType = (typeof DIGEST_TYPES)[number];

function digestTypeOf(value: string | null | undefined): DigestType {
  return DIGEST_TYPES.includes(value as DigestType) ? (value as DigestType) : "drop";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return handleDigest(request, digestTypeOf(url.searchParams.get("type")));
}

export async function POST(request: Request) {
  let body: { type?: string } = {};
  try {
    body = (await request.json()) as { type?: string };
  } catch {}
  return handleDigest(request, digestTypeOf(body.type));
}

async function handleDigest(request: Request, digestType: DigestType) {
  const authHeader = (request.headers.get("authorization") || "").trim();
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Cron secret unconfigured in environment." }, { status: 500 });
  }

  const expectedToken = `Bearer ${secret}`;
  const expectedBuf = Buffer.from(expectedToken);
  const actualBuf = Buffer.from(authHeader);

  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isResendConfigured()) {
    return NextResponse.json({
      ok: true,
      simulated: true,
      message: `Resend is not configured. Simulated ${digestType} update.`,
    });
  }

  const resend = new Resend(env.resendApiKey);

  if (isDemoMode()) {
    const workspace = getDemoWorkspace();
    const clientEmail = workspace.profile.contact_email;
    const agencyName = workspace.profile.agency_name;
    const now = Date.now();
    const leads = workspace.opportunities.filter(
      (o) => new Date(o.scheduled_at).getTime() <= now && o.stage === "New Lead",
    );
    const pipeline = leads.reduce((sum, o) => sum + o.deal_value, 0);

    const emailContent = buildDigestContent(digestType, agencyName, leads.length, pipeline);
    const { error: demoError } = await resend.emails.send({
      from: env.resendFromEmail,
      to: [clientEmail],
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (demoError) {
      return NextResponse.json({ ok: false, error: "Demo digest could not be delivered." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, sentTo: [clientEmail], type: digestType });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Workspace database is not configured on this deployment." },
      { status: 503 },
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Database client unavailable" }, { status: 500 });
  }

  const { data: clients, error: clientsError } = await admin
    .from("profiles")
    .select("id, agency_name, contact_email, daily_lead_quota, verified_at")
    .eq("role", "client")
    // Only addresses that proved ownership by completing a sign-in may receive
    // mail. Signup is open to anyone, so an unverified profile is untrusted
    // input, not a consenting recipient.
    .not("verified_at", "is", null);

  if (clientsError) {
    console.error("[daily-digest] could not load verified clients:", clientsError.message);
    return NextResponse.json(
      { ok: false, error: "Workspace schema is not ready for digests. Apply migration 0006." },
      { status: 503 },
    );
  }

  if (!clients || clients.length === 0) {
    return NextResponse.json({ ok: true, message: "No verified clients found" });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  type DigestOpp = {
    user_id: string;
    deal_value: number | null;
    outreach_dispatched: boolean | null;
    scheduled_at: string;
  };

  const nowIso = new Date().toISOString();
  const clientIds = clients.map((client) => client.id);

  // One paginated query for every verified client instead of one per client.
  // The filter is narrowed to the rows the chosen digest actually reports on,
  // and paging keeps PostgREST's 1000-row cap from silently truncating a
  // mature workspace (the cap used to hide rows behind a wrong pipeline total).
  const allRows: DigestOpp[] = [];
  const PAGE_SIZE = 1000;
  const MAX_ROWS = 50000;

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    let page = admin
      .from("opportunities")
      .select("user_id, deal_value, outreach_dispatched, scheduled_at")
      .in("user_id", clientIds)
      .lte("scheduled_at", nowIso);

    if (digestType === "drop") {
      page = page.gte("scheduled_at", startOfToday.toISOString());
    } else if (digestType === "nudge") {
      page = page.or("outreach_dispatched.is.null,outreach_dispatched.eq.false");
    }

    const { data, error } = await page
      .order("scheduled_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("[daily-digest] could not load opportunities:", error.message);
      return NextResponse.json({ ok: false, error: "Could not load pipelines for the digest." }, { status: 500 });
    }

    const rows = (data ?? []) as DigestOpp[];
    allRows.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }

  const byClient = new Map<string, DigestOpp[]>();
  for (const opp of allRows) {
    const existing = byClient.get(opp.user_id);
    if (existing) existing.push(opp);
    else byClient.set(opp.user_id, [opp]);
  }

  const sentList: string[] = [];

  for (const client of clients) {
    const allOpps = byClient.get(client.id) ?? [];
    const releasedToday = allOpps.filter((o) => {
      const at = new Date(o.scheduled_at).getTime();
      return at >= startOfToday.getTime();
    });
    const pendingApproval = allOpps.filter((o) => !o.outreach_dispatched).length;
    const pipeline = releasedToday.reduce((sum, o) => sum + Number(o.deal_value ?? 0), 0);

    // Never send a digest that has nothing to report: an empty workspace would
    // otherwise receive three messages a day that only say "zero".
    const shouldSend =
      digestType === "wrap"
        ? allOpps.length > 0
        : digestType === "nudge"
          ? pendingApproval > 0
          : releasedToday.length > 0;

    if (!shouldSend) continue;

    const content = buildDigestContent(
      digestType,
      client.agency_name,
      releasedToday.length,
      pipeline,
    );

    try {
      const { error: sendError } = await resend.emails.send({
        from: env.resendFromEmail,
        to: [client.contact_email],
        subject: content.subject,
        html: content.html,
        text: content.text,
      });

      if (sendError) {
        // Resend resolves with `{ error }` instead of throwing, so this must be
        // checked or a rejected message would be counted as delivered.
        console.error(`[daily-digest] Resend rejected ${digestType} for ${client.id}:`, sendError.message);
        continue;
      }

      sentList.push(client.contact_email);
    } catch (error) {
      console.error(`[daily-digest] ${digestType} send threw for ${client.id}:`, error);
    }
  }

  return NextResponse.json({ ok: true, dispatched: sentList.length, type: digestType });
}

