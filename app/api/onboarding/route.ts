import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ClientIcpConfig } from "@/lib/icp";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Database unavailable." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const serviceOffer = String(body.service_offer || "").trim();
  const targetGeography = String(body.target_geography || "").trim();
  const targetIndustry = String(body.target_industry || "").trim();
  const companySize = String(body.company_size || "").trim();
  const decisionMakers = String(body.decision_makers || "").trim();
  const buyingTrigger = String(body.buying_trigger || "").trim();
  const negativeFilters = String(body.negative_filters || "").trim();

  if (!serviceOffer) {
    return NextResponse.json({ ok: false, error: "Please describe your core service or offer." }, { status: 400 });
  }
  if (!targetGeography) {
    return NextResponse.json({ ok: false, error: "Please specify target buyer geographies." }, { status: 400 });
  }
  if (!targetIndustry) {
    return NextResponse.json({ ok: false, error: "Please specify target industry sectors." }, { status: 400 });
  }
  if (!companySize) {
    return NextResponse.json({ ok: false, error: "Please select target company headcount range." }, { status: 400 });
  }
  if (!decisionMakers) {
    return NextResponse.json({ ok: false, error: "Please specify target decision-maker titles." }, { status: 400 });
  }
  if (!buyingTrigger) {
    return NextResponse.json({ ok: false, error: "Please describe the active buying trigger." }, { status: 400 });
  }
  if (!negativeFilters) {
    return NextResponse.json({ ok: false, error: "Please specify negative filters or exclusions." }, { status: 400 });
  }

  const icpPayload: ClientIcpConfig = {
    service_offer: serviceOffer,
    target_geography: targetGeography,
    target_industry: targetIndustry,
    company_size: companySize,
    decision_makers: decisionMakers,
    buying_trigger: buyingTrigger,
    negative_filters: negativeFilters,
    completed_at: new Date().toISOString(),
    completed: true,
  };

  const { error } = await supabase
    .from("profiles")
    .update({ target_niche: JSON.stringify(icpPayload) })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, icp: icpPayload });
}

