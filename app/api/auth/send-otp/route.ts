import { NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { env, isResendConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
type AccountLookup = "exists" | "missing" | "unknown";

/**
 * Does this address own an account in `auth.users`?
 *
 * Uses the `auth_user_exists` RPC from migration 0005 (service-role only).
 * `profiles.contact_email` is a client-writable column, so it must never gate
 * delivery: `generateLink` would silently create an account for whatever
 * address it is handed. Before 0005 is applied the RPC is missing (PGRST202),
 * so we fall back to paging the admin user list.
 */
async function lookupAccount(admin: AdminClient, email: string): Promise<AccountLookup> {
  const { data, error } = await admin.rpc("auth_user_exists", { p_email: email });

  if (!error) {
    return data === true ? "exists" : "missing";
  }

  const code = (error as { code?: string }).code;
  if (code !== "PGRST202") {
    console.error("[send-otp] auth_user_exists failed:", error.message);
    return "unknown";
  }

  // TODO(0005): delete this fallback once the migration is applied everywhere.
  console.warn("[send-otp] auth_user_exists is missing; falling back to admin user listing.");
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (listError) {
      console.error("[send-otp] user listing failed:", listError.message);
      return "unknown";
    }

    const users = listed?.users ?? [];
    if (users.some((user) => user.email?.toLowerCase() === target)) return "exists";
    if (users.length < 1000) break;
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

    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret) {
      return NextResponse.json({ ok: false, error: "Server authentication key unconfigured." }, { status: 500 });
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

    let tokenHash: string | null = null;
    let verificationType = "magiclink";

    if (accountExists) {
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: cleanEmail,
      });

      if (linkError) {
        // Never echo the provider message, and fall through to the decoy path
        // so a provider failure is indistinguishable from an unknown address.
        console.error("[send-otp] generateLink failed:", linkError.message);
      } else if (linkData?.properties?.hashed_token) {
        tokenHash = linkData.properties.hashed_token;
        verificationType = linkData.properties.verification_type || "magiclink";
      }
    }

    const deliverable = tokenHash !== null;

    if (!tokenHash) {
      // Decoy challenge: same row shape, same cookie, same response, but no
      // mail and no Supabase account. Without it this route leaks whether an
      // address has a workspace (different message, missing cookie, and no
      // attempt counter to burn).
      tokenHash = crypto.randomBytes(32).toString("hex");
      verificationType = "magiclink";
    }

    const codeNum = crypto.randomInt(100000, 1000000);
    const code = codeNum.toString();

    const codeHash = crypto
      .createHmac("sha256", secret)
      .update(`${cleanEmail}:${code}`)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: otpRow, error: otpError } = await admin
      .from("auth_otps")
      .insert({
        email: cleanEmail,
        code_hash: codeHash,
        token_hash: tokenHash,
        verification_type: verificationType,
        attempts: 0,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (otpError || !otpRow?.id) {
      return NextResponse.json({ ok: false, error: "Failed to store authentication challenge." }, { status: 500 });
    }

    if (deliverable) {
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
        return NextResponse.json(
          { ok: false, error: "We could not deliver the sign-in code. Please try again." },
          { status: 502 },
        );
      }
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
