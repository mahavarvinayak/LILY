import { NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { getDemoWorkspace } from "@/lib/demo-store";
import { buildDigestContent } from "@/lib/digest-email";
import { env, isDemoMode, isResendConfigured, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const typeParam = url.searchParams.get("type") as "drop" | "nudge" | "wrap" | null;
  return handleDigest(request, typeParam ?? "drop");
}

export async function POST(request: Request) {
  let body: { type?: "drop" | "nudge" | "wrap" } = {};
  try {
    body = (await request.json()) as { type?: "drop" | "nudge" | "wrap" };
  } catch {}
  return handleDigest(request, body.type ?? "drop");
}

async function handleDigest(request: Request, digestType: "drop" | "nudge" | "wrap") {
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

  const sentList: string[] = [];

  for (const client of clients) {
    const { data: opps } = await admin
      .from("opportunities")
      .select("deal_value, stage, outreach_dispatched, scheduled_at")
      .eq("user_id", client.id)
      .lte("scheduled_at", new Date().toISOString());

    const allOpps = opps ?? [];
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

