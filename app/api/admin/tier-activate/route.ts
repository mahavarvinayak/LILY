import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  ALLOWED_OPERATOR_EMAILS,
  SUBSCRIPTION_TIERS,
  isSubscriptionTier,
} from "@/lib/constants";
import type { Profile } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DAILY_QUOTA = 50;

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

  // Operator routes require both the allow-listed email and the super_admin
  // role, exactly like every other admin surface.
  const { data: operatorRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if ((operatorRow as Pick<Profile, "role"> | null)?.role !== "super_admin") {
    return NextResponse.json({ ok: false, error: "Super admin role required." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Admin client unavailable." }, { status: 503 });
  }

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }
  const body = raw as {
    clientId?: unknown;
    tier?: unknown;
    dailyQuota?: unknown;
    paymentVerified?: unknown;
    paymentAmount?: unknown;
  };

  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "Client ID required." }, { status: 400 });
  }

  const { data: clientRow, error: clientError } = await admin
    .from("profiles")
    .select("id, role, agency_name, subscription_tier")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) {
    return NextResponse.json({ ok: false, error: "Could not load client." }, { status: 500 });
  }
  if (!clientRow) {
    return NextResponse.json({ ok: false, error: "Client workspace not found." }, { status: 404 });
  }
  if ((clientRow as { role?: string }).role !== "client") {
    return NextResponse.json({ ok: false, error: "Target workspace must be a client." }, { status: 400 });
  }

  // Keep the existing plan when the caller only wants to change the quota
  // (e.g. pause), instead of silently downgrading it to Starter.
  const existingTier = (clientRow as { subscription_tier?: string }).subscription_tier;
  const tier = typeof body.tier === "string" && isSubscriptionTier(body.tier)
    ? body.tier
    : isSubscriptionTier(existingTier)
      ? existingTier
      : "Starter";
  const tierDefaults = SUBSCRIPTION_TIERS[tier];

  const rawQuota = Number(body.dailyQuota);
  const dailyQuota = Number.isFinite(rawQuota)
    ? Math.min(MAX_DAILY_QUOTA, Math.max(0, Math.trunc(rawQuota)))
    : tierDefaults.quota;

  const update: Record<string, unknown> = {
    subscription_tier: tier,
    daily_lead_quota: dailyQuota,
  };

  // Payment fields are only touched when the caller asks for it. The old route
  // stamped every activation (including "Pause") as a verified ₹14,500 payment.
  if (typeof body.paymentVerified === "boolean") {
    update.payment_verified = body.paymentVerified;
  }
  if (body.paymentVerified === true) {
    const amount = Number(body.paymentAmount);
    update.payment_amount = Number.isFinite(amount) && amount > 0
      ? Math.trunc(amount)
      : tierDefaults.price;
  }

  const { data: updatedProfile, error: updateError } = await admin
    .from("profiles")
    .update(update)
    .eq("id", clientId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ ok: false, error: "Could not update the workspace." }, { status: 500 });
  }

  const pause = dailyQuota === 0;
  const { error: logError } = await admin.from("activity_logs").insert({
    user_id: clientId,
    action: pause ? "tier_paused" : "tier_activated",
    title: pause ? "Workspace paused" : `Tier activated: ${tier}`,
    description: pause
      ? "Operator paused delivery for this workspace."
      : `Operator activated ${tier} with ${dailyQuota} leads/day.`,
    metadata: { tier, dailyQuota, activatedBy: user.email },
  });

  if (logError) {
    console.error("[tier-activate] activity log failed", logError.message);
  }

  const agencyName = (updatedProfile as { agency_name?: string }).agency_name ?? "workspace";

  return NextResponse.json({
    ok: true,
    message: pause
      ? `Paused delivery for ${agencyName}.`
      : `Activated ${tier} (${dailyQuota} leads/day) for ${agencyName}.`,
    profile: updatedProfile,
  });
}
