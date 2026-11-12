import { NextResponse } from "next/server";
import { Resend } from "resend";
import { env, isResendConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, headerText } from "@/lib/html";
import { checkRateLimit } from "@/lib/rate-limit";
import { ALLOWED_OPERATOR_EMAILS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Must match the roster roles offered by the Team screen. */
const ALLOWED_ROLES = new Set([
  "SDR",
  "BDE",
  "Account Executive",
  "Closer",
  "Manager",
  "Admin",
  "Viewer",
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

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

  const limit = checkRateLimit(`team-invite:${user.id}`, 10, 10 * 60 * 1000);
  if (!limit.success) {
    return NextResponse.json(
      { ok: false, error: "Too many invitations. Please wait a few minutes." },
      { status: 429 },
    );
  }

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ ok: false, error: "Invalid request payload." }, { status: 400 });
  }
  const body = raw as { name?: unknown; email?: unknown; role?: unknown };

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  const requestedRole = typeof body.role === "string" ? body.role.trim() : "BDE";
  const role = ALLOWED_ROLES.has(requestedRole) ? requestedRole : "BDE";

  if (!name || !EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid name and email address." },
      { status: 400 },
    );
  }

  // An invited operator address would be auto-provisioned an account through
  // this route; the operator allow-list is provisioned out of band instead.
  if ((ALLOWED_OPERATOR_EMAILS as readonly string[]).includes(email)) {
    return NextResponse.json(
      { ok: false, error: "That address cannot be added as a team member." },
      { status: 400 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("agency_name")
    .eq("id", user.id)
    .maybeSingle();

  const agencyName = (profile as { agency_name?: string } | null)?.agency_name || "Your Agency";

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
    // 23505 = unique_violation on (agency_id, lower(email)).
    if (insertError.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "That email is already on your roster." },
        { status: 409 },
      );
    }
    console.error("[team-invite] insert failed", insertError.message);
    return NextResponse.json(
      { ok: false, error: "Could not add that team member." },
      { status: 500 },
    );
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        agency_id: user.id,
        name,
        role,
      },
    });
    // "already registered" is the expected case for a re-invite.
    if (createError && !/already|exist/i.test(createError.message)) {
      console.error("[team-invite] auth user provisioning failed", createError.message);
    }
  }

  let emailSent = false;
  if (isResendConfigured()) {
    try {
      const resend = new Resend(env.resendApiKey);
      const safeName = escapeHtml(name);
      const safeAgency = escapeHtml(agencyName);
      const safeRole = escapeHtml(role);

      // Never derive the link from x-forwarded-host: that header is
      // caller-controlled and would turn this welcome email into an
      // open-redirect / phishing hop from our verified sending domain.
      const loginUrl = `${env.appUrl.replace(/\/+$/, "")}/login?email=${encodeURIComponent(email)}`;

      const { error: sendError } = await resend.emails.send({
        from: env.resendFromEmail,
        to: [email],
        subject: headerText(
          `[LILY] You've been added to ${agencyName}'s agency sales roster`,
          200,
        ),
        html: `<div style="font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;color:#18181b;max-width:560px;margin:0 auto;padding:24px 16px;">
          <h2 style="font-size:20px;font-weight:700;color:#09090b;margin-bottom:12px;">Welcome to the team, ${safeName}</h2>
          <p style="margin:0 0 16px;">${safeAgency} has added you as <strong>${safeRole}</strong> to their active sales roster on the LILY Revenue OS.</p>
          <p style="margin:0 0 20px;">You have immediate access to your agency's verified accounts, decision makers, and outreach pipeline.</p>
          <div style="margin:24px 0;">
            <a href="${escapeHtml(loginUrl)}" style="background-color:#10b981;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
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

      if (sendError) {
        console.error("[team-invite] welcome email failed", sendError.message);
      } else {
        emailSent = true;
      }
    } catch (error) {
      console.error("[team-invite] welcome email threw", error);
    }
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
