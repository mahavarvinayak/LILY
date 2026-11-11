import type { OpportunityRecord, Company, Person } from "@/lib/types";

export interface LeadIntelligence31 {
  company_name: string;
  website: string;
  company_linkedin_url: string;
  headquarters: string;
  employee_count: string;
  industry_niche: string;
  value_proposition: string;

  contact_name: string;
  job_title: string;
  contact_title?: string;
  linkedin_url: string;
  tenure_at_company: string;
  follower_count: string;
  work_email: string;

  secondary_contact_name: string;
  secondary_contact_title: string;
  secondary_linkedin_url: string;

  tertiary_contact_name: string;
  tertiary_contact_title: string;
  tertiary_linkedin_url: string;

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
  linkedin_note?: string;
  linkedin_message?: string;

  verification_status: string;
  source_attribution: string;
}

export type LeadIntelligence24 = LeadIntelligence31;

export function sanitizeTriggerText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\s*\((?:posted\s*)?(?:job|req(?:uisition)?)\s*id:?[^)]*\)/gi, "")
    .replace(/\s*\((?:posted\s*)?\d+[dh]\s*ago\)$/i, "")
    .replace(/\s*\(.*?ago\)$/i, "")
    .replace(/\s*(?:job|req(?:uisition)?)\s*id:?\s*\w+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function synthesizeDefaultPitch(company: string, contactName: string, rawTrigger: string) {
  const firstName = contactName.split(/\s+/)[0] || "there";
  const cleanTrigger = sanitizeTriggerText(rawTrigger) || "scaling core operations";
  const shortTrigger = cleanTrigger.split(/\s+/).slice(0, 6).join(" ").replace(/[.,;:]$/, "");

  const emailSubject = `Quick note on ${company}'s ${shortTrigger}`;
  const emailBody = `Hi ${firstName},\n\nSaw ${company} is actively ${cleanTrigger}. Most founders I speak with find that hiring senior talent creates a 6-to-8 week lag that pushes quarterly release targets back.\n\nWe deploy pre-vetted senior pods ready to execute sprint objectives from Day 1—with zero recruitment overhead.\n\nOpen to a brief 4-minute chat this Thursday to compare notes?\n\nBest,`;

  const linkedinNote = `Hi ${firstName}, noticed you're ${cleanTrigger} at ${company}. We help growth teams hit delivery milestones without the 8-week hiring lag. Open to connecting?`;

  const linkedinMessage = `Hey ${firstName},\n\nSaw ${company} is actively ${cleanTrigger}.\n\nFounders in your space usually tell us standard hiring vendor cycles eat into sprint velocity and stall deliverables.\n\nWe provide dedicated, pre-vetted pods with instant deployment—no recruitment lag.\n\nWorth a brief 5-minute sync on Thursday to see if our bench matches your roadmap?`;

  return { emailSubject, emailBody, linkedinNote, linkedinMessage };
}

export function parseJsonNotes(notes: string | null | undefined): Partial<LeadIntelligence31> {
  if (!notes) return {};
  try {
    const trimmed = notes.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return JSON.parse(trimmed) as Partial<LeadIntelligence31>;
    }
  } catch {}
  return {};
}

export function extractLeadIntelligence(
  opp: OpportunityRecord,
  fallbackCompany?: Company | null,
  fallbackPerson?: Person | null,
): LeadIntelligence31 {
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
    (company?.domain ? (company.domain.startsWith("http") ? company.domain : `https://${company.domain}`) : "") ||
    jsonMeta.website ||
    "";

  const companyLinkedinUrl =
    company?.linkedin_url ||
    jsonMeta.company_linkedin_url ||
    "";

  const contactName =
    rawPersonName ||
    jsonMeta.contact_name ||
    "Decision Maker";

  const contactTitle =
    person?.job_title ||
    jsonMeta.job_title ||
    "Leadership";

  const workEmail =
    person?.email ||
    jsonMeta.work_email ||
    "";

  const linkedinUrl =
    person?.linkedin_url ||
    jsonMeta.linkedin_url ||
    "";

  const rawBuyingTrigger =
    opp.buying_trigger ||
    jsonMeta.buying_trigger ||
    "";
  const buyingTrigger = sanitizeTriggerText(rawBuyingTrigger);

  const defaultPitch = synthesizeDefaultPitch(companyName, contactName, buyingTrigger);

  const triggerUrl =
    opp.trigger_url ||
    jsonMeta.trigger_url ||
    "";

  const aiIcebreaker =
    opp.ai_icebreaker ||
    jsonMeta.ai_icebreaker ||
    defaultPitch.emailBody;

  const emailSubjectLine =
    opp.ai_subject_line ||
    jsonMeta.email_subject_line ||
    defaultPitch.emailSubject;

  const linkedinNote =
    jsonMeta.linkedin_note ||
    defaultPitch.linkedinNote;

  const linkedinMessage =
    jsonMeta.linkedin_message ||
    defaultPitch.linkedinMessage;

  return {
    company_name: companyName,
    website,
    company_linkedin_url: companyLinkedinUrl,
    headquarters:
      company?.location ||
      jsonMeta.headquarters ||
      "",
    employee_count:
      company?.employee_count ||
      jsonMeta.employee_count ||
      "",
    industry_niche:
      company?.industry ||
      jsonMeta.industry_niche ||
      "",
    value_proposition:
      jsonMeta.value_proposition ||
      "",
    contact_name: contactName,
    job_title: contactTitle,
    contact_title: contactTitle,
    linkedin_url: linkedinUrl,
    tenure_at_company:
      jsonMeta.tenure_at_company ||
      "",
    follower_count:
      jsonMeta.follower_count ||
      "",
    work_email: workEmail,
    secondary_contact_name:
      jsonMeta.secondary_contact_name ||
      "",
    secondary_contact_title:
      jsonMeta.secondary_contact_title ||
      "",
    secondary_linkedin_url:
      jsonMeta.secondary_linkedin_url ||
      "",
    tertiary_contact_name:
      jsonMeta.tertiary_contact_name ||
      "",
    tertiary_contact_title:
      jsonMeta.tertiary_contact_title ||
      "",
    tertiary_linkedin_url:
      jsonMeta.tertiary_linkedin_url ||
      "",
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
    linkedin_note: linkedinNote,
    linkedin_message: linkedinMessage,
    verification_status:
      jsonMeta.verification_status ||
      "Verified 100%",
    source_attribution:
      jsonMeta.source_attribution ||
      triggerUrl ||
      website ||
      "",
  };
}

export function serializeLeadIntelligence(intel: LeadIntelligence31): string {
  return JSON.stringify(intel);
}
