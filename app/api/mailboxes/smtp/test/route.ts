import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateHostForSsrf } from "@/lib/ssrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SMTP_PORTS = [25, 465, 587, 2525];

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Database service unavailable." }, { status: 500 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const { host, port, user: smtpUser, pass, secure } = (await request.json()) as {
      host?: string;
      port?: number;
      user?: string;
      pass?: string;
      secure?: boolean;
    };

    if (!host || !smtpUser || !pass) {
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
        user: smtpUser.trim(),
        pass: pass.trim(),
      },
      connectionTimeout: 10000,
    });

    await transporter.verify();

    return NextResponse.json({
      ok: true,
      message: `Handshake successful. Verified connection to ${cleanHost}:${cleanPort}.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMTP handshake failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
