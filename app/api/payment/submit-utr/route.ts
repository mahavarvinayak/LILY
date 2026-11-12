import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  let body: { utr?: string };
  try {
    body = (await request.json()) as { utr?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }

  const utr = String(body.utr || "").trim();
  if (!utr || utr.length < 6) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid UPI transaction reference (UTR)." },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient() || supabase;
  const { error: updateError } = await admin
    .from("profiles")
    .update({ payment_utr: utr })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  await admin.from("activity_logs").insert({
    user_id: user.id,
    activity_type: "deal_progressed",
    title: "UPI Advance Verification Submitted",
    description: `Submitted UPI UTR reference: ${utr}`,
    deal_name: "₹14,500 Setup Advance",
  });

  return NextResponse.json({
    ok: true,
    message: "UTR submitted. Your operator will verify and activate your quota.",
  });
}
