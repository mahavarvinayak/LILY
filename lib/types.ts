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
  created_at: string;
}

export interface Company {
  id: string;
  user_id: string;
  name: string;
  domain: string | null;
  website: string | null;
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

export interface WorkspaceData {
  profile: Profile;
  companies: Company[];
  people: Person[];
  opportunities: OpportunityRecord[];
  tasks: Task[];
  team_members?: TeamMember[];
  isAdmin: boolean;
  /** True only for the server-rendered placeholder, before real rows load. */
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
  domain?: string;
  location?: string;
  tech_stack?: string[];
  contact_name: string;
  job_title: string;
  linkedin_url: string;
  email?: string;
  buying_trigger: string;
  trigger_url?: string;
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

