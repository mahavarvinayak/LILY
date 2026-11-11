import type { OpportunityRecord, Company, Person } from "@/lib/types";

export interface LeadIntelligence24 {
  company_name: string;
  website: string;
  headquarters: string;
  employee_count: string;
  industry_niche: string;
  value_proposition: string;
  contact_name: string;
  contact_title: string;
  linkedin_url: string;
  tenure_at_company: string;
  follower_count: string;
  work_email: string;
  buying_trigger: string;
  trigger_age: string;
  trigger_url: string;
  intent_level: string;
  recent_company_news: string;
  website_tech_stack: string[];
  required_engineering_stack: string[];
  recent_founder_activity: string;
  ai_icebreaker: string;
  email_subject_line: string;
  verification_status: string;
  source_attribution: string;
}

export function parseJsonNotes(notes: string | null | undefined): Partial<LeadIntelligence24> {
  if (!notes) return {};
  try {
    const trimmed = notes.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return JSON.parse(trimmed) as Partial<LeadIntelligence24>;
    }
  } catch {}
  return {};
}

export function extractLeadIntelligence(
  opp: OpportunityRecord,
  fallbackCompany?: Company | null,
  fallbackPerson?: Person | null,
): LeadIntelligence24 {
  const company = opp.company || fallbackCompany;
  const person = opp.person || fallbackPerson;
  const jsonMeta = parseJsonNotes(opp.notes);

  const rawPersonName = person
    ? `${person.first_name} ${person.last_name || ""}`.trim()
    : "";

  const companyName =
    company?.name ||
    jsonMeta.company_name ||
    opp.deal_name?.split("—")[0]?.trim() ||
    "Organization";

  const website =
    company?.website ||
    (company?.domain ? `https://${company.domain}` : "") ||
    jsonMeta.website ||
    "";

  const contactName =
    rawPersonName ||
    jsonMeta.contact_name ||
    "Decision Maker";

  const contactTitle =
    person?.job_title ||
    jsonMeta.contact_title ||
    "Leadership";

  const workEmail =
    person?.email ||
    jsonMeta.work_email ||
    "";

  const linkedinUrl =
    person?.linkedin_url ||
    jsonMeta.linkedin_url ||
    "";

  const buyingTrigger =
    opp.buying_trigger ||
    jsonMeta.buying_trigger ||
    "";

  const triggerUrl =
    opp.trigger_url ||
    jsonMeta.trigger_url ||
    "";

  const aiIcebreaker =
    opp.ai_icebreaker ||
    jsonMeta.ai_icebreaker ||
    "";

  const emailSubjectLine =
    opp.ai_subject_line ||
    jsonMeta.email_subject_line ||
    `Regarding ${companyName}`;

  return {
    company_name: companyName,
    website,
    headquarters:
      company?.location ||
      jsonMeta.headquarters ||
      "",
    employee_count:
      jsonMeta.employee_count ||
      "",
    industry_niche:
      jsonMeta.industry_niche ||
      "",
    value_proposition:
      jsonMeta.value_proposition ||
      "",
    contact_name: contactName,
    contact_title: contactTitle,
    linkedin_url: linkedinUrl,
    tenure_at_company:
      jsonMeta.tenure_at_company ||
      "",
    follower_count:
      jsonMeta.follower_count ||
      "",
    work_email: workEmail,
    buying_trigger: buyingTrigger,
    trigger_age:
      jsonMeta.trigger_age ||
      "",
    trigger_url: triggerUrl,
    intent_level:
      jsonMeta.intent_level ||
      "Standard",
    recent_company_news:
      jsonMeta.recent_company_news ||
      "",
    website_tech_stack:
      (company?.tech_stack && company.tech_stack.length > 0)
        ? company.tech_stack
        : (jsonMeta.website_tech_stack && jsonMeta.website_tech_stack.length > 0)
          ? jsonMeta.website_tech_stack
          : [],
    required_engineering_stack:
      (jsonMeta.required_engineering_stack && jsonMeta.required_engineering_stack.length > 0)
        ? jsonMeta.required_engineering_stack
        : [],
    recent_founder_activity:
      jsonMeta.recent_founder_activity ||
      "",
    ai_icebreaker: aiIcebreaker,
    email_subject_line: emailSubjectLine,
    verification_status:
      jsonMeta.verification_status ||
      "Unverified",
    source_attribution:
      jsonMeta.source_attribution ||
      triggerUrl ||
      website ||
      "",
  };
}

export function serializeLeadIntelligence(intel: LeadIntelligence24): string {
  return JSON.stringify(intel);
}
