import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Database service unavailable." }, { status: 500 });
    }

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Admin client unconfigured." }, { status: 500 });
    }

    const { error } = await admin
      .from("workspace_mailboxes")
      .delete()
      .eq("user_id", authUser.id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Custom SMTP mailbox disconnected." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to disconnect SMTP mailbox.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
