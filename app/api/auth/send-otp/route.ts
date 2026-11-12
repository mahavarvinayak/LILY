import { after, NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { env, isResendConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getAuthSecret } from "@/lib/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
type AccountLookup = "exists" | "missing" | "unknown";

/**
 * Does this address own an account in `auth.users`?
 *
 * Uses the `auth_user_exists` RPC (migration 0005, service-role only).
 * `profiles.contact_email` is a client-writable column, so it must never gate
 * delivery: `generateLink` would silently create an account for whatever
 * address it is handed. A lookup failure is treated as "unknown" and answered
 * exactly like an unknown address — no mail, no account.
 */
async function lookupAccount(admin: AdminClient, email: string): Promise<AccountLookup> {
  const { data, error } = await admin.rpc("auth_user_exists", { p_email: email });

  if (data === true) return "exists";

  const { data: member } = await admin
    .from("team_members")
    .select("agency_id, name, role")
    .eq("email", email)
    .maybeSingle();

  if (member) {
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        agency_id: member.agency_id,
        name: member.name,
        role: member.role,
      },
    });

    if (!createErr || (createErr as { code?: string }).code === "email_exists") {
      return "exists";
    }
  }

  if (error) {
    console.error("[send-otp] auth_user_exists failed:", error.message);
    return "unknown";
  }

  return "missing";
}

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const ipLimit = checkRateLimit(`send-otp:ip:${clientIp}`, 10, 10 * 60 * 1000);
    if (!ipLimit.success) {
      return NextResponse.json(
        { ok: false, error: "Too many requests from this network. Please wait a few minutes." },
        { status: 429 },
      );
    }

    const { email } = (await request.json()) as { email?: string };
    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailLimit = checkRateLimit(`send-otp:email:${cleanEmail}`, 3, 10 * 60 * 1000);
    if (!emailLimit.success) {
      return NextResponse.json(
        { ok: false, error: "Too many sign-in code requests for this email. Please wait 10 minutes." },
        { status: 429 },
      );
    }

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Authentication service unavailable." }, { status: 500 });
    }

    // The in-memory limiter above resets on every serverless cold start, so the
    // durable per-email quota is enforced against rows we already store.
    const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentCodes } = await admin
      .from("auth_otps")
      .select("id", { count: "exact", head: true })
      .eq("email", cleanEmail)
      .gte("created_at", windowStart);

    if ((recentCodes ?? 0) >= 3) {
      return NextResponse.json(
        { ok: false, error: "Too many sign-in code requests for this email. Please wait 10 minutes." },
        { status: 429 },
      );
    }

    // Delivery must be impossible before the existence check, otherwise a
    // misconfigured deployment answers 500 for real accounts and 200 for
    // unknown ones — a free account-enumeration oracle.
    if (!isResendConfigured()) {
      return NextResponse.json({
        ok: false,
        error: "Email delivery service (Resend) is not configured in environment.",
      }, { status: 500 });
    }

    let secret: string;
    try {
      secret = getAuthSecret();
    } catch {
      console.error("[send-otp] authentication signing key is not configured");
      return NextResponse.json(
        { ok: false, error: "Authentication service is not configured." },
        { status: 503 },
      );
    }

    // Only addresses that already own an account may receive a code. Without
    // this check Supabase's admin `generateLink` would auto-create an account
    // for any address typed into the form.
    const account = await lookupAccount(admin, cleanEmail);
    const accountExists = account === "exists";

    await admin
      .from("auth_otps")
      .delete()
      .eq("email", cleanEmail)
      .lt("expires_at", new Date().toISOString());

    const code = crypto.randomInt(100000, 1000000).toString();

    const codeHash = crypto
      .createHmac("sha256", secret)
      .update(`${cleanEmail}:${code}`)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // A placeholder token keeps the row shape identical for both paths. For a
    // real account the magic-link hash is written after the response (below).
    const { data: otpRow, error: otpError } = await admin
      .from("auth_otps")
      .insert({
        email: cleanEmail,
        code_hash: codeHash,
        token_hash: crypto.randomBytes(32).toString("hex"),
        verification_type: "magiclink",
        attempts: 0,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (otpError || !otpRow?.id) {
      return NextResponse.json({ ok: false, error: "Failed to store authentication challenge." }, { status: 500 });
    }

    if (accountExists) {
      // Everything slow runs after the response is flushed. The admin
      // `generateLink` call plus the Resend round trip take hundreds of
      // milliseconds, and doing them inline made a real address measurably
      // slower than an unknown one — a timing oracle even with identical
      // bodies, cookies and status codes.
      after(async () => {
        try {
          const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
            type: "magiclink",
            email: cleanEmail,
          });

          const linkToken = linkData?.properties?.hashed_token;
          if (linkError || !linkToken) {
            await admin.from("auth_otps").delete().eq("id", otpRow.id);
            console.error("[send-otp] generateLink failed:", linkError?.message ?? "missing hashed_token");
            return;
          }

          const { error: tokenError } = await admin
            .from("auth_otps")
            .update({
              token_hash: linkToken,
              verification_type: linkData?.properties?.verification_type || "magiclink",
            })
            .eq("id", otpRow.id);

          if (tokenError) {
            await admin.from("auth_otps").delete().eq("id", otpRow.id);
            console.error("[send-otp] could not store the magic-link token:", tokenError.message);
            return;
          }

          const resend = new Resend(env.resendApiKey);
          const fromAddress = env.resendFromEmail || "LILY <hello@thepilab.in>";

          const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #080C0A; color: #EDE9FE; margin: 0; padding: 40px 20px; }
          .container { max-width: 500px; margin: 0 auto; background-color: #101814; border: 1px solid #1E2E25; border-radius: 24px; padding: 36px 32px; }
          .logo { font-size: 20px; font-weight: 800; color: #EDE9FE; letter-spacing: 2px; margin-bottom: 24px; }
          .logo span { color: #8B5CF6; }
          h1 { font-size: 24px; font-weight: 600; margin: 0 0 12px; color: #FFFFFF; }
          p { font-size: 14px; line-height: 1.6; color: #94A3B8; margin: 0 0 24px; }
          .code-box { background: #080C0A; border: 1px solid #8B5CF6; border-radius: 16px; padding: 20px; text-align: center; margin: 28px 0; }
          .code { font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 700; color: #A78BFA; letter-spacing: 12px; }
          .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #1E2E25; font-size: 11px; color: #64748B; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">LILY <span>// REVENUE OS</span></div>
          <h1>Sign in to your pipeline</h1>
          <p>Use the six-digit verification code below to sign in to your private agency workspace. This code expires in 10 minutes.</p>
          <div class="code-box">
            <div class="code">${code}</div>
          </div>
          <p style="font-size: 12px; color: #64748B;">If you did not request this verification code, you can safely ignore this email.</p>
          <div class="footer">
            THE &#928; LAB &middot; Autonomous Revenue Pipeline Architecture &middot; Dahod, Gujarat
          </div>
        </div>
      </body>
    </html>
    `;

          const { error: resendError } = await resend.emails.send({
            from: fromAddress,
            to: [cleanEmail],
            subject: `Your LILY sign-in code: ${code}`,
            html: htmlContent,
            text: `Your LILY sign-in verification code is: ${code}. It expires in 10 minutes.`,
          });

          if (resendError) {
            // Never leave a challenge behind that the user never received.
            await admin.from("auth_otps").delete().eq("id", otpRow.id);
            console.error("[send-otp] Resend rejected the message:", resendError.message);
          }
        } catch (error) {
          await admin.from("auth_otps").delete().eq("id", otpRow.id);
          console.error("[send-otp] background delivery failed:", error);
        }
      });
    }

    // One message for every address, delivered or not: the response must not
    // depend on whether a workspace exists.
    const response = NextResponse.json({
      ok: true,
      message: `If a workspace exists for ${cleanEmail}, a 6-digit code is on its way.`,
    });

    response.cookies.set("lily_otp_session", otpRow.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    return response;
  } catch (error) {
    // Never surface provider/SDK messages: they can name internals or reveal
    // whether an account exists.
    console.error("[send-otp] unexpected failure:", error);
    return NextResponse.json(
      { ok: false, error: "We could not process that request. Please try again." },
      { status: 500 },
    );
  }
}
