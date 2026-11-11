import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch {}

  const response = NextResponse.json({ ok: true, message: "Logged out successfully." });
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  for (const c of allCookies) {
    if (c.name.startsWith("sb-") || c.name.startsWith("lily_")) {
      response.cookies.set(c.name, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
      });
    }
  }

  return response;
}
