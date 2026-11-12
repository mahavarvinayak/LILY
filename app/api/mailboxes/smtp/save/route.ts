import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptPassword } from "@/lib/smtp-crypto";
import { validateHostForSsrf } from "@/lib/ssrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { headerText } from "@/lib/html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SMTP_PORTS = [25, 465, 587, 2525];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase unconfigured." }, { status: 503 });
    }

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
    }

    const limit = checkRateLimit(`smtp-save:${authUser.id}`, 6, 10 * 60 * 1000);
    if (!limit.success) {
      return NextResponse.json(
        { ok: false, error: "Too many attempts. Please wait a few minutes." },
        { status: 429 },
      );
    }

    const raw = await request.json().catch(() => null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const {
      host,
      port,
      user,
      pass,
      secure,
      sender_name,
    } = raw as {
      host?: unknown;
      port?: unknown;
      user?: unknown;
      pass?: unknown;
      secure?: unknown;
      sender_name?: unknown;
    };

    if (typeof host !== "string" || typeof user !== "string" || typeof pass !== "string") {
      return NextResponse.json(
        { ok: false, error: "Host, email, and password are required." },
        { status: 400 },
      );
    }

    const cleanUser = user.trim();
    if (!host.trim() || !cleanUser || !pass) {
      return NextResponse.json(
        { ok: false, error: "Host, email, and password are required." },
        { status: 400 },
      );
    }

    if (!EMAIL_REGEX.test(cleanUser)) {
      return NextResponse.json(
        { ok: false, error: "Enter the mailbox email address you want to send from." },
        { status: 400 },
      );
    }

    const cleanHost = host.trim().toLowerCase();
    const ssrfCheck = await validateHostForSsrf(cleanHost);
    if (!ssrfCheck.safe) {
      return NextResponse.json(
        { ok: false, error: ssrfCheck.error || "Host not permitted." },
        { status: 400 },
      );
    }

    const cleanPort = Number(port) || 465;
    if (!ALLOWED_SMTP_PORTS.includes(cleanPort)) {
      return NextResponse.json(
        { ok: false, error: "Only standard SMTP ports (25, 465, 587, 2525) are supported." },
        { status: 400 },
      );
    }

    const isSecure = typeof secure === "boolean" ? secure : cleanPort === 465;

    // Connect to the address we already vetted, not a fresh DNS lookup, so a
    // rebinding hostname cannot redirect the connection to a private target.
    const transporter = nodemailer.createTransport({
      host: ssrfCheck.address || cleanHost,
      port: cleanPort,
      secure: isSecure,
      // On 587/25 `secure` is false, so without requireTLS nodemailer would
      // happily send AUTH credentials in cleartext.
      requireTLS: !isSecure,
      tls: { servername: cleanHost },
      auth: {
        user: cleanUser,
        // Do not trim: App Passwords may legitimately contain spaces.
        pass,
      },
      connectionTimeout: 10000,
    });

    await transporter.verify();

    const encrypted = encryptPassword(pass);
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Admin client unconfigured." }, { status: 503 });
    }

    const senderName =
      headerText(typeof sender_name === "string" ? sender_name : "", 80) ||
      cleanUser.split("@")[0] ||
      "Growth Team";

    const { error: upsertErr } = await admin
      .from("workspace_mailboxes")
      .upsert(
        {
          user_id: authUser.id,
          provider: "custom_smtp",
          sender_name: senderName,
          sender_email: cleanUser,
          smtp_host: cleanHost,
          smtp_port: cleanPort,
          smtp_secure: isSecure,
          smtp_user: cleanUser,
          encrypted_pass: encrypted,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (upsertErr) {
      console.error("[smtp-save] upsert failed", upsertErr.message);
      return NextResponse.json({ ok: false, error: "Could not save the mailbox." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: `Universal SMTP mailbox for ${cleanUser} encrypted and connected.`,
    });
  } catch (err) {
    // Nodemailer errors can echo the AUTH command and host details back; keep
    // the response generic and log the detail server-side.
    console.error("[smtp-save] connection failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not connect with those SMTP credentials. Check the host, port and password." },
      { status: 400 },
    );
  }
}
