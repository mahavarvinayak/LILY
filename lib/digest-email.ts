import { env } from "@/lib/env";
import { escapeHtml, headerText } from "@/lib/html";
import { formatInr } from "@/lib/utils";

/**
 * Build one digest email. `agencyName` comes from a client-writable column, so
 * it is never trusted: the subject and text part get a single-line, control-
 * character-free version, and the HTML body gets that escaped again.
 */
export function buildDigestContent(
  type: "drop" | "nudge" | "wrap",
  agencyName: string,
  leadCount: number,
  pipelineValue: number,
) {
  const agency = headerText(agencyName, 80) || "your team";
  const agencyHtml = escapeHtml(agency);
  const pipeline = formatInr(pipelineValue, true);

  if (type === "drop") {
    return {
      subject: `⚡ [LILY] 08:00 AM Lead Drop: ${leadCount} Fresh Leads for ${agency}`,
      html: `<div style="font-family:sans-serif;max-width:560px;color:#18181b;line-height:1.6">
        <h2 style="color:#6C5CE7;margin-bottom:8px">⚡ Today's 08:00 AM Lead Drop is Live</h2>
        <p>Hi ${agencyHtml} Team,</p>
        <p><strong>${leadCount} verified B2B leads</strong> representing <strong>${pipeline}</strong> in pipeline value have landed in your LILY workspace.</p>
        <p>Each lead has a verified decision-maker trigger signal and pre-drafted pain-led pitch ready for your 1-click review.</p>
        <p style="margin-top:24px">
          <a href="${env.appUrl}/dashboard/opportunities" style="background:#6C5CE7;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block">Open Pipeline &amp; Review Leads</a>
        </p>
      </div>`,
      text: `Today's 08:00 AM Lead Drop is live for ${agency}.\n\n${leadCount} verified leads (${pipeline}) are ready in your workspace.\nOpen your pipeline: ${env.appUrl}/dashboard/opportunities`,
    };
  }

  if (type === "nudge") {
    return {
      subject: `🎯 [LILY] 01:00 PM Outreach Nudge: Pitches Waiting for Approval`,
      html: `<div style="font-family:sans-serif;max-width:560px;color:#18181b;line-height:1.6">
        <h2 style="color:#6C5CE7;margin-bottom:8px">🎯 01:00 PM Outreach Review Nudge</h2>
        <p>Hi ${agencyHtml} Team,</p>
        <p>Your team's AI-drafted pitches are waiting for human approval in the Outreach Studio.</p>
        <p>Review the 2-line personalized hooks and click <strong>Approve &amp; Send</strong> to dispatch outbound before the afternoon prospect response window closes.</p>
        <p style="margin-top:24px">
          <a href="${env.appUrl}/dashboard/opportunities" style="background:#6C5CE7;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block">Review &amp; Dispatch Pitches</a>
        </p>
      </div>`,
      text: `01:00 PM Outreach Review Nudge for ${agency}.\nPitches are waiting in Outreach Studio for review and dispatch.\nReview: ${env.appUrl}/dashboard/opportunities`,
    };
  }

  return {
    subject: `📊 [LILY] 06:00 PM Daily Wrap: Pipeline Status for ${agency}`,
    html: `<div style="font-family:sans-serif;max-width:560px;color:#18181b;line-height:1.6">
      <h2 style="color:#6C5CE7;margin-bottom:8px">📊 End of Day Pipeline Summary</h2>
      <p>Hi ${agencyHtml} Team,</p>
      <p>Here is your daily outbound summary for today.</p>
      <p>Total Pipeline Tracked: <strong>${pipeline}</strong></p>
      <p>Log in to your workspace to check active prospect replies and follow-up tasks for tomorrow morning.</p>
      <p style="margin-top:24px">
        <a href="${env.appUrl}/dashboard" style="background:#6C5CE7;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block">Open LILY Dashboard</a>
      </p>
    </div>`,
    text: `End of Day Pipeline Summary for ${agency}.\nTotal Pipeline: ${pipeline}.\nView: ${env.appUrl}/dashboard`,
  };
}
