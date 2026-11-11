import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ALLOWED_OPERATOR_EMAILS } from "@/lib/constants";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { MAX_AGENCY_NAME_LENGTH, normalizeAgencyName } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Agency names are client-supplied and end up in email headers and bodies, so
 * normalise them at the door and reject anything that cannot be a real name.
 */
function cleanAgencyName(raw: string | undefined, email: string): string | null {
  const provided = (raw ?? "").trim();
  if (!provided) {
    return normalizeAgencyName(email.split("@")[0] ?? "") || "Agency Workspace";
  }
  if (provided.length > MAX_AGENCY_NAME_LENGTH) return null;

  const cleaned = normalizeAgencyName(provided);
  return cleaned.length >= 2 ? cleaned : null;
}

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const ipLimit = checkRateLimit(`signup:ip:${clientIp}`, 5, 60 * 60 * 1000);
    if (!ipLimit.success) {
      return NextResponse.json(
        { ok: false, error: "Too many registration attempts. Please try again later." },
        { status: 429 },
      );
    }

    const { email, agency } = (await request.json()) as {
      email?: string;
      agency?: string;
    };

    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "Please enter a valid work email." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    if ((ALLOWED_OPERATOR_EMAILS as readonly string[]).includes(cleanEmail)) {
      return NextResponse.json(
        { ok: false, error: "Registration for this email address is restricted." },
        { status: 403 },
      );
    }

    const agencyName = cleanAgencyName(agency, cleanEmail);
    if (!agencyName) {
      return NextResponse.json(
        { ok: false, error: "Agency name must be between 2 and 80 characters." },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Authentication service unavailable." }, { status: 500 });
    }

    // No password is ever accepted here. A password chosen by whoever typed the
    // address first would survive the victim's later OTP sign-in (pre-hijack),
    // so accounts are passwordless and only reachable through the emailed code.
    const { error } = await admin.auth.admin.createUser({
      email: cleanEmail,
      email_confirm: true,
      user_metadata: { agency_name: agencyName },
    });

    if (error) {
      const alreadyExists =
        (error as { code?: string }).code === "email_exists" ||
        error.message.toLowerCase().includes("already") ||
        error.message.toLowerCase().includes("exists");

      if (!alreadyExists) {
        console.error("[signup] createUser failed:", error.message);
        return NextResponse.json(
          { ok: false, error: "Could not create the workspace. Please try again." },
          { status: 400 },
        );
      }
    }

    // Identical response for a fresh and an existing address, and no session is
    // ever returned: signup is not a login shortcut.
    return NextResponse.json({
      ok: true,
      message: "Workspace request received. Request a 6-digit sign-in code to open it.",
    });
  } catch (error) {
    console.error("[signup] unexpected failure:", error);
    return NextResponse.json(
      { ok: false, error: "Could not create the workspace. Please try again." },
      { status: 500 },
    );
  }
}
