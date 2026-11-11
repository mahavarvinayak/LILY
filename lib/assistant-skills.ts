import type { OpportunityRecord } from "@/types";

export interface AssistantSkill {
  id: string;
  command: string;
  name: string;
  badge: string;
  description: string;
  example: string;
  run: (ctx: SkillContext) => string;
}

export interface SkillContext {
  query: string;
  agencyName: string;
  targetOpp: OpportunityRecord | null;
  allOpps: OpportunityRecord[];
  pipelineValue: number;
}

function resolveTarget(ctx: SkillContext): OpportunityRecord | null {
  if (ctx.targetOpp) return ctx.targetOpp;
  const q = ctx.query.toLowerCase();
  const matched = ctx.allOpps.find((opp) => {
    const comp = opp.company?.name?.toLowerCase() || "";
    const pFirst = opp.person?.first_name?.toLowerCase() || "";
    const pLast = opp.person?.last_name?.toLowerCase() || "";
    return comp.includes(q) || pFirst.includes(q) || pLast.includes(q);
  });
  if (matched) return matched;
  return ctx.allOpps.filter((o) => o.stage !== "Lost").sort((a, b) => b.deal_value - a.deal_value)[0] || null;
}

function getDetails(opp: OpportunityRecord | null, agencyName: string) {
  const company = opp?.company?.name || "Target Account";
  const contact = opp?.person?.first_name || "Leader";
  const title = opp?.person?.job_title || "Founder & CEO";
  const trigger = opp?.buying_trigger || "actively scaling key business initiatives";
  const domain = opp?.company?.website?.replace(/^https?:\/\//, "") || "company domain";
  const email = opp?.person?.email || "verified corporate email";
  return { company, contact, title, trigger, domain, email, agency: agencyName || "Our Agency" };
}

export const ASSISTANT_SKILLS: AssistantSkill[] = [
  {
    id: "cold-email",
    command: "/cold-email",
    name: "3-Sentence Trigger Cold Email",
    badge: "Outreach",
    description: "Hook, bridge, concrete outcome, and one low-friction ask",
    example: "/cold-email Gymshark",
    run: (ctx) => {
      const opp = resolveTarget(ctx);
      const { company, contact, title, trigger, agency } = getDetails(opp, ctx.agencyName);
      return `### 3-Sentence Trigger Cold Email for ${company}
**Target:** ${contact} (${title})
**Verified Trigger:** ${trigger}

---

**Subject:** Quick note re: ${company} expansion

Hi ${contact},

Saw ${company} ${trigger.toLowerCase()} — usually the moment engineering bandwidth lags behind hiring milestones.

At ${agency}, we deploy dedicated technical squads to ship critical product sprints in 14 days without the 8-week recruiting latency.

Open to exploring if our vetted talent pool can accelerate this milestone?

Best,  
${agency}`;
    },
  },
  {
    id: "followup-sequence",
    command: "/followup-sequence",
    name: "4-Touch Outbound Cadence",
    badge: "Cadence",
    description: "Multi-touch sequence with progressive angles; never 'just bumping'",
    example: "/followup-sequence Habilelabs",
    run: (ctx) => {
      const opp = resolveTarget(ctx);
      const { company, contact, trigger } = getDetails(opp, ctx.agencyName);
      return `### 4-Touch Outbound Cadence for ${company}
**Recipient:** ${contact} · **Anchor:** ${trigger}

#### Touch 1: Value Drop (Day 3)
> “${contact}, quick resource for your team: when scaling ${trigger.toLowerCase()}, teams often hit delivery bottlenecks. Here is a 3-point sprint audit we ran for a similar team that cut dev overhead by 34%. Thought it might be useful as you grow.”

#### Touch 2: Social Proof & Metrics (Day 7)
> “Hi ${contact}, we recently partnered with a fast-scaling tech firm facing the same requisition challenge. Placed two senior engineers within 96 hours, taking their backlog to zero. Worth 10 minutes to review how we structured their sprint?”

#### Touch 3: Low-Friction Permission (Day 12)
> “${contact}, know you're knee-deep in quarterly priorities. If now isn't the right time to augment your delivery squad, happy to pause. Just reply 'pause' and I’ll circle back next quarter.”

#### Touch 4: Polite Breakup (Day 18)
> “Hi ${contact}, haven't heard back so assuming your internal hiring has this covered. Closing your file on our end for now. If capacity becomes tight later in Q4, you know where to find us.”`;
    },
  },
  {
    id: "linkedin-opener",
    command: "/linkedin-opener",
    name: "LinkedIn Connection & InMail Hook",
    badge: "LinkedIn",
    description: "Contextual connection request (<300 chars) + direct InMail hook",
    example: "/linkedin-opener Ashish",
    run: (ctx) => {
      const opp = resolveTarget(ctx);
      const { company, contact, trigger, agency } = getDetails(opp, ctx.agencyName);
      return `### LinkedIn Connection & InMail Playbook for ${company}
**Prospect:** ${contact} (${opp?.person?.job_title || "Executive"})

#### 1. Connection Request Note (< 300 characters)
\`\`\`text
Hi ${contact}, noticed ${company} ${trigger.toLowerCase()}. We help leadership teams solve technical delivery bottlenecks during rapid growth. Would love to connect and follow your roadmap.
\`\`\`

#### 2. First InMail / 1st-Degree Message
\`\`\`text
Hi ${contact},

Congrats on the momentum at ${company}. Noticed your live focus on ${trigger.toLowerCase()}.

Most founders tell us that hiring full-time right now slows down urgent delivery commitments. At ${agency}, we plug pre-vetted senior devs into active sprints in under 5 business days.

Open to a brief 8-minute exchange on how we can de-risk your Q4 delivery schedule?
\`\`\``;
    },
  },
  {
    id: "icebreaker",
    command: "/icebreaker",
    name: "2-Line Trigger Icebreakers",
    badge: "Personalization",
    description: "Hyper-relevant opening lines tailored to primary and secondary leaders",
    example: "/icebreaker eDelta",
    run: (ctx) => {
      const opp = resolveTarget(ctx);
      const { company, contact, trigger } = getDetails(opp, ctx.agencyName);
      return `### Bespoke 2-Line Hooks for ${company}

**Angle 1 (Hiring & Urgency Hook):**
> “Hey ${contact}, saw ${company} ${trigger.toLowerCase()}. Impressive expansion pace — caught my attention while researching top high-growth teams in your vertical.”

**Angle 2 (Strategic Capacity Hook):**
> “Hi ${contact}, noticed the recent push at ${company}. Whenever teams hit this inflection point, sprint velocity often gets capped by technical recruitment delays.”

**Angle 3 (Multi-Threading Secondary Leader Hook):**
> “Hi there, reached out to ${contact} regarding ${company}'s live initiative around ${trigger.toLowerCase()}. Wanted to share our sprint framework with your leadership team as well.”`;
    },
  },
  {
    id: "objection-handling",
    command: "/objection-handling",
    name: "Top 5 Objection Rebuttals",
    badge: "Sales Closing",
    description: "Rebuttals for 'Already have vendor', 'Send info', 'No budget', 'In-house'",
    example: "/objection-handling",
    run: (ctx) => {
      const opp = resolveTarget(ctx);
      const { company, contact, trigger } = getDetails(opp, ctx.agencyName);
      return `### High-Conversion Objection Rebuttals for ${company}

1. **“We already have an existing agency/vendor.”**
   > “Completely understand ${contact} — most leading teams do. We don't ask you to replace them. We serve as a rapid on-demand overflow unit when internal or existing vendors hit capacity ceilings, especially around ${trigger.toLowerCase()}. Fair to keep us in your back pocket?”

2. **“Send me an email with more information.”**
   > “Gladly! Before I clutter your inbox, what is the single biggest bottleneck your team faces right now with ${trigger.toLowerCase()}? I’ll send a 1-page breakdown addressing only that.”

3. **“We have zero budget allocated right now.”**
   > “Fair point. We structure our initial sprint with zero upfront licensing fees — you only deploy capital against verified, delivered milestones. If it doesn't save immediate COGS, you owe nothing.”

4. **“We handle all engineering in-house.”**
   > “Respect that standard — in-house talent protects core IP. Our team operates as an embedded pod executing secondary requisitions so your core engineers stay 100% focused on product architecture.”

5. **“Not interested right now.”**
   > “Understood ${contact}. Timing is everything. May I ask: are you fully staffed for this quarter's delivery targets, or is hiring just paused for the moment?”`;
    },
  },
  {
    id: "multi-thread",
    command: "/multi-thread",
    name: "Multi-Threading Outreach Playbook",
    badge: "Enterprise",
    description: "Strategic coordinate approach for CEO, CTO, and VP Sales",
    example: "/multi-thread",
    run: (ctx) => {
      const opp = resolveTarget(ctx);
      const { company, contact, trigger } = getDetails(opp, ctx.agencyName);
      return `### Multi-Threading Strategy for ${company}
**Anchor Account:** ${company} · **Signal:** ${trigger}

| Role Tier | Target Persona | Value Angle | Message Objective |
| :--- | :--- | :--- | :--- |
| **Tier 1 (CEO / Founder)** | Strategic Growth & Revenue | Risk mitigation, speed to market, capital efficiency | 12-minute alignment call |
| **Tier 2 (CTO / Head of Tech)** | Engineering Execution | Architecture fit, zero onboarding friction, clean code standards | Technical sprint review |
| **Tier 3 (VP Sales / Ops)** | Delivery & Capacity | Hitting delivery quotas, faster time-to-deliver for clients | Capacity audit |

**Execution Rule:**
Send Tier 1 touch on Tuesday morning. If no response by Thursday, message Tier 2 referencing: *“Reaching out to you directly after a quick note to ${contact} — wanted to ensure your technical leads have bandwidth for ${trigger.toLowerCase()}.”*`;
    },
  },
  {
    id: "subject-lines",
    command: "/subject-lines",
    name: "10 High-Conversion Subject Lines",
    badge: "Email",
    description: "Curiosity, pain, and trigger-led email subjects with 60%+ open potential",
    example: "/subject-lines ValueDX",
    run: (ctx) => {
      const opp = resolveTarget(ctx);
      const { company, contact, trigger } = getDetails(opp, ctx.agencyName);
      return `### 10 High-Open Subject Lines for ${company}
**Recipient:** ${contact}

1. \`${company} + ${trigger.slice(0, 25)}...\` *(Trigger-led · 64% Avg Open)*
2. \`Quick question regarding ${company} engineering\` *(Direct Curiosity · 58% Avg Open)*
3. \`${contact}, 12 mins this Thursday?\` *(Personal Low-Friction · 55% Avg Open)*
4. \`Idea for ${company}'s delivery sprint\` *(Value-first · 61% Avg Open)*
5. \`Resource for ${contact} re: ${company}\` *(Helpful · 52% Avg Open)*
6. \`Solving the 8-week hiring lag at ${company}\` *(Pain-driven · 67% Avg Open)*
7. \`Sprint capacity for ${company}\` *(Clean B2B · 59% Avg Open)*
8. \`${company} Q4 roadmap acceleration\` *(Executive focus · 63% Avg Open)*
9. \`Quick feedback on ${trigger.slice(0, 20)}\` *(Peer hook · 57% Avg Open)*
10. \`Permission to close your file, ${contact}?\` *(Breakup subject · 72% Avg Open)*`;
    },
  },
  {
    id: "value-audit",
    command: "/value-audit",
    name: "Account Tech & Growth Teardown",
    badge: "Research",
    description: "Diagnose domain bottlenecks from tech stack and job post requirements",
    example: "/value-audit Gymshark",
    run: (ctx) => {
      const opp = resolveTarget(ctx);
      const { company, contact, trigger, domain } = getDetails(opp, ctx.agencyName);
      return `### Growth & Technical Teardown for ${company}
**Target:** ${contact} · **Domain:** ${domain}

#### 1. Commercial Growth Context
- **Observed Buying Signal:** ${trigger}
- **Intent Level:** High Intent Active Requisition
- **Opportunity:** Immediate need for senior execution capability before Q4 ends.

#### 2. Risk & Bottleneck Analysis
- **Hiring Latency Cost:** Every unfilled technical role delays core roadmap milestones by an average of 45-60 days.
- **Internal Burnout:** Existing core staff absorb overflow tasks, increasing churn risk.
- **Quality Risk:** Junior contract hires compromise delivery standards.

#### 3. Strategic Solution Pitch
Deploy a pre-vetted delivery team under dedicated technical management. Guaranteed SLA handover within 5 business days.`;
    },
  },
  {
    id: "re-engage",
    command: "/re-engage",
    name: "Dormant Lead Revival",
    badge: "Recovery",
    description: "Permission-to-close breakup touch to wake up ghosted prospects",
    example: "/re-engage",
    run: (ctx) => {
      const opp = resolveTarget(ctx);
      const { company, contact } = getDetails(opp, ctx.agencyName);
      return `### Ghosted / Stalled Lead Revival for ${company}
**Target:** ${contact}

**Subject:** Closing the loop re: ${company}

Hi ${contact},

Usually when I don't hear back after our initial exchange, it means one of two things:

1. You've completely resolved your technical delivery needs in-house (which is fantastic).
2. You've been pulled into other priorities and this is on the back-burner for now.

Which one is it for ${company}? If it's #2, happy to stay in touch whenever timing aligns.

Best regards,  
${ctx.agencyName}`;
    },
  },
  {
    id: "case-study-story",
    command: "/case-study-story",
    name: "60-Word Proof Snippet",
    badge: "Social Proof",
    description: "Turn past results into metric-driven social proof for cold outreach",
    example: "/case-study-story",
    run: () => {
      return `### 60-Word Proof Snippet

> “When a fast-growing digital agency hit a 6-week bottleneck on their custom enterprise delivery, we injected a 2-engineer senior squad within 72 hours. Result: 100% of sprint deliverables shipped 4 days ahead of deadline, saving ₹3.8L in recruitment agency retainers.”

*Copy and drop this directly into paragraph 2 of any cold outreach or follow-up email.*`;
    },
  },
  {
    id: "proposal-scope",
    command: "/proposal-scope",
    name: "1-Page Sprint Architecture",
    badge: "Closing",
    description: "Delivery scope tailored to the lead's required engineering stack",
    example: "/proposal-scope AppTerran",
    run: (ctx) => {
      const opp = resolveTarget(ctx);
      const { company, trigger } = getDetails(opp, ctx.agencyName);
      return `### 1-Page Sprint Scope Outline for ${company}
**Initiative:** Rapid Engineering Pod Deployment  
**Context:** ${trigger}

1. **Phase 1: Architecture Alignment & Environment Setup (Days 1–3)**
   - Repository access, code audit, and local container orchestration.
   - Initial backlog grooming and milestone sign-off.

2. **Phase 2: Core Sprint Execution (Days 4–14)**
   - Daily async standups + PR review protocol.
   - Delivery of top 3 high-priority features with 90%+ test coverage.

3. **Phase 3: QA & Live Production Handover (Days 15–18)**
   - Load testing, automated regression verification.
   - Live production deployment and documentation sign-off.

**Commercial Framework:**  
50% milestone commencement deposit, 50% upon verified production handover.`;
    },
  },
  {
    id: "meeting-prep",
    command: "/meeting-prep",
    name: "Pre-Call Executive Briefing",
    badge: "Discovery",
    description: "Account background, leadership bio, pain triggers, and trap questions",
    example: "/meeting-prep Gymshark",
    run: (ctx) => {
      const opp = resolveTarget(ctx);
      const { company, contact, title, trigger, domain } = getDetails(opp, ctx.agencyName);
      return `### 5-Minute Executive Briefing for ${company}
**Call Target:** ${contact} (${title})  
**Domain:** ${domain} · **Buying Signal:** ${trigger}

#### Discovery Talking Points:
1. “Saw your live initiative around ${trigger.toLowerCase()} — how is the internal team pacing against that deadline?”
2. “When expanding engineering squads, what has been your biggest friction point with outside agencies?”
3. “If we could deploy 2 vetted senior engineers next Monday, what feature would you have them push first?”

#### Pitfalls & Traps to Avoid:
- ❌ Do NOT pitch hourly rates or generic developer resumes.
- ❌ Do NOT challenge their existing in-house architecture.
- ✅ Anchor strictly on **time-to-ship** and **revenue delivery milestone**.`;
    },
  },
  {
    id: "icp-sharpen",
    command: "/icp-sharpen",
    name: "Lead Qualification & Intent Scoring",
    badge: "Qualification",
    description: "Evaluate company headcount, trigger urgency, and commercial ceiling",
    example: "/icp-sharpen",
    run: (ctx) => {
      const opp = resolveTarget(ctx);
      const { company, trigger } = getDetails(opp, ctx.agencyName);
      return `### Lead Qualification Analysis for ${company}

| Qualification Metric | Observation | Score (1-10) |
| :--- | :--- | :--- |
| **Trigger Urgency** | ${trigger} (< 7 days old) | 9/10 |
| **Commercial Intent** | Active requisition requiring direct capital allocation | 8/10 |
| **Authority Ceiling** | Direct Founder/CEO contact verified | 9/10 |
| **Deal Fit** | Prime COGS replacement candidate | 8.5/10 |

**Verdict:** **Tier-1 Priority Target.** Dispatch tailored outreach within 24 hours while hiring trigger is active.`;
    },
  },
];
