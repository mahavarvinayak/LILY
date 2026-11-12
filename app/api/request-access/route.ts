import { NextResponse } from "next/server";
import { Resend } from "resend";
import { env, isResendConfigured } from "@/lib/env";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_LEN = {
  fullName: 120,
  workEmail: 254,
  phone: 32,
  agencyName: 120,
  agencyWebsite: 300,
  linkedinUrl: 300,
  targetNiche: 200,
  targetRoles: 200,
  targetGeography: 200,
  coreOffer: 600,
  notes: 2000,
} as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/**
 * Every interpolated value lands in an HTML email, so it must be escaped or a
 * visitor can inject markup/links into a message we send to ourselves.
 */
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only http(s) links are rendered as anchors; anything else is dropped. */
function safeUrl(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Single-line field: collapse newlines so they cannot forge email headers. */
function headerText(value: unknown, maxLength: number): string {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function field(body: Record<string, unknown>, key: keyof typeof MAX_LEN): string {
  const value = body[key];
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_LEN[key]);
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`request-access:${ip}`, 5, 10 * 60 * 1000);
    if (!limit.success) {
      return NextResponse.json(
        { ok: false, message: "Too many submissions. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limit.resetMs / 1000)) } },
      );
    }

    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json(
        { ok: false, message: "Invalid request body." },
        { status: 400 },
      );
    }
    const body = raw as Record<string, unknown>;

    const fullName = field(body, "fullName");
    const workEmail = field(body, "workEmail");
    const phone = field(body, "phone");
    const agencyName = field(body, "agencyName");
    const agencyWebsite = field(body, "agencyWebsite");
    const linkedinUrl = field(body, "linkedinUrl");
    const targetNiche = field(body, "targetNiche");
    const targetRoles = field(body, "targetRoles");
    const targetGeography = field(body, "targetGeography");
    const coreOffer = field(body, "coreOffer");
    const notes = field(body, "notes");
    const selectedPlan = body.selectedPlan;

    if (!fullName || !workEmail || !phone || !agencyName) {
      return NextResponse.json(
        { ok: false, message: "Missing required contact fields." },
        { status: 400 },
      );
    }

    if (!EMAIL_REGEX.test(workEmail)) {
      return NextResponse.json(
        { ok: false, message: "Enter a valid work email address." },
        { status: 400 },
      );
    }

    if (!isResendConfigured()) {
      // Fail closed: silently accepting a brief we cannot deliver loses the lead.
      return NextResponse.json(
        { ok: false, message: "Email delivery is not configured. Please email hello@thepilab.in directly." },
        { status: 503 },
      );
    }

    const planLabel =
      selectedPlan === "scale"
        ? "Scale (₹45,000/mo · 30 leads/day)"
        : selectedPlan === "starter"
          ? "Starter (₹14,000/mo · 5 leads/day)"
          : "Growth (₹29,000/mo · 15 leads/day · Primary)";
    const planTag = planLabel.split(" ")[0] ?? "GROWTH";

    const resend = new Resend(env.resendApiKey);
    const fromEmail = env.resendFromEmail || "LILY <hello@thepilab.in>";

    const websiteHref = safeUrl(agencyWebsite);
    const linkedinHref = safeUrl(linkedinUrl);
    const whatsappNumber = phone.replace(/[^0-9]/g, "").slice(0, 15);

    const internal = await resend.emails.send({
      from: fromEmail,
      to: ["hello@thepilab.in"],
      cc: ["vinayakmahavar95@gmail.com"],
      replyTo: workEmail,
      subject: headerText(
        `[LILY Inbound Lead] ${agencyName} (${fullName}) · ${planTag.toUpperCase()}`,
        200,
      ),
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; color: #111; background-color: #fafafa; border-radius: 8px;">
          <div style="background-color: #0b0f0e; padding: 20px; border-radius: 6px; color: #fff;">
            <p style="text-transform: uppercase; letter-spacing: 0.15em; font-size: 11px; color: #10b981; margin: 0 0 6px 0; font-weight: 700;">New LILY Client Brief</p>
            <h1 style="margin: 0; font-size: 20px; font-weight: 600;">${escapeHtml(agencyName)}</h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #a1a1aa;">Selected Tier: <strong style="color: #fff;">${escapeHtml(planLabel)}</strong></p>
          </div>

          <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e4e4e7; border-radius: 6px; margin-top: 16px;">
            <h2 style="font-size: 14px; text-transform: uppercase; color: #71717a; margin-top: 0; margin-bottom: 12px; letter-spacing: 0.05em;">Contact Information</h2>
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #71717a; width: 140px;">Founder / Lead:</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(fullName)}</td></tr>
              <tr><td style="padding: 6px 0; color: #71717a;">Work Email:</td><td style="padding: 6px 0;"><a href="mailto:${escapeHtml(encodeURIComponent(workEmail))}">${escapeHtml(workEmail)}</a></td></tr>
              <tr><td style="padding: 6px 0; color: #71717a;">Phone / WhatsApp:</td><td style="padding: 6px 0; font-weight: 600;"><a href="https://wa.me/${escapeHtml(whatsappNumber)}">${escapeHtml(phone)}</a></td></tr>
              <tr><td style="padding: 6px 0; color: #71717a;">LinkedIn Profile:</td><td style="padding: 6px 0;">${
                linkedinHref
                  ? `<a href="${escapeHtml(linkedinHref)}">${escapeHtml(linkedinUrl)}</a>`
                  : "Not provided"
              }</td></tr>
              <tr><td style="padding: 6px 0; color: #71717a;">Agency Website:</td><td style="padding: 6px 0;">${
                websiteHref
                  ? `<a href="${escapeHtml(websiteHref)}">${escapeHtml(agencyWebsite)}</a>`
                  : "Not provided"
              }</td></tr>
            </table>
          </div>

          <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e4e4e7; border-radius: 6px; margin-top: 16px;">
            <h2 style="font-size: 14px; text-transform: uppercase; color: #71717a; margin-top: 0; margin-bottom: 12px; letter-spacing: 0.05em;">Pipeline &amp; Targeting Requirements</h2>
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #71717a; width: 140px;">Target Niche:</td><td style="padding: 6px 0; font-weight: 500;">${escapeHtml(targetNiche || "Any high-growth vertical")}</td></tr>
              <tr><td style="padding: 6px 0; color: #71717a;">Decision Makers:</td><td style="padding: 6px 0; font-weight: 500;">${escapeHtml(targetRoles || "Founders / C-Suite")}</td></tr>
              <tr><td style="padding: 6px 0; color: #71717a;">Target Geography:</td><td style="padding: 6px 0; font-weight: 500;">${escapeHtml(targetGeography || "US / Global")}</td></tr>
              <tr><td style="padding: 6px 0; color: #71717a;">Core Value Prop:</td><td style="padding: 6px 0;">${escapeHtml(coreOffer || "Not stated")}</td></tr>
            </table>
          </div>

          ${
            notes
              ? `
          <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e4e4e7; border-radius: 6px; margin-top: 16px;">
            <h2 style="font-size: 14px; text-transform: uppercase; color: #71717a; margin-top: 0; margin-bottom: 8px;">Specific Notes / Requirements</h2>
            <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #27272a; white-space: pre-wrap;">${escapeHtml(notes)}</p>
          </div>
          `
              : ""
          }

          <div style="margin-top: 24px; text-align: center; font-size: 12px; color: #a1a1aa;">
            Dispatched automatically by LILY Inbound Gateway · THE Π LAB
          </div>
        </div>
      `,
    });

    if (internal.error) {
      console.error("[request-access] internal notification failed", internal.error.message);
      return NextResponse.json(
        { ok: false, message: "We could not deliver your brief. Please email hello@thepilab.in." },
        { status: 502 },
      );
    }

    const firstName = fullName.split(/\s+/)[0] ?? "there";

    // The acknowledgement is best-effort: the brief already reached us.
    const acknowledgement = await resend.emails.send({
      from: fromEmail,
      to: [workEmail],
      subject: "Your LILY Pipeline Brief Received · THE Π LAB",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
          <p style="font-size: 16px; line-height: 1.5;">Hi ${escapeHtml(firstName)},</p>
          <p style="font-size: 14px; line-height: 1.6; color: #374151;">
            Thank you for sharing your agency requirements for <strong>${escapeHtml(agencyName)}</strong>.
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #374151;">
            We have received your request for the <strong>${escapeHtml(planLabel)}</strong>. Vinayak Mahavar from THE Π LAB is reviewing your targeting parameters right now.
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #374151;">
            We will reach out via WhatsApp at <strong>${escapeHtml(phone)}</strong> or direct email within 2 hours to confirm your custom signal feed.
          </p>
          <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">
            <strong>Vinayak Mahavar</strong><br />
            Founder, THE Π LAB<br />
            <a href="https://linkedin.com/in/vinayak-mahavar-095593258" style="color: #0284c7;">Connect on LinkedIn</a> · <a href="mailto:hello@thepilab.in" style="color: #0284c7;">hello@thepilab.in</a>
          </div>
        </div>
      `,
    });

    if (acknowledgement.error) {
      console.error("[request-access] acknowledgement failed", acknowledgement.error.message);
    }

    return NextResponse.json({
      ok: true,
      message: "Brief received successfully.",
    });
  } catch (err) {
    console.error("[request-access] submission error", err);
    return NextResponse.json(
      { ok: false, message: "Submission error. Please try again." },
      { status: 500 },
    );
  }
}
