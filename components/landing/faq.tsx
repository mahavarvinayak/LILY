import { Plus } from "lucide-react";

const faqs = [
  {
    q: "Where do the leads actually come from?",
    a: "The operator runs a residential LinkedIn MCP session plus public job boards, ATS feeds and funding announcements. Every record is verified by hand against the source before it enters your workspace. LILY is not a resold database — it is a nightly research operation with a quota.",
  },
  {
    q: "Will my LinkedIn account get restricted?",
    a: "No. Your account is never connected, logged into or automated. Sourcing happens entirely on the operator's infrastructure; you receive neutral CRM records — company, person, title, work email, trigger and a source link. No cookies, no browser extensions, no credentials.",
  },
  {
    q: "What does ‘trigger-matched’ mean in practice?",
    a: "Every lead has a live event behind it: a role opening, a funding close, an office expansion or a channel launch from the last 48 hours. The deal name, icebreaker and subject line are all written against that event — not a generic industry template.",
  },
  {
    q: "How is this different from Apollo, Clay or a lead vendor?",
    a: "Those tools give you filters and a database. LILY gives you a reason to reach out, the accountable decision-maker, a two-line hook, and a slot in a pipeline that is waiting for you at 8 AM. You are buying completed research, not raw records.",
  },
  {
    q: "Is my workspace isolated from other agencies?",
    a: "Yes. Enterprise row-level security scopes every query to your unique agency tenant, and opportunities stay invisible until their scheduled release time. Workspaces are cryptographically isolated with zero data bleed across accounts.",
  },
  {
    q: "Can I change my niche, quota or drop time?",
    a: "From Settings, at any time. Quota and niche changes apply from the next nightly cycle. If a drop lands on a public holiday, the operator shifts it — you are never charged for a day the engine did not deliver.",
  },
  {
    q: "Do you send emails or LinkedIn messages for me?",
    a: "You send. LILY pre-loads the subject, body and LinkedIn DM copy; email dispatch operates from your verified domain, and DMs are one-click copy. LILY never acts from a client's LinkedIn identity.",
  },
  {
    q: "What if the first week is not a fit?",
    a: "Tell the operator. Founding cohort plans are month-to-month, and the first cycle is covered by a fit check: if the signal quality is wrong for your niche, we retune the lane or refund the cycle. No annual contract to escape.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto w-full max-w-[1200px] px-6 py-24 lg:px-8 lg:py-32">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <span className="kicker">Technical FAQ</span>
          <h2 className="display mt-5 max-w-[320px] text-[clamp(1.9rem,3.2vw,2.7rem)]">
            The questions a careful operator asks.
          </h2>
          <p className="mt-6 max-w-[300px] text-[13.5px] leading-[1.75] text-muted-foreground">
            Still unresolved? Write to{" "}
            <a
              href="mailto:hello@thepilab.in"
              className="font-medium text-muted-foreground underline decoration-foreground/20 underline-offset-4 transition-colors hover:text-foreground"
            >
              vinayak@lily.os
            </a>{" "}
            — the operator answers.
          </p>
        </div>

        <div className="lg:col-span-8">
          <div className="border-t border-foreground/[0.08]">
            {faqs.map((faq) => (
              <details key={faq.q} className="group border-b border-foreground/[0.08]">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
                  <span className="text-[14.5px] font-medium leading-snug text-muted-foreground">
                    {faq.q}
                  </span>
                  <Plus className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45 group-open:text-foreground" />
                </summary>
                <p className="max-w-[660px] pb-6 pr-6 text-[13.5px] leading-[1.8] text-muted-foreground">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
