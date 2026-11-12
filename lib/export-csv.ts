import { extractLeadIntelligence, type LeadIntelligence31 } from "@/lib/intelligence";
import type { OpportunityRecord, Company, Person } from "@/lib/types";

function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '""';

  const raw = Array.isArray(val) ? val.join("; ") : String(val);

  // CSV formula injection: Excel/Sheets evaluate a cell that starts with
  // =, +, -, @, tab or CR. Every exported field is scraped/third-party text.
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function export31FieldsToCsv(
  items: Array<{
    opp?: OpportunityRecord | null;
    company?: Company | null;
    person?: Person | null;
  }>,
  filenamePrefix = "lily_verified_intelligence",
) {
  const headers = [
    "Company Name",
    "Website",
    "Company LinkedIn",
    "Headquarters",
    "Employee Count",
    "Industry / Niche",
    "Value Proposition",
    "Primary Contact",
    "Job Title",
    "LinkedIn Profile",
    "Tenure at Company",
    "Follower Count",
    "Work Email",
    "Secondary Contact Name",
    "Secondary Contact Title",
    "Secondary LinkedIn URL",
    "Tertiary Contact Name",
    "Tertiary Contact Title",
    "Tertiary LinkedIn URL",
    "Buying Signal / Trigger",
    "Signal Age",
    "Trigger Source URL",
    "Intent Level",
    "Recent Company News",
    "Website Tech Stack",
    "Required Engineering Stack",
    "Recent Founder Activity",
    "LinkedIn Connection Angle",
    "Cold Outreach Subject",
    "Cold Outreach Body",
    "Verification Status",
    "Source Attribution",
  ];

  const rows: string[] = [headers.join(",")];

  for (const item of items) {
    let intel: LeadIntelligence31;
    if (item.opp) {
      intel = extractLeadIntelligence(item.opp, item.company, item.person);
    } else {
      const dummyOpp: OpportunityRecord = {
        id: "",
        user_id: "",
        company_id: item.company?.id ?? null,
        person_id: item.person?.id ?? null,
        deal_name: item.company?.name ?? "",
        deal_value: 0,
        stage: "New Lead",
        buying_trigger: "",
        trigger_url: null,
        ai_subject_line: null,
        ai_icebreaker: null,
        scheduled_at: new Date().toISOString(),
        outreach_dispatched: false,
        notes: null,
        created_at: new Date().toISOString(),
        company: item.company || null,
        person: item.person || null,
      };
      intel = extractLeadIntelligence(
        dummyOpp,
        item.company,
        item.person,
      );
    }

    const row = [
      escapeCsvValue(intel.company_name),
      escapeCsvValue(intel.website),
      escapeCsvValue(intel.company_linkedin_url),
      escapeCsvValue(intel.headquarters),
      escapeCsvValue(intel.employee_count),
      escapeCsvValue(intel.industry_niche),
      escapeCsvValue(intel.value_proposition),
      escapeCsvValue(intel.contact_name),
      escapeCsvValue(intel.job_title),
      escapeCsvValue(intel.linkedin_url),
      escapeCsvValue(intel.tenure_at_company),
      escapeCsvValue(intel.follower_count),
      escapeCsvValue(intel.work_email),
      escapeCsvValue(intel.secondary_contact_name),
      escapeCsvValue(intel.secondary_contact_title),
      escapeCsvValue(intel.secondary_linkedin_url),
      escapeCsvValue(intel.tertiary_contact_name),
      escapeCsvValue(intel.tertiary_contact_title),
      escapeCsvValue(intel.tertiary_linkedin_url),
      escapeCsvValue(intel.buying_trigger),
      escapeCsvValue(intel.trigger_age),
      escapeCsvValue(intel.trigger_url),
      escapeCsvValue(intel.intent_level),
      escapeCsvValue(intel.recent_company_news),
      escapeCsvValue(intel.website_tech_stack),
      escapeCsvValue(intel.required_engineering_stack),
      escapeCsvValue(intel.recent_founder_activity),
      escapeCsvValue(intel.linkedin_note),
      escapeCsvValue(intel.email_subject_line),
      escapeCsvValue(intel.ai_icebreaker),
      escapeCsvValue(intel.verification_status),
      escapeCsvValue(intel.source_attribution),
    ];
    rows.push(row.join(","));
  }

  const csvContent = "\uFEFF" + rows.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  // Stamp the filename in the business timezone, not UTC: before 05:30 IST a
  // UTC date is still "yesterday" and two same-morning exports collide.
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
