import { NextResponse } from "next/server";
import { agentReply, generateDrafts, type DraftLead } from "@/lib/ai";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendSlackDigest } from "@/lib/slack";
import { checkRateLimit } from "@/lib/rate-limit";
import { ASSISTANT_SKILLS } from "@/lib/assistant-skills";
import type { AgentResult, OpportunityRecord, Profile } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AgentBody {
  input?: string;
  command?: string;
  modelPreference?: "glm-4.7-flash" | "glm-4.5-flash";
}

function toDraftLead(opportunity: OpportunityRecord): DraftLead {
  return {
    id: opportunity.id,
    company: opportunity.company?.name ?? "the company",
    person:
      [opportunity.person?.first_name, opportunity.person?.last_name].filter(Boolean).join(" ") ||
      "there",
    role: opportunity.person?.job_title ?? "decision-maker",
    trigger: opportunity.buying_trigger,
    dealName: opportunity.deal_name,
  };
}

function firstNameOf(value: string | null | undefined) {
  return value?.trim().split(/\s+/)[0] || "there";
}

function trimTrigger(value: string | null | undefined) {
  return (value ?? "the new signal")
    .replace(/\s*\((?:posted\s*)?\d+[dh]\s*ago\)$/i, "")
    .replace(/\s*\(.*?ago\)$/i, "")
    .trim();
}

