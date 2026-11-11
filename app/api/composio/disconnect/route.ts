import { NextResponse } from "next/server";
import { disconnectMailbox, getConnectedMailboxes } from "@/lib/composio";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Database service unavailable." }, { status: 500 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const { id } = (await request.json()) as { id?: string };
    if (!id) {
      return NextResponse.json({ ok: false, error: "Account ID is required." }, { status: 400 });
    }

    const userMailboxes = await getConnectedMailboxes(user.id);
    const isOwner = userMailboxes.some((m) => m.id === id);
    if (!isOwner) {
      return NextResponse.json(
        { ok: false, error: "You do not have permission to disconnect this account." },
        { status: 403 },
      );
    }

    const result = await disconnectMailbox(id);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error || "Failed to disconnect." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Disconnected successfully." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to disconnect account.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
