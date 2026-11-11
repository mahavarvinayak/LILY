import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptPassword } from "@/lib/smtp-crypto";
import { validateHostForSsrf } from "@/lib/ssrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SMTP_PORTS = [25, 465, 587, 2525];

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase unconfigured." }, { status: 500 });
    }

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
    }

    const { host, port, user, pass, secure, sender_name } = (await request.json()) as {
      host?: string;
      port?: number;
      user?: string;
      pass?: string;
      secure?: boolean;
      sender_name?: string;
    };

    if (!host || !user || !pass) {
      return NextResponse.json(
        { ok: false, error: "Host, email, and password are required." },
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
      tls: { servername: cleanHost },
      auth: {
        user: user.trim(),
        pass: pass.trim(),
      },
      connectionTimeout: 10000,
    });

    await transporter.verify();

    const encrypted = encryptPassword(pass.trim());
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Admin client unconfigured." }, { status: 500 });
    }

    const senderName = (sender_name || user.split("@")[0] || "Growth Team").trim();

    const { error: upsertErr } = await admin
      .from("workspace_mailboxes")
      .upsert(
        {
          user_id: authUser.id,
          provider: "custom_smtp",
          sender_name: senderName,
          sender_email: user.trim(),
          smtp_host: cleanHost,
          smtp_port: cleanPort,
          smtp_secure: isSecure,
          smtp_user: user.trim(),
          encrypted_pass: encrypted,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (upsertErr) {
      return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: `Universal SMTP mailbox for ${user.trim()} encrypted and connected.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to connect SMTP mailbox.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