function lowerFirst(value: string) {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

function heuristicReply(
  input: string,
  opportunities: OpportunityRecord[],
  pipelineValue: number,
) {
  const live = opportunities.filter((opportunity) => opportunity.stage !== "Lost");
  const lower = input.toLowerCase();

  const named = live.find((opportunity) => {
    const company = opportunity.company?.name?.toLowerCase();
    const person = [opportunity.person?.first_name, opportunity.person?.last_name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return Boolean((company && lower.includes(company)) || (person && lower.includes(person)));
  });
  const target = named ?? [...live].sort((a, b) => b.deal_value - a.deal_value)[0];
  const company = target?.company?.name ?? "your top account";
  const contact = firstNameOf(target?.person?.first_name);
  const trigger = trimTrigger(target?.buying_trigger);

  if (target && /objection|expensive|price|cost|budget|not interested|no time|think about/i.test(input)) {
    return `**Objection rebuttal — ${company}**\n\n“Fair — most teams at this stage say the same before they see the leak. You ${lowerFirst(trigger)}, so the cost of waiting is already compounding. Give me 12 minutes to map it; if there is no gap, you keep the call.”\n\nWant a shorter version for LinkedIn?`;
  }

  if (/cadence|follow.?up|sequence|touch|nurture/i.test(input)) {
    return `**3-touch cadence — ${company}**\n\n1. **Day 0** — ${contact}: short pain-led email referencing ${lowerFirst(trigger)}.\n2. **Day 3** — LinkedIn DM: one line on the same signal plus a question, no pitch.\n3. **Day 7** — Email: a specific proof point and a 12-minute ask; close the loop politely.\n\nKeep each touch under 50 words and stop on any reply.`;
  }

  if (target && /opener|pitch|draft|email|linkedin|dm|write/i.test(input)) {
    return `**${company} — 2-line opener**\n\n“${contact}, saw ${company} ${lowerFirst(trigger)} — usually the moment the current growth motion starts to lag the next hire. We map where the pipeline leaks before it gets expensive. Worth a 12-minute look?”\n\nThis draft was generated locally while the model quota resets — edit the signal line, then send.`;
  }

  if (/pipeline|stage|summary|how.*doing|revenue|forecast/i.test(input)) {
    const stageLine = live.reduce<Record<string, number>>((acc, opportunity) => {
      acc[opportunity.stage] = (acc[opportunity.stage] ?? 0) + 1;
      return acc;
    }, {});
    const stages = Object.entries(stageLine)
      .map(([stage, count]) => `${stage}: ${count}`)
      .join(" · ");
    return `**Pipeline snapshot**\n\n${live.length} live deals · ₹${(pipelineValue / 100000).toFixed(1)}L open value.\n\n${stages || "No released opportunities yet."}\n\nStart with ${company} at ₹${((target?.deal_value ?? 0) / 100000).toFixed(1)}L — the trigger is freshest.`;
  }

  const newLeads = opportunities.filter((opportunity) => opportunity.stage === "New Lead");
  if (newLeads.length === 0) {
    return `No unreleased drops are waiting. The next quota lands at 08:00 IST — meanwhile I can still draft against your ${live.length} live deals. Try “write an opener for ${company}”.`;
  }
  const hottest = [...newLeads].sort((a, b) => b.deal_value - a.deal_value)[0];
  return `${newLeads.length} new leads are live with ₹${(pipelineValue / 100000).toFixed(1)}L across the pipeline. Start with ${hottest?.company?.name ?? "the top lead"} at ${hottest ? `₹${(hottest.deal_value / 100000).toFixed(1)}L` : "high value"} — the trigger is fresh. I can draft all ${newLeads.length} pitches in one pass.`;
}

export async function POST(request: Request) {
  // Authorise before reading the body: an anonymous caller must not be able to
  // probe payload validation through status codes or error messages.
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Database service unavailable." }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Please sign in again." }, { status: 401 });
  }

  let body: AgentBody;
  try {
    body = (await request.json()) as AgentBody;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  const input = (body.input ?? "").trim();
  const command = body.command ?? (input.startsWith("/") ? input.split(/\s+/)[0] : undefined);
  if (!input && !command) {
    return NextResponse.json({ ok: false, message: "Say something first." }, { status: 400 });
  }

  if (input.length > 2000) {
    return NextResponse.json({ ok: false, message: "Input prompt is too long (maximum 2000 characters)." }, { status: 400 });
  }

  const userLimit = checkRateLimit(`agent:user:${user.id}`, 20, 60 * 1000);
  if (!userLimit.success) {
    return NextResponse.json(
      { ok: false, message: "Rate limit exceeded (20 prompts/minute). Please slow down." },
      { status: 429 },
    );
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileRow as Profile | null;
  if (!profile) {
    return NextResponse.json({ ok: false, message: "Profile missing." }, { status: 403 });
  }

  const { data } = await supabase
    .from("opportunities")
    .select("*, company:companies(*), person:people(*)")
    .eq("user_id", user.id)
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: false });

  const opportunities: OpportunityRecord[] = (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    return {
      ...record,
      deal_value: Number(record.deal_value ?? 0),
      company: record.company ?? null,
      person: record.person ?? null,
    } as OpportunityRecord;
  });

  const pipelineValue = opportunities
    .filter((opportunity) => opportunity.stage !== "Lost")
    .reduce((sum, opportunity) => sum + opportunity.deal_value, 0);

  const quota = profile.daily_lead_quota || 15;

  const isDraftCommand = command === "/draft-all" || /^\/draft\b/i.test(input) || /^draft\s+(all|pitches|leads)\b/i.test(input);
  const isSlackCommand = command === "/notify-slack" || /^\/slack\b/i.test(input) || /^(send|post)\s+(a\s+)?slack\s+(digest|update|alert)/i.test(input);
  const isReengageCommand = command === "/re-engage-all" || /^\/re-?engage-all\b/i.test(input) || /^re-?engage\s+stalled/i.test(input);

  if (isDraftCommand) {
    const newLeads = opportunities.filter((opportunity) => opportunity.stage === "New Lead").slice(0, quota);
    if (newLeads.length === 0) {
      const result: AgentResult = {
        ok: true,
        command: "draft-all",
        message: "Nothing new to draft. Today's drop is empty — the next quota unlocks at 08:00.",
        updated: 0,
        demo: false,
      };
      return NextResponse.json(result);
    }

    const started = Date.now();
    const drafts = await generateDrafts(newLeads.map(toDraftLead));

    const updates = await Promise.allSettled(
      drafts.map((draft) =>
        supabase
          .from("opportunities")
          .update({ ai_subject_line: draft.subject, ai_icebreaker: draft.body })
          .eq("id", draft.id)
          .eq("user_id", profile.id),
      ),
    );
    const successful = updates.filter((u) => u.status === "fulfilled").length;
    const result: AgentResult = {
      ok: true,
      command: "draft-all",
      message: `Drafted ${successful} personalized pitches in ${((Date.now() - started) / 1000).toFixed(1)}s. They are loaded in each lead's Outreach Studio.`,
      updated: successful,
      drafts,
      demo: false,
    };
    return NextResponse.json(result);
  }

  if (isSlackCommand) {
    const newLeads = opportunities.filter((opportunity) => opportunity.stage === "New Lead");
    const sent = await sendSlackDigest(profile.slack_webhook_url, {
      agencyName: profile.agency_name,
      quota,
      pipelineValue,
      leads: newLeads.slice(0, 8).map((opportunity) => ({
        company: opportunity.company?.name ?? "Unknown",
        person:
          [opportunity.person?.first_name, opportunity.person?.last_name]
            .filter(Boolean)
            .join(" ") || "Decision-maker",
        role: opportunity.person?.job_title ?? "—",
        trigger: opportunity.buying_trigger,
        value: opportunity.deal_value,
      })),
    });

    const result: AgentResult = {
      ok: true,
      command: "notify-slack",
      slackSent: sent,
      demo: false,
      message: sent
        ? `Digest sent to Slack: ${newLeads.length} leads, ₹${(pipelineValue / 100000).toFixed(1)}L pipeline.`
        : "No Slack webhook is connected yet. Add one in Settings → Alerts and run this again.",
    };
    return NextResponse.json(result);
  }

  if (isReengageCommand) {
    const stalled = opportunities
      .filter(
        (opportunity) =>
          ["Screening", "Proposal", "Meeting"].includes(opportunity.stage) &&
          !opportunity.outreach_dispatched,
      )
      .slice(0, 8);
    if (stalled.length === 0) {
      return NextResponse.json({
        ok: true,
        command: "re-engage",
        message: "No stalled opportunities without outreach. The pipeline is already moving.",
        updated: 0,
        demo: false,
      } satisfies AgentResult);
    }
    const drafts = await generateDrafts(stalled.map(toDraftLead));
    const updates = await Promise.allSettled(
      drafts.map((draft) =>
        supabase
          .from("opportunities")
          .update({ ai_subject_line: draft.subject, ai_icebreaker: draft.body })
          .eq("id", draft.id)
          .eq("user_id", profile.id),
      ),
    );
    const successful = updates.filter((u) => u.status === "fulfilled").length;
    return NextResponse.json({
      ok: true,
      command: "re-engage",
      message: `Re-engagement drafts ready for ${successful} stalled opportunities. Review them before sending.`,
      updated: successful,
      drafts,
      demo: false,
    } satisfies AgentResult);
  }

  const rawCmd = (command || (input.startsWith("/") ? input.split(/\s+/)[0] : "")).toLowerCase();
  const matchedSkill = ASSISTANT_SKILLS.find(
    (s) => s.command.toLowerCase() === rawCmd || s.id.toLowerCase() === rawCmd.replace(/^\//, ""),
  );

  if (matchedSkill) {
    const query = input.replace(new RegExp(`^${rawCmd}\\s*`, "i"), "").trim();
    const resultText = matchedSkill.run({
      query,
      agencyName: profile.agency_name,
      targetOpp: null,
      allOpps: opportunities,
      pipelineValue,
    });
    return NextResponse.json({
      ok: true,
      command: matchedSkill.id,
      message: resultText,
      demo: false,
    } satisfies AgentResult);
  }

  if (command === "/filter" || /^\/filter\b/i.test(input)) {
    const keyword = input.replace(/^\/filter\s*/i, "").trim();
    return NextResponse.json({
      ok: true,
      command: "filter",
      filter: keyword,
      message: keyword
        ? `Filtering the workspace for “${keyword}”.`
        : "Give me a keyword — a company, a trigger, or a stage.",
      demo: false,
    } satisfies AgentResult);
  }

  if (command === "/help" || input === "/help") {
    const skillList = ASSISTANT_SKILLS.map((s) => `• \`${s.command}\` — ${s.name}: ${s.description}`).join("\n");
    return NextResponse.json({
      ok: true,
      message: `### LILY Intelligence Outbound Skills & Slash Commands\n\n${skillList}\n\n• \`/draft-all\` — Bulk draft pitches for today's drop\n• \`/notify-slack\` — Post morning drop to Slack\n• \`/filter <query>\` — Filter live pipeline`,
      demo: false,
    } satisfies AgentResult);
  }

  const ai = await agentReply(
    input,
    {
      agencyName: profile.agency_name,
      newLeads: opportunities.filter((opportunity) => opportunity.stage === "New Lead").length,
      pipelineValue,
      stages: opportunities.reduce<Record<string, number>>((acc, opportunity) => {
        acc[opportunity.stage] = (acc[opportunity.stage] ?? 0) + 1;
        return acc;
      }, {}),
    },
    body.modelPreference,
  );

  return NextResponse.json({
    ok: true,
    message: ai?.message ?? heuristicReply(input, opportunities, pipelineValue),
    filter: ai?.filter,
    demo: false,
  } satisfies AgentResult);
}
