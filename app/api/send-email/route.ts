import { NextResponse } from "next/server";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { env, isResendConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptPassword, type EncryptedSecret } from "@/lib/smtp-crypto";
import { escapeHtml } from "@/lib/html";
import { validateHostForSsrf } from "@/lib/ssrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SendEmailBody {
  to?: string;
  subject?: string;
  body?: string;
  opportunityId?: string;
}

function renderHtml(body: string) {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
  return `<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.65;color:#18181b;max-width:560px">${paragraphs}</div>`;
}

export async function POST(request: Request) {
  // Authorise before reading the body so an anonymous caller learns nothing
  // from payload validation.
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Database service unavailable." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  }

  let payload: SendEmailBody;
  try {
    payload = (await request.json()) as SendEmailBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const to = payload.to?.trim();
  const subject = payload.subject?.trim();
  const body = payload.body?.trim();
  const opportunityId = payload.opportunityId?.trim();

  if (!opportunityId) {
    return NextResponse.json({ ok: false, error: "Opportunity ID is required." }, { status: 400 });
  }
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ ok: false, error: "A valid recipient email is required." }, { status: 400 });
  }
  if (!subject || subject.length > 200) {
    return NextResponse.json({ ok: false, error: "A subject line (max 200 chars) is required." }, { status: 400 });
  }
  if (!body || body.length > 8000) {
    return NextResponse.json({ ok: false, error: "Email body is empty or too long." }, { status: 400 });
  }

  const userId = user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("contact_email")
    .eq("id", userId)
    .maybeSingle();

  if (opportunityId === "test-verification") {
    if (to.toLowerCase() !== (profile?.contact_email ?? "").toLowerCase()) {
      return NextResponse.json(
        { ok: false, error: "Test emails can only be sent to your agency profile email." },
        { status: 403 },
      );
    }
  } else {
    const { data: oppRow } = await supabase
      .from("opportunities")
      .select("id, user_id, scheduled_at, person:people(email)")
      .eq("id", opportunityId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!oppRow) {
      return NextResponse.json({ ok: false, error: "Opportunity not found." }, { status: 404 });
    }
    if (new Date(oppRow.scheduled_at).getTime() > Date.now()) {
      return NextResponse.json({ ok: false, error: "Cannot send outreach to unreleased lead." }, { status: 403 });
    }

    const person = Array.isArray(oppRow.person) ? oppRow.person[0] : oppRow.person;
    const expectedEmail = person?.email?.trim().toLowerCase();
    if (!expectedEmail || expectedEmail !== to.toLowerCase()) {
      return NextResponse.json({ ok: false, error: "Recipient email does not match opportunity contact." }, { status: 400 });
    }
  }

  const admin = createSupabaseAdminClient();
  let customMailbox: {
    sender_name: string;
    sender_email: string;
    smtp_host: string;
    smtp_port: number;
    smtp_secure: boolean;
    smtp_user: string;
    encrypted_pass: unknown;
    status: string;
  } | null = null;

  if (admin) {
    const { data: mb } = await admin
      .from("workspace_mailboxes")
      .select("sender_name, sender_email, smtp_host, smtp_port, smtp_secure, smtp_user, encrypted_pass, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    customMailbox = mb;
  }

  if (customMailbox) {
    const hostSsrf = await validateHostForSsrf(customMailbox.smtp_host);
    if (!hostSsrf.safe) {
      return NextResponse.json(
        { ok: false, error: "Configured SMTP host is blocked by SSRF security policy." },
        { status: 400 },
      );
    }

    try {
      const plainPass = decryptPassword(customMailbox.encrypted_pass as EncryptedSecret);
      // Pin the connection to the vetted address so a rebinding hostname
      // cannot redirect mail delivery to a private target.
      const transporter = nodemailer.createTransport({
        host: hostSsrf.address || customMailbox.smtp_host,
        port: Number(customMailbox.smtp_port) || 465,
        secure: customMailbox.smtp_secure,
        tls: { servername: customMailbox.smtp_host },
        auth: {
          user: customMailbox.smtp_user,
          pass: plainPass,
        },
        connectionTimeout: 10000,
      });

      await transporter.sendMail({
        from: `"${customMailbox.sender_name || "Growth Lead"}" <${customMailbox.smtp_user}>`,
        to,
        subject,
        text: body,
        html: renderHtml(body),
      });

      if (opportunityId !== "test-verification") {
        await supabase
          .from("opportunities")
          .update({ outreach_dispatched: true })
          .eq("id", opportunityId)
          .eq("user_id", userId);
      }

      return NextResponse.json({
        ok: true,
        provider: "custom_smtp",
        message: `Outreach dispatched directly from ${customMailbox.smtp_user} via custom SMTP.`,
      });
    } catch (smtpErr) {
      return NextResponse.json(
        { ok: false, error: smtpErr instanceof Error ? smtpErr.message : "SMTP dispatch failed." },
        { status: 502 },
      );
    }
  }

  if (!isResendConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "No email dispatch service is configured. Please connect a Custom SMTP mailbox in Connectors.",
      },
      { status: 503 },
    );
  }

  const resend = new Resend(env.resendApiKey);
  const replyTo = profile?.contact_email || env.resendFromEmail.replace(/.*<(.+)>.*/, "$1");

  try {
    const { data, error } = await resend.emails.send({
      from: env.resendFromEmail,
      to: [to],
      subject,
      html: renderHtml(body),
      text: body,
      replyTo,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    }

    if (opportunityId !== "test-verification") {
      await supabase
        .from("opportunities")
        .update({ outreach_dispatched: true })
        .eq("id", opportunityId)
        .eq("user_id", userId);
    }

    return NextResponse.json({
      ok: true,
      id: data?.id,
      provider: "resend",
      message: `Email dispatched to ${to}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resend request failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
