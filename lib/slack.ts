import { env } from "@/lib/env";
import { formatInr } from "@/lib/utils";

export interface SlackLead {
  company: string;
  person: string;
  role: string;
  trigger: string;
  value: number;
}

/**
 * Slack mrkdwn treats &, < and > as control characters, so lead fields written
 * by users must be escaped or they can break the message (or inject a link /
 * mention). Escape & first, otherwise the later replacements get double-escaped.
 */
function escapeMrkdwn(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendSlackDigest(
  webhookUrl: string | null | undefined,
  payload: { agencyName: string; leads: SlackLead[]; pipelineValue: number; quota: number },
): Promise<boolean> {
  const url = webhookUrl?.trim();
  if (!url || !url.startsWith("https://hooks.slack.com/services/")) return false;

  const total = payload.leads.reduce((sum, lead) => sum + lead.value, 0);
  const lines = payload.leads.slice(0, 6).map(
    (lead) =>
      `• *${escapeMrkdwn(lead.company)}* — ${escapeMrkdwn(lead.person)}, ${escapeMrkdwn(lead.role)}\n   _⚡ ${escapeMrkdwn(lead.trigger)}_ · ${formatInr(lead.value, true)}`,
  );

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "⚡ LILY // 08:00 drop", emoji: true },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `${escapeMrkdwn(payload.agencyName)} · ${payload.quota}-lead quota · *${formatInr(total, true)}* new pipeline`,
        },
      ],
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: lines.join("\n") || "_No leads released in this drop._",
      },
    },
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open workspace", emoji: false },
          url: `${env.appUrl}/dashboard/opportunities`,
          style: "primary",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Draft pitches", emoji: false },
          url: `${env.appUrl}/dashboard/opportunities`,
        },
      ],
    },
  ];

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `LILY drop for ${escapeMrkdwn(payload.agencyName)}: ${payload.leads.length} new leads, ${formatInr(total, true)} pipeline.`,
        blocks,
      }),
      signal: AbortSignal.timeout(12000),
    });

    return response.ok;
  } catch {
    return false;
  }
}
