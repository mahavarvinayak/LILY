import { extractLeadIntelligence, type LeadIntelligence31 } from "@/lib/intelligence";
import type { OpportunityRecord, Company, Person } from "@/lib/types";

function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '""';
  if (Array.isArray(val)) {
    return `"${val.join("; ").replace(/"/g, '""')}"`;
  }
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
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
    "01_company_name",
    "02_website",
    "03_company_linkedin_url",
    "04_headquarters",
    "05_employee_count",
    "06_industry_niche",
    "07_value_proposition",
    "08_contact_name",
    "09_job_title",
    "10_linkedin_url",
    "11_tenure_at_company",
    "12_follower_count",
    "13_work_email",
    "14_secondary_contact_name",
    "15_secondary_contact_title",
    "16_secondary_linkedin_url",
    "17_tertiary_contact_name",
    "18_tertiary_contact_title",
    "19_tertiary_linkedin_url",
    "20_buying_trigger",
    "21_trigger_age",
    "22_trigger_url",
    "23_intent_level",
    "24_recent_company_news",
    "25_website_tech_stack",
    "26_required_engineering_stack",
    "27_recent_founder_activity",
    "28_ai_icebreaker",
    "29_email_subject_line",
    "30_verification_status",
    "31_source_attribution",
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
      escapeCsvValue(intel.ai_icebreaker),
      escapeCsvValue(intel.email_subject_line),
      escapeCsvValue(intel.verification_status),
      escapeCsvValue(intel.source_attribution),
    ];
    rows.push(row.join(","));
  }

  const csvContent = "\uFEFF" + rows.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().split("T")[0];
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
