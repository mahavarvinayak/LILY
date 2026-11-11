import { NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { env, isDemoMode, isResendConfigured, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDemoWorkspace } from "@/lib/demo-store";
import { formatInr } from "@/lib/utils";

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
    await resend.emails.send({
      from: env.resendFromEmail,
      to: [clientEmail],
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

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

  const { data: clients } = await admin
    .from("profiles")
    .select("id, agency_name, contact_email, daily_lead_quota")
    .eq("role", "client");

  if (!clients || clients.length === 0) {
    return NextResponse.json({ ok: true, message: "No active clients found" });
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
    const pipeline = releasedToday.reduce((sum, o) => sum + Number(o.deal_value ?? 0), 0);

    const content = buildDigestContent(
      digestType,
      client.agency_name,
      releasedToday.length,
      pipeline,
    );

    try {
      await resend.emails.send({
        from: env.resendFromEmail,
        to: [client.contact_email],
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
      sentList.push(client.contact_email);
    } catch {}
  }

  return NextResponse.json({ ok: true, dispatched: sentList.length, type: digestType });
}

function buildDigestContent(
  type: "drop" | "nudge" | "wrap",
  agencyName: string,
  leadCount: number,
  pipelineValue: number,
) {
  if (type === "drop") {
    return {
      subject: `⚡ [LILY] 08:00 AM Lead Drop: ${leadCount} Fresh Leads for ${agencyName}`,
      html: `<div style="font-family:sans-serif;max-width:560px;color:#18181b;line-height:1.6">
        <h2 style="color:#6C5CE7;margin-bottom:8px">⚡ Today's 08:00 AM Lead Drop is Live</h2>
        <p>Hi ${agencyName} Team,</p>
        <p><strong>${leadCount} verified B2B leads</strong> representing <strong>${formatInr(pipelineValue, true)}</strong> in pipeline value have landed in your LILY workspace.</p>
        <p>Each lead has a verified decision-maker trigger signal and pre-drafted pain-led pitch ready for your 1-click review.</p>
        <p style="margin-top:24px">
          <a href="${env.appUrl}/dashboard/opportunities" style="background:#6C5CE7;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block">Open Pipeline & Review Leads</a>
        </p>
      </div>`,
      text: `Today's 08:00 AM Lead Drop is live for ${agencyName}.\n\n${leadCount} verified leads (${formatInr(pipelineValue, true)}) are ready in your workspace.\nOpen your pipeline: ${env.appUrl}/dashboard/opportunities`,
    };
  }

  if (type === "nudge") {
    return {
      subject: `🎯 [LILY] 01:00 PM Outreach Nudge: Pitches Waiting for Approval`,
      html: `<div style="font-family:sans-serif;max-width:560px;color:#18181b;line-height:1.6">
        <h2 style="color:#6C5CE7;margin-bottom:8px">🎯 01:00 PM Outreach Review Nudge</h2>
        <p>Hi ${agencyName} Team,</p>
        <p>Your team's AI-drafted pitches are waiting for human approval in the Outreach Studio.</p>
        <p>Review the 2-line personalized hooks and click <strong>Approve & Send</strong> to dispatch outbound before the afternoon prospect response window closes.</p>
        <p style="margin-top:24px">
          <a href="${env.appUrl}/dashboard/opportunities" style="background:#6C5CE7;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block">Review & Dispatch Pitches</a>
        </p>
      </div>`,
      text: `01:00 PM Outreach Review Nudge for ${agencyName}.\nPitches are waiting in Outreach Studio for review and dispatch.\nReview: ${env.appUrl}/dashboard/opportunities`,
    };
  }

  return {
    subject: `📊 [LILY] 06:00 PM Daily Wrap: Pipeline Status for ${agencyName}`,
    html: `<div style="font-family:sans-serif;max-width:560px;color:#18181b;line-height:1.6">
      <h2 style="color:#6C5CE7;margin-bottom:8px">📊 End of Day Pipeline Summary</h2>
      <p>Hi ${agencyName} Team,</p>
      <p>Here is your daily outbound summary for today.</p>
      <p>Total Pipeline Tracked: <strong>${formatInr(pipelineValue, true)}</strong></p>
      <p>Log in to your workspace to check active prospect replies and follow-up tasks for tomorrow morning.</p>
      <p style="margin-top:24px">
        <a href="${env.appUrl}/dashboard" style="background:#6C5CE7;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block">Open LILY Dashboard</a>
      </p>
    </div>`,
    text: `End of Day Pipeline Summary for ${agencyName}.\nTotal Pipeline: ${formatInr(pipelineValue, true)}.\nView: ${env.appUrl}/dashboard`,
  };
}

