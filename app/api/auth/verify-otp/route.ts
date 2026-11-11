import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const ipLimit = checkRateLimit(`verify-otp:ip:${clientIp}`, 15, 5 * 60 * 1000);
    if (!ipLimit.success) {
      return NextResponse.json(
        { ok: false, error: "Too many verification attempts from this network. Please wait 5 minutes." },
        { status: 429 },
      );
    }

    const { email, code } = (await request.json()) as { email?: string; code?: string };
    if (!email || !code) {
      return NextResponse.json({ ok: false, error: "Please enter your email and 6-digit code." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/lily_otp_session=([^;]+)/);
    const sessionId = match?.[1] ? decodeURIComponent(match[1]).trim() : null;

    if (!sessionId) {
      return NextResponse.json({
        ok: false,
        error: "Verification session expired or not found. Please request a new code.",
      }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Authentication service unavailable." }, { status: 500 });
    }

    const { data: challenge, error: challengeError } = await admin
      .from("auth_otps")
      .select("id, email, code_hash, token_hash, verification_type, attempts, expires_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (challengeError || !challenge) {
      return NextResponse.json({
        ok: false,
        error: "Verification code expired. Please request a fresh 6-digit code.",
      }, { status: 400 });
    }

    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      await admin.from("auth_otps").delete().eq("id", sessionId);
      return NextResponse.json({
        ok: false,
        error: "Verification code expired. Please request a fresh 6-digit code.",
      }, { status: 400 });
    }

    if (challenge.email.toLowerCase() !== cleanEmail) {
      // A mismatched email is not a wrong guess against this challenge, so it
      // must not consume one of the five attempts.
      return NextResponse.json({
        ok: false,
        error: "Email address does not match verification session.",
      }, { status: 400 });
    }

    if (typeof challenge.attempts === "number" && challenge.attempts >= 5) {
      await admin.from("auth_otps").delete().eq("id", sessionId);
      return NextResponse.json({
        ok: false,
        error: "Too many failed attempts. For security, please request a new verification code.",
      }, { status: 429 });
    }

    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret) {
      return NextResponse.json({ ok: false, error: "Server authentication key unconfigured." }, { status: 500 });
    }

    const computedHash = crypto
      .createHmac("sha256", secret)
      .update(`${cleanEmail}:${cleanCode}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(challenge.code_hash, "hex");
    const actualBuffer = Buffer.from(computedHash, "hex");

    // Burn the attempt *before* comparing. The check above only sees the value
    // read at the start of the request, so a concurrent burst could otherwise
    // evaluate far more than five guesses inside the cap. `increment_otp_attempt`
    // is atomic and saturates at 5, so at most four callers ever reach the
    // comparison below. A correct code on the fifth call is refused as well —
    // it costs the user one extra "request a new code", and keeps this race-free.
    const { data: attemptsAfter, error: incError } = await admin.rpc("increment_otp_attempt", {
      p_id: sessionId,
    });

    if (incError) {
      return NextResponse.json(
        { ok: false, error: "Verification is temporarily unavailable. Please retry." },
        { status: 500 },
      );
    }

    if (typeof attemptsAfter === "number" && attemptsAfter >= 5) {
      await admin.from("auth_otps").delete().eq("id", sessionId);
      return NextResponse.json({
        ok: false,
        error: "Too many failed attempts. For security, please request a new verification code.",
      }, { status: 429 });
    }

    const isMatch =
      expectedBuffer.length === actualBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, actualBuffer);

    if (!isMatch) {
      return NextResponse.json({
        ok: false,
        error: "Incorrect 6-digit code. Please check your email and try again.",
      }, { status: 400 });
    }

    await admin.from("auth_otps").delete().eq("id", sessionId);

    const supabase = await createSupabaseServerClient();
    let userSession: { access_token: string; refresh_token: string } | null = null;

    if (supabase && challenge.token_hash) {
      const vType = (challenge.verification_type || "magiclink") as "magiclink" | "signup";
      let authRes = await supabase.auth.verifyOtp({
        token_hash: challenge.token_hash,
        type: vType,
      });

      if (authRes.error && vType !== "signup") {
        authRes = await supabase.auth.verifyOtp({
          token_hash: challenge.token_hash,
          type: "signup",
        });
      }

      if (authRes.error && vType !== "magiclink") {
        authRes = await supabase.auth.verifyOtp({
          token_hash: challenge.token_hash,
          type: "magiclink",
        });
      }

      if (authRes.error) {
        console.error("[verify-otp] session exchange failed:", authRes.error.message);
        return NextResponse.json(
          { ok: false, error: "We could not complete sign-in. Please request a new code." },
          { status: 400 },
        );
      }

      if (authRes.data?.session) {
        userSession = {
          access_token: authRes.data.session.access_token,
          refresh_token: authRes.data.session.refresh_token,
        };
      }
    }

    const response = NextResponse.json({
      ok: true,
      message: "Authentication successful.",
      session: userSession,
      redirectTo: "/dashboard",
    });

    response.cookies.delete("lily_otp_session");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
