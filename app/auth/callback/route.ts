import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["magiclink", "signup", "invite", "recovery", "email_change", "email"];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");
  const targetOrigin = isLocalhost
    ? origin
    : forwardedHost
      ? `https://${forwardedHost}`
      : env.appUrl || origin;

  const supabase = await createSupabaseServerClient();
  if (supabase && (code || tokenHash)) {
    // Either a PKCE code exchange or the token-hash magic-link flow.
    const result = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          token_hash: tokenHash!,
          type: (OTP_TYPES.includes(rawType as EmailOtpType) ? rawType : "magiclink") as EmailOtpType,
        });

    if (!result.error) {
      return NextResponse.redirect(`${targetOrigin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${targetOrigin}/login?error=auth`);
}
