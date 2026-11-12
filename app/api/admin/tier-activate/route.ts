import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ALLOWED_OPERATOR_EMAILS } from "@/lib/constants";

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

  if (
    !user ||
    !user.email ||
    !(ALLOWED_OPERATOR_EMAILS as readonly string[]).includes(user.email.toLowerCase())
  ) {
    return NextResponse.json({ ok: false, error: "Unauthorized operator." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Admin client unavailable." }, { status: 500 });
  }

  let body: {
    clientId?: string;
    tier?: string;
    dailyQuota?: number;
    paymentVerified?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }

  const clientId = String(body.clientId || "").trim();
  const tier = (body.tier || "Starter") as "Starter" | "Growth" | "Scale";
  const dailyQuota = Number(body.dailyQuota ?? 15);
  const paymentVerified = body.paymentVerified !== false;

  if (!clientId) {
    return NextResponse.json({ ok: false, error: "Client ID required." }, { status: 400 });
  }

  const { data: updatedProfile, error: updateError } = await admin
    .from("profiles")
    .update({
      subscription_tier: tier,
      daily_lead_quota: dailyQuota,
      payment_verified: paymentVerified,
      payment_amount: 14500,
    })
    .eq("id", clientId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  await admin.from("activity_logs").insert({
    user_id: clientId,
    activity_type: "deal_progressed",
    title: `Tier Activated: ${tier}`,
    description: `Operator activated ${tier} tier with ${dailyQuota} leads/day quota.`,
    deal_name: "Account Activation",
  });

  return NextResponse.json({
    ok: true,
    message: `Activated ${tier} (${dailyQuota} leads/day) for ${updatedProfile.agency_name}.`,
    profile: updatedProfile,
  });
}
