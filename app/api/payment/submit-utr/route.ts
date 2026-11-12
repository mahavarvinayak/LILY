import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { SUBSCRIPTION_TIERS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** UPI/bank reference numbers are alphanumeric; anything else is noise. */
const UTR_REGEX = /^[A-Za-z0-9]{6,30}$/;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Database unavailable." }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
  }

  const limit = checkRateLimit(`utr:${user.id}`, 5, 10 * 60 * 1000);
  if (!limit.success) {
    return NextResponse.json(
      { ok: false, error: "Too many submissions. Please wait a few minutes." },
      { status: 429 },
    );
  }

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }

  const utr = typeof (raw as { utr?: unknown }).utr === "string"
    ? ((raw as { utr: string }).utr).trim()
    : "";

  if (!UTR_REGEX.test(utr)) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid UPI transaction reference (6–30 letters or digits)." },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Payment verification is not configured on this deployment." },
      { status: 503 },
    );
  }

  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update({ payment_utr: utr })
    .eq("id", user.id)
    .select("id");

  if (updateError) {
    console.error("[submit-utr] profile update failed", updateError.message);
    return NextResponse.json({ ok: false, error: "Could not save your UTR." }, { status: 500 });
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Workspace not found for this account." },
      { status: 404 },
    );
  }

  const { error: logError } = await admin.from("activity_logs").insert({
    user_id: user.id,
    action: "payment_utr_submitted",
    title: "UPI advance verification submitted",
    description: `Submitted UPI UTR reference: ${utr}`,
    metadata: {
      utr,
      expectedAmount: SUBSCRIPTION_TIERS.Starter.price,
    },
  });

  if (logError) {
    console.error("[submit-utr] activity log failed", logError.message);
  }

  return NextResponse.json({
    ok: true,
    message: "UTR submitted. Your operator will verify and activate your quota.",
  });
}
