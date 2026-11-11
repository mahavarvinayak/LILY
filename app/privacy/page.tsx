import { Shield, Lock, Eye, FileText, CheckCircle2, Globe } from "lucide-react";
import { SiteNav, Footer } from "@/components/landing/site-chrome";
import { PageTransition } from "@/components/lily/page-transition";

export const metadata = {
  title: "Privacy Policy · LILY CRM",
  description: "How LILY CRM protects your agency's private pipeline data and client intelligence.",
};

export default function PrivacyPage() {
  return (
    <div className="marketing min-h-screen bg-background text-foreground">
      <SiteNav />
      <PageTransition>
        <main className="mx-auto max-w-3xl px-6 pt-36 pb-24 sm:pt-44">
          <div className="flex items-center gap-2 text-xs font-mono text-foreground mb-3">
            <Shield className="size-3.5" />
            <span>LEGAL & COMPLIANCE</span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-semibold tracking-tight text-foreground">
            Privacy Policy
          </h1>
          <p className="mt-2 text-xs font-mono text-muted-foreground">
            Effective date: November 10, 2026 · Strict RLS Database Isolation
          </p>

          <div className="mt-10 space-y-10 text-[14px] leading-relaxed text-muted-foreground">
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Lock className="size-4 text-foreground" />
                <span>1. Zero Cross-Tenant Data Leakage (Strict RLS)</span>
              </h2>
              <p>
                LILY operates on a single-tenant logical isolation model powered by PostgreSQL Row-Level Security (RLS). Every sourced lead, opportunity, company dossier, and custom autonomous agent generated for your agency is strictly bound to your private <code className="rounded bg-foreground/[0.06] px-1.5 py-0.5 text-xs font-mono text-foreground">user_id</code>. Under no circumstance are your pipeline accounts or outbound pitches exposed to or shared with any other agency.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Eye className="size-4 text-foreground" />
                <span>2. Client LinkedIn Credentials Protection</span>
              </h2>
              <p>
                LILY never requests, stores, or automates through your private personal LinkedIn credentials. All signal tracking, headcount monitoring, and hiring data scraping are conducted via headless cloud proxy workers running separate research nodes. Your personal and corporate LinkedIn accounts remain completely unexposed to LinkedIn automation detection algorithms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <FileText className="size-4 text-foreground" />
                <span>3. Data Collection and Usage</span>
              </h2>
              <p>When you onboard with LILY, we record:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                <li>Your agency name, primary contact email, and target ICP niche.</li>
                <li>Your daily lead quota configuration (e.g. 5, 15, or 30 leads/day).</li>
                <li>Team seat assignments for your sales representatives and SDRs.</li>
                <li>Autonomous agent triggers and workflow run execution timestamps.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" />
                <span>4. Data Retention & Permanent Deletion</span>
              </h2>
              <p>
                You maintain complete ownership of all data ingested into your LILY workspace. At any point, you may export your complete database as a CSV, or request permanent deletion of your agency workspace and all associated dossiers with zero residue on our servers.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Globe className="size-4 text-foreground" />
                <span>5. Sub-processors</span>
              </h2>
              <p>
                We use a small set of processors to run the product. Each receives only the data
                needed for its function, and none may use it for their own purposes.
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                <li>
                  <span className="text-foreground">Supabase</span> — database, authentication and
                  file storage (hosted Postgres with row-level security).
                </li>
                <li>
                  <span className="text-foreground">Resend</span> — transactional email: sign-in
                  codes, lead-drop digests and outreach sent from a managed address.
                </li>
                <li>
                  <span className="text-foreground">Composio</span> — OAuth brokering for Gmail,
                  Outlook and Google Calendar mailbox connections.
                </li>
                <li>
                  <span className="text-foreground">Z.ai / Zhipu AI</span> — language-model drafting
                  of outreach subject lines and icebreakers. Lead dossiers (company, contact, role,
                  trigger) are sent to this processor, which may process data outside your country,
                  including in China.
                </li>
                <li>
                  <span className="text-foreground">Groq</span> — fallback language-model inference
                  for the same drafting and agent requests, processed in the United States.
                </li>
                <li>
                  <span className="text-foreground">Slack</span> — optional workspace notifications,
                  only if your agency configures an incoming webhook.
                </li>
                <li>
                  <span className="text-foreground">Vercel</span> — application hosting and
                  serverless execution.
                </li>
              </ul>
              <p>
                Your connected mailbox password is encrypted with AES-256-GCM before storage; the
                encryption key never leaves the server. You can disconnect a mailbox at any time from
                Connectors, which deletes the stored credential.
              </p>
            </section>

            <section className="pt-6 border-t border-border text-xs text-muted-foreground font-mono">
              Questions regarding our privacy standards? Reach out directly to the principal operator at{" "}
              <a href="mailto:hello@thepilab.in" className="text-foreground hover:underline">
                hello@thepilab.in
              </a>.
            </section>
          </div>
        </main>
      </PageTransition>
      <Footer />
    </div>
  );
}

