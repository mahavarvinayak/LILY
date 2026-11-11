import { NextResponse } from "next/server";
import { getConnectedMailboxes, type ConnectedMailbox } from "@/lib/composio";
import { isDemoMode, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let entityId = "agency-primary-workspace";
  let customSmtpMailbox: ConnectedMailbox | null = null;

  if (!isDemoMode()) {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Workspace database is not configured on this deployment." },
        { status: 503 },
      );
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Database unavailable." }, { status: 500 });
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Please sign in again." }, { status: 401 });
    }
    entityId = user.id;

    const admin = createSupabaseAdminClient();
    if (admin) {
      const { data: mailbox } = await admin
        .from("workspace_mailboxes")
        .select("id, provider, sender_name, sender_email, smtp_host, status, created_at")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (mailbox) {
        customSmtpMailbox = {
          id: mailbox.id,
          provider: "custom_smtp",
          appName: `Universal Custom SMTP (${mailbox.smtp_host})`,
          email: mailbox.sender_email,
          status: "active",
          connectedAt: mailbox.created_at,
        };
      }
    }
  }

  const composioMailboxes = await getConnectedMailboxes(entityId);
  const allMailboxes = customSmtpMailbox
    ? [customSmtpMailbox, ...composioMailboxes]
    : composioMailboxes;

  return NextResponse.json({
    ok: true,
    mailboxes: allMailboxes,
    primary: allMailboxes.find((m) => m.status === "active") || null,
  });
}
