import { NextResponse } from "next/server";
import { Resend } from "resend";
import { env, isResendConfigured } from "@/lib/env";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      fullName,
      workEmail,
      phone,
      agencyName,
      agencyWebsite,
      linkedinUrl,
      selectedPlan,
      targetNiche,
      targetRoles,
      targetGeography,
      coreOffer,
      notes,
    } = body;

    if (!fullName || !workEmail || !phone || !agencyName) {
      return NextResponse.json(
        { ok: false, message: "Missing required contact fields." },
        { status: 400 },
      );
    }

    const planLabel =
      selectedPlan === "scale"
        ? "Scale (₹45,000/mo · 30 leads/day)"
        : selectedPlan === "starter"
          ? "Starter (₹14,000/mo · 5 leads/day)"
          : "Growth (₹29,000/mo · 15 leads/day · Primary)";

    if (isResendConfigured()) {
      const resend = new Resend(env.resendApiKey);
      const fromEmail = env.resendFromEmail || "LILY <hello@thepilab.in>";

      await resend.emails.send({
        from: fromEmail,
        to: ["hello@thepilab.in"],
        cc: ["vinayakmahavar95@gmail.com"],
        replyTo: workEmail,
        subject: `[LILY Inbound Lead] ${agencyName} (${fullName}) · ${selectedPlan?.toUpperCase() || "GROWTH"}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; color: #111; background-color: #fafafa; border-radius: 8px;">
            <div style="background-color: #0b0f0e; padding: 20px; border-radius: 6px; color: #fff;">
              <p style="text-transform: uppercase; letter-spacing: 0.15em; font-size: 11px; color: #10b981; margin: 0 0 6px 0; font-weight: 700;">New LILY Client Brief</p>
              <h1 style="margin: 0; font-size: 20px; font-weight: 600;">${agencyName}</h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #a1a1aa;">Selected Tier: <strong style="color: #fff;">${planLabel}</strong></p>
            </div>

            <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e4e4e7; border-radius: 6px; margin-top: 16px;">
              <h2 style="font-size: 14px; text-transform: uppercase; color: #71717a; margin-top: 0; margin-bottom: 12px; letter-spacing: 0.05em;">Contact Information</h2>
              <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; color: #71717a; width: 140px;">Founder / Lead:</td><td style="padding: 6px 0; font-weight: 600;">${fullName}</td></tr>
                <tr><td style="padding: 6px 0; color: #71717a;">Work Email:</td><td style="padding: 6px 0;"><a href="mailto:${workEmail}">${workEmail}</a></td></tr>
                <tr><td style="padding: 6px 0; color: #71717a;">Phone / WhatsApp:</td><td style="padding: 6px 0; font-weight: 600;"><a href="https://wa.me/${phone.replace(/[^0-9]/g, "")}">${phone}</a></td></tr>
                <tr><td style="padding: 6px 0; color: #71717a;">LinkedIn Profile:</td><td style="padding: 6px 0;"><a href="${linkedinUrl || "#"}">${linkedinUrl || "Not provided"}</a></td></tr>
                <tr><td style="padding: 6px 0; color: #71717a;">Agency Website:</td><td style="padding: 6px 0;"><a href="${agencyWebsite || "#"}">${agencyWebsite || "Not provided"}</a></td></tr>
              </table>
            </div>

            <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e4e4e7; border-radius: 6px; margin-top: 16px;">
              <h2 style="font-size: 14px; text-transform: uppercase; color: #71717a; margin-top: 0; margin-bottom: 12px; letter-spacing: 0.05em;">Pipeline & Targeting Requirements</h2>
              <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; color: #71717a; width: 140px;">Target Niche:</td><td style="padding: 6px 0; font-weight: 500;">${targetNiche || "Any high-growth vertical"}</td></tr>
                <tr><td style="padding: 6px 0; color: #71717a;">Decision Makers:</td><td style="padding: 6px 0; font-weight: 500;">${targetRoles || "Founders / C-Suite"}</td></tr>
                <tr><td style="padding: 6px 0; color: #71717a;">Target Geography:</td><td style="padding: 6px 0; font-weight: 500;">${targetGeography || "US / Global"}</td></tr>
                <tr><td style="padding: 6px 0; color: #71717a;">Core Value Prop:</td><td style="padding: 6px 0;">${coreOffer || "Not stated"}</td></tr>
              </table>
            </div>

            ${
              notes
                ? `
            <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e4e4e7; border-radius: 6px; margin-top: 16px;">
              <h2 style="font-size: 14px; text-transform: uppercase; color: #71717a; margin-top: 0; margin-bottom: 8px;">Specific Notes / Requirements</h2>
              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #27272a;">${notes}</p>
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

      await resend.emails.send({
        from: fromEmail,
        to: [workEmail],
        subject: `Your LILY Pipeline Brief Received · THE Π LAB`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
            <p style="font-size: 16px; line-height: 1.5;">Hi ${fullName.split(" ")[0]},</p>
            <p style="font-size: 14px; line-height: 1.6; color: #374151;">
              Thank you for sharing your agency requirements for <strong>${agencyName}</strong>.
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #374151;">
              We have received your request for the <strong>${planLabel}</strong>. Vinayak Mahavar from THE Π LAB is reviewing your targeting parameters right now.
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #374151;">
              We will reach out via WhatsApp at <strong>${phone}</strong> or direct email within 2 hours to confirm your custom signal feed.
            </p>
            <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">
              <strong>Vinayak Mahavar</strong><br />
              Founder, THE Π LAB<br />
              <a href="https://linkedin.com/in/vinayak-mahavar-095593258" style="color: #0284c7;">Connect on LinkedIn</a> · <a href="mailto:hello@thepilab.in" style="color: #0284c7;">hello@thepilab.in</a>
            </div>
          </div>
        `,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Brief received successfully.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Submission error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

