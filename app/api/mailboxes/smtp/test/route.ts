import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateHostForSsrf } from "@/lib/ssrf";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SMTP_PORTS = [25, 465, 587, 2525];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Database service unavailable." }, { status: 503 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    // This route opens an outbound TCP connection on demand, so it is the most
    // valuable endpoint to abuse; cap it per account.
    const limit = checkRateLimit(`smtp-test:${user.id}`, 10, 10 * 60 * 1000);
    if (!limit.success) {
      return NextResponse.json(
        { ok: false, error: "Too many connection tests. Please wait a few minutes." },
        { status: 429 },
      );
    }

    const raw = await request.json().catch(() => null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const { host, port, user: smtpUser, pass, secure } = raw as {
      host?: unknown;
      port?: unknown;
      user?: unknown;
      pass?: unknown;
      secure?: unknown;
    };

    if (typeof host !== "string" || typeof smtpUser !== "string" || typeof pass !== "string") {
      return NextResponse.json(
        { ok: false, error: "Host, email, and password are required." },
        { status: 400 },
      );
    }

    const cleanUser = smtpUser.trim();
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
      // On 587/25 `secure` is false; requireTLS upgrades with STARTTLS so the
      // AUTH exchange is never sent in cleartext.
      requireTLS: !isSecure,
      tls: { servername: cleanHost },
      auth: {
        user: cleanUser,
        pass,
      },
      connectionTimeout: 10000,
    });

    await transporter.verify();

    return NextResponse.json({
      ok: true,
      message: `Handshake successful. Verified connection to ${cleanHost}:${cleanPort}.`,
    });
  } catch (err) {
    console.error("[smtp-test] handshake failed", err);
    return NextResponse.json(
      { ok: false, error: "SMTP handshake failed. Check the host, port and password." },
      { status: 400 },
    );
  }
}
