import { NextResponse } from "next/server";
import { initiateMailboxOAuth } from "@/lib/composio";
import { env, isDemoMode, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { provider?: "gmail" | "outlook" | "googlecalendar" } = {};
  try {
    body = (await request.json()) as { provider?: "gmail" | "outlook" | "googlecalendar" };
  } catch {}

  const provider =
    body.provider === "outlook"
      ? "outlook"
      : body.provider === "googlecalendar"
        ? "googlecalendar"
        : "gmail";
  let entityId = "agency-primary-workspace";

  if (!isDemoMode()) {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Workspace database is not configured on this deployment." },
        { status: 503 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
    if (!user) {
      return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
    }
    entityId = user.id;
  }

  const redirectUri = `${env.appUrl}/dashboard/connectors?composio_connected=true`;
  const result = await initiateMailboxOAuth(entityId, provider, redirectUri);

  return NextResponse.json(result);
}
