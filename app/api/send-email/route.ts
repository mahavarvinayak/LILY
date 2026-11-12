import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptPassword, type EncryptedSecret } from "@/lib/smtp-crypto";
import { escapeHtml, headerText } from "@/lib/html";
import { validateHostForSsrf } from "@/lib/ssrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { getConnectedMailboxes, sendComposioOutreach } from "@/lib/composio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const limit = checkRateLimit(`send-email:${user.id}`, 60, 60 * 1000);
  if (!limit.success) {
    return NextResponse.json(
      { ok: false, error: "Sending too fast. Please wait a moment and retry." },
      { status: 429 },
    );
  }

  let payload: SendEmailBody;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }
    payload = parsed as SendEmailBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  if (
    [payload.to, payload.subject, payload.body, payload.opportunityId].some(
      (value) => value !== undefined && typeof value !== "string",
    )
  ) {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const to = payload.to?.trim();
  const rawSubject = payload.subject?.trim();
  const body = payload.body?.trim();
  const opportunityId = payload.opportunityId?.trim();
  const subject = rawSubject ? headerText(rawSubject, 200) : "";

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
      .select("id, user_id, person_id, scheduled_at, person:people(id, email)")
      .eq("id", opportunityId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!oppRow) {
      return NextResponse.json({ ok: false, error: "Opportunity not found." }, { status: 404 });
    }

    const person = Array.isArray(oppRow.person) ? oppRow.person[0] : oppRow.person;
    const targetEmail = to.toLowerCase();

    if (oppRow.person_id) {
      const currentEmail = person?.email?.trim().toLowerCase();
      if (!currentEmail || currentEmail !== targetEmail) {
        await supabase
          .from("people")
          .update({ email: targetEmail })
          .eq("id", oppRow.person_id)
          .eq("user_id", userId);
      }
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
    if (!customMailbox.smtp_host || !customMailbox.smtp_user) {
      return NextResponse.json(
        { ok: false, error: "The saved SMTP mailbox is incomplete. Reconnect it in Connectors." },
        { status: 400 },
      );
    }

    const hostSsrf = await validateHostForSsrf(customMailbox.smtp_host);
    if (!hostSsrf.safe) {
      return NextResponse.json(
        { ok: false, error: "Configured SMTP host is blocked by SSRF security policy." },
        { status: 400 },
      );
    }

    try {
      const plainPass = decryptPassword(customMailbox.encrypted_pass as EncryptedSecret);
      const smtpSecure = Boolean(customMailbox.smtp_secure);
      // Pin the connection to the vetted address so a rebinding hostname
      // cannot redirect mail delivery to a private target.
      const transporter = nodemailer.createTransport({
        host: hostSsrf.address || customMailbox.smtp_host,
        port: Number(customMailbox.smtp_port) || 465,
        secure: smtpSecure,
        // STARTTLS is mandatory on the non-implicit-TLS ports, otherwise the
        // AUTH credentials travel in cleartext.
        requireTLS: !smtpSecure,
        tls: { servername: customMailbox.smtp_host },
        auth: {
          user: customMailbox.smtp_user,
          pass: plainPass,
        },
        connectionTimeout: 10000,
      });

      // The display name is user text; strip CR/LF and quotes so it cannot
      // break out of the From header and add recipients or headers.
      const displayName =
        headerText(customMailbox.sender_name || "", 80).replace(/["<>]/g, "") || "Growth Lead";
      const fromAddress = customMailbox.sender_email || customMailbox.smtp_user;

      await transporter.sendMail({
        from: `"${displayName}" <${fromAddress}>`,
        to,
        subject,
        text: body,
        html: renderHtml(body),
      });

      if (opportunityId !== "test-verification") {
        const { error: dispatchError } = await supabase
          .from("opportunities")
          .update({ outreach_dispatched: true })
          .eq("id", opportunityId)
          .eq("user_id", userId);

        if (dispatchError) {
          console.error("[send-email] could not flag outreach_dispatched", dispatchError.message);
        }

        const { error: logError } = await supabase.from("activity_logs").insert({
          user_id: userId,
          action: "email_dispatched",
          title: `Outreach sent: ${to.slice(0, 120)}`,
          description: `Subject: "${subject}" via custom SMTP.`,
          metadata: { opportunityId, to, subject, provider: "custom_smtp" },
        });

        if (logError) {
          console.error("[send-email] could not write activity log", logError.message);
        }
      }

      return NextResponse.json({
        ok: true,
        provider: "custom_smtp",
        message: `Outreach dispatched directly from ${customMailbox.smtp_user} via custom SMTP.`,
      });
    } catch (smtpErr) {
      // Nodemailer errors can expose the SMTP conversation and host details.
      console.error("[send-email] custom SMTP dispatch failed", smtpErr);
      return NextResponse.json(
        {
          ok: false,
          error:
            "Your SMTP server rejected the message. Check the mailbox credentials in Connectors and try again.",
        },
        { status: 502 },
      );
    }
  }

  const composioMailboxes = await getConnectedMailboxes(userId);
  const activeComposio = composioMailboxes.find(
    (m) => m.status === "active" && (m.provider === "gmail" || m.provider === "outlook"),
  );

  if (activeComposio) {
    const provider = activeComposio.provider === "outlook" ? "outlook" : "gmail";
    const composioResult = await sendComposioOutreach(userId, {
      to,
      subject,
      body,
      provider,
    });

    if (!composioResult.ok) {
      return NextResponse.json(
        { ok: false, error: composioResult.error || "Failed to dispatch via connected mailbox." },
        { status: 502 },
      );
    }

    if (opportunityId !== "test-verification") {
      const { error: dispatchError } = await supabase
        .from("opportunities")
        .update({ outreach_dispatched: true })
        .eq("id", opportunityId)
        .eq("user_id", userId);

      if (dispatchError) {
        console.error("[send-email] could not flag outreach_dispatched", dispatchError.message);
      }

      const { error: logError } = await supabase.from("activity_logs").insert({
        user_id: userId,
        action: "email_dispatched",
        title: `Outreach sent: ${to.slice(0, 120)}`,
        description: `Subject: "${subject}" via connected ${activeComposio.appName}.`,
        metadata: { opportunityId, to, subject, provider: activeComposio.provider },
      });

      if (logError) {
        console.error("[send-email] could not write activity log", logError.message);
      }
    }

    return NextResponse.json({
      ok: true,
      provider: activeComposio.provider,
      message: `Outreach dispatched directly from ${activeComposio.email} via ${activeComposio.appName}.`,
    });
  }

  return NextResponse.json(
    {
      ok: false,
      error:
        "No sender mailbox connected. Please connect your Gmail, Outlook, or Custom SMTP mailbox in Connectors to send outreach from your own agency address.",
    },
    { status: 400 },
  );
}
