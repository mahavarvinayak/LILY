export type Role = "client" | "super_admin";

export type Stage = "New Lead" | "Screening" | "Meeting" | "Proposal" | "Customer" | "Lost";

export type SubscriptionTier = "Starter" | "Growth" | "Scale";

export interface Profile {
  id: string;
  agency_name: string;
  contact_email: string;
  target_niche: string | null;
  daily_lead_quota: number;
  slack_webhook_url: string | null;
  subscription_tier: SubscriptionTier;
  payment_utr?: string | null;
  payment_verified?: boolean;
  payment_amount?: number;
  verified_at?: string | null;
  created_at: string;
}

export interface Company {
  id: string;
  user_id: string;
  name: string;
  domain: string | null;
  website: string | null;
  linkedin_url?: string | null;
  employee_count?: string | null;
  industry?: string | null;
  location: string | null;
  address?: string | null;
  tech_stack: string[] | null;
  created_at: string;
}

export interface Person {
  id: string;
  user_id: string;
  company_id: string | null;
  first_name: string;
  last_name: string | null;
  job_title: string;
  email: string | null;
  phone?: string | null;
  linkedin_url: string;
  role_tier?: "primary" | "secondary" | "tertiary";
  created_at: string;
}

export interface Opportunity {
  id: string;
  user_id: string;
  company_id: string | null;
  person_id: string | null;
  deal_name: string;
  deal_value: number;
  stage: Stage;
  buying_trigger: string;
  trigger_url?: string | null;
  ai_subject_line: string | null;
  ai_icebreaker: string | null;
  scheduled_at: string;
  outreach_dispatched: boolean;
  notes: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  completed: boolean;
  priority: "low" | "medium" | "high";
  created_at: string;
}

export interface OpportunityRecord extends Opportunity {
  company: Company | null;
  person: Person | null;
}

export type MemberRole =
  | "Admin"
  | "SDR"
  | "Account Executive"
  | "Viewer"
  | "Owner"
  | "Sales Rep"
  | "BDE"
  | "Manager";

export interface TeamMember {
  id: string;
  agency_id: string;
  name: string;
  email: string;
  role: MemberRole;
  status: "Active" | "Pending" | "Invited";
  joined_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  title: string;
  description: string | null;
  metadata?: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export interface WorkspaceData {
  profile: Profile;
  companies: Company[];
  people: Person[];
  opportunities: OpportunityRecord[];
  tasks: Task[];
  team_members?: TeamMember[];
  activities?: ActivityLog[];
  isAdmin: boolean;
  pending?: boolean;
}

export interface AdminClientRow {
  profile: Profile;
  companies: number;
  opportunities: number;
  releasedToday: number;
  pipelineValue: number;
  nextDropAt: string | null;
}

export interface IngestedLead {
  company_name: string;
  website?: string;
  company_linkedin_url?: string;
  domain?: string;
  location?: string;
  headquarters?: string;
  employee_count?: string;
  industry_niche?: string;
  industry?: string;
  value_proposition?: string;

  contact_name: string;
  job_title: string;
  linkedin_url: string;
  tenure_at_company?: string;
  follower_count?: string;
  email?: string;
  work_email?: string;

  secondary_contact_name?: string;
  secondary_contact_title?: string;
  secondary_linkedin_url?: string;

  tertiary_contact_name?: string;
  tertiary_contact_title?: string;
  tertiary_linkedin_url?: string;

  buying_trigger: string;
  trigger_age?: string;
  trigger_url?: string;
  intent_level?: string;
  recent_company_news?: string;

  tech_stack?: string[];
  website_tech_stack?: string[];
  required_engineering_stack?: string[];

  recent_founder_activity?: string;
  ai_icebreaker?: string;
  email_subject_line?: string;

  verification_status?: string;
  source_attribution?: string;

  deal_name?: string;
  deal_value?: number;
  notes?: string;
}

export interface AgentResult {
  ok: boolean;
  message: string;
  command?: string;
  filter?: string;
  updated?: number;
  slackSent?: boolean;
  demo?: boolean;
  drafts?: { id: string; subject: string; body: string }[];
}

export const STAGES: Stage[] = ["New Lead", "Screening", "Meeting", "Proposal", "Customer"];

export const STAGE_META: Record<
  Stage,
  { label: string; short: string; dot: string; tone: string }
> = {
  "New Lead": {
    label: "New Lead (8 AM Drop)",
    short: "New Lead",
    dot: "bg-primary",
    tone: "text-primary",
  },
  Screening: {
    label: "Screening",
    short: "Screening",
    dot: "bg-sky",
    tone: "text-sky",
  },
  Meeting: {
    label: "Meeting Booked",
    short: "Meeting",
    dot: "bg-pollen",
    tone: "text-pollen",
  },
  Proposal: {
    label: "Proposal Sent",
    short: "Proposal",
    dot: "bg-blush",
    tone: "text-blush",
  },
  Customer: {
    label: "Customer / Won",
    short: "Customer",
    dot: "bg-petal",
    tone: "text-petal",
  },
  Lost: {
    label: "Lost",
    short: "Lost",
    dot: "bg-muted-foreground",
    tone: "text-muted-foreground",
  },
};

