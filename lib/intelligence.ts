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
  const cleanTrigger = sanitizeTriggerText(rawTrigger) || "expanding operations";

  const isSalesOrBD = /\b(sales|business development|bde|bdr|sdr|client acquisition|marketing|lead gen)\b/i.test(cleanTrigger);

  if (isSalesOrBD) {
    const emailSubject = `Quick note: ${company}'s outbound pipeline`;
    const emailBody = `Hi ${firstName},\n\nSaw ${company} is currently hiring for business development to scale client acquisition.\n\nMost agency founders tell us that hiring and training new BDEs takes 6 to 8 weeks before seeing consistent qualified calls with US/EU prospects.\n\nWe install an automated pipeline engine that delivers verified, high-intent client opportunities directly into your CRM every morning—without the hiring lag.\n\nOpen to a brief 5-minute chat this Thursday to see 3 sample opportunities for ${company}?\n\nBest,`;

    const linkedinNote = `Hi ${firstName}, saw ${company} is expanding its business development team. I work with agency founders to help scale client acquisition with US/EU accounts. Would love to connect and exchange notes!`;

    const linkedinMessage = `Hey ${firstName}, saw you're actively scaling your business development team at ${company}.\n\nUsually, getting new BDEs ramped up on outbound takes 60+ days before seeing booked calls.\n\nWe help agency founders automate lead intelligence and deliver verified client opportunities directly to your desk from day 1.\n\nOpen to a brief 5-minute chat on Thursday to compare notes?`;

    return { emailSubject, emailBody, linkedinNote, linkedinMessage };
  }

  const shortTrigger = cleanTrigger.split(/\s+/).slice(0, 6).join(" ").replace(/[.,;:]$/, "");
  const emailSubject = `Engineering bandwidth for ${company}'s roadmap`;
  const emailBody = `Hi ${firstName},\n\nSaw ${company} is actively recruiting for ${cleanTrigger}.\n\nFinding vetted senior talent usually creates a 6-to-8 week recruitment lag that pushes critical product milestones back into next quarter.\n\nWe provide dedicated, pre-vetted senior talent ready to plug in and ship from Day 1—with zero recruitment overhead.\n\nWorth a quick 4-minute chat this Thursday to compare bandwidth?\n\nBest,`;

  const linkedinNote = `Hi ${firstName}, noticed ${company} is expanding its team for ${shortTrigger}. We help leaders hit delivery milestones without the 8-week hiring lag. Open to connecting?`;

  const linkedinMessage = `Hey ${firstName}, saw ${company} is actively recruiting for ${cleanTrigger}.\n\nMost founders tell us long hiring cycles stall sprint velocity and delay major release dates.\n\nWe plug in senior, pre-vetted talent within 72 hours so your roadmap stays on track.\n\nOpen to a quick 5-minute chat this Thursday to compare bandwidth?`;

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

  const isOldShortDm = Boolean(
    opp.ai_icebreaker &&
      opp.ai_icebreaker.length < 260 &&
      /let us connect|open to connect/i.test(opp.ai_icebreaker),
  );

  const aiIcebreaker =
    (!isOldShortDm && opp.ai_icebreaker) ||
    jsonMeta.ai_icebreaker ||
    defaultPitch.emailBody;

  const emailSubjectLine =
    opp.ai_subject_line ||
    jsonMeta.email_subject_line ||
    defaultPitch.emailSubject;

  const linkedinNote =
    (isOldShortDm ? opp.ai_icebreaker : null) ||
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
