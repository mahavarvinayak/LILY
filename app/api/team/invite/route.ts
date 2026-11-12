import { NextResponse } from "next/server";
import { Resend } from "resend";
import { env, isResendConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { escapeHtml } from "@/lib/html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Database unavailable." }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  }

  let body: { name?: string; email?: string; role?: string };
  try {
    body = (await request.json()) as { name?: string; email?: string; role?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request payload." }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const role = String(body.role || "BDE").trim();

  if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid name and email address." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("agency_name, contact_email")
    .eq("id", user.id)
    .maybeSingle();

  const agencyName = profile?.agency_name || "Your Agency";

  const { data: member, error: insertError } = await supabase
    .from("team_members")
    .insert({
      agency_id: user.id,
      name,
      email,
      role,
      status: "Active",
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ ok: false, error: insertError.message }, { status: 400 });
  }

  let emailSent = false;
  if (isResendConfigured()) {
    try {
      const resend = new Resend(env.resendApiKey);
      const safeName = escapeHtml(name);
      const safeAgency = escapeHtml(agencyName);
      const safeRole = escapeHtml(role);

      const host =
        request.headers.get("x-forwarded-host") || request.headers.get("host") || "lilycrm.in";
      const proto = request.headers.get("x-forwarded-proto") || "https";
      const loginUrl = `${proto}://${host}/login?email=${encodeURIComponent(email)}`;

      await resend.emails.send({
        from: env.resendFromEmail,
        to: [email],
        subject: `[LILY] You've been added to ${agencyName}'s agency sales roster`,
        html: `<div style="font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#18181b;max-width:560px;margin:0 auto;padding:24px 16px;">
          <h2 style="font-size:20px;font-weight:700;color:#09090b;margin-bottom:12px;">Welcome to the team, ${safeName}</h2>
          <p style="margin:0 0 16px;">${safeAgency} has added you as <strong>${safeRole}</strong> to their active sales roster on the LILY Revenue OS.</p>
          <p style="margin:0 0 20px;">You have immediate access to your agency's verified accounts, decision makers, and outreach pipeline.</p>
          <div style="margin:24px 0;">
            <a href="${loginUrl}" style="background-color:#10b981;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
              Enter ${safeAgency} Workspace →
            </a>
          </div>
          <p style="font-size:13px;color:#71717a;margin:0 0 16px;">
            Sign in using your email OTP. No password required.
          </p>
          <hr style="border:0;border-top:1px solid #e4e4e7;margin:24px 0;" />
          <p style="font-size:12px;color:#71717a;margin:0;">LILY Revenue OS · Autonomous B2B Lead Intelligence</p>
        </div>`,
        text: `Hi ${name},\n\n${agencyName} has added you as ${role} to their active sales roster on LILY Revenue OS.\n\nLog in here to enter your workspace: ${loginUrl}\n\nSign in with your email OTP to start.\n\n— LILY Revenue OS`,
      });
      emailSent = true;
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    member,
    emailSent,
    message: emailSent
      ? `Added ${name} to roster and sent welcome notification.`
      : `Added ${name} to agency roster.`,
  });
}

