import { Radar, ShieldCheck, Sparkles } from "lucide-react";

const pillars = [
  {
    index: "01",
    icon: Radar,
    title: "Live buying triggers",
    body: "Verified hiring posts, funding rounds and expansion news from the last 48 hours. The reason to reach out exists before you do.",
    footer: "Jobs · ATS feeds · funding wires · press",
  },
  {
    index: "02",
    icon: ShieldCheck,
    title: "Zero account risk",
    body: "Your personal LinkedIn is never touched, connected or exposed. Leads are sourced through the operator's residential session — delivered as plain CRM records.",
    footer: "One operator session. Zero client credentials.",
  },
  {
    index: "03",
    icon: Sparkles,
    title: "AI outreach pre-loaded",
    body: "Every contact arrives with a bespoke two-line icebreaker written against their live trigger, plus a subject line your team can send without editing.",
    footer: "Trigger-led drafts · ready for your review",
  },
];

export function Pillars() {
  return (
    <section
      id="mechanism"
      className="relative mx-auto w-full max-w-[1200px] px-6 py-24 lg:px-8 lg:py-32"
    >
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <span className="kicker">The mechanism</span>
          <h2 className="display mt-5 max-w-[560px] text-[clamp(2rem,3.6vw,3rem)]">
            Most lead lists are inventory.
            <span className="block text-muted-foreground">LILY delivers a reason to call.</span>
          </h2>
        </div>
        <div className="lg:col-span-5">
          <p className="max-w-[460px] text-[14.5px] leading-[1.75] text-muted-foreground lg:ml-auto">
            A database can tell you who exists. It cannot tell you who just opened two Shopify roles,
            closed a seed round, or signed a distributor in a market they have never sold into. LILY
            starts from the event — then finds the person accountable for it.
          </p>
        </div>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
        {pillars.map((pillar) => (
          <article key={pillar.index} className="edge-card group p-6 transition-colors hover:bg-surface">
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-[8px] border border-border/25 bg-surface/[0.08]">
                <pillar.icon className="size-[17px] text-foreground" strokeWidth={1.6} />
              </span>
              <span className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground">
                {pillar.index}
              </span>
            </div>
            <h3 className="mt-6 text-[17px] font-semibold tracking-[-0.015em] text-muted-foreground">
              {pillar.title}
            </h3>
            <p className="mt-3 text-[13.5px] leading-[1.7] text-muted-foreground">{pillar.body}</p>
            <p className="mt-7 border-t border-foreground/[0.07] pt-4 text-[11.5px] leading-relaxed text-muted-foreground">
              {pillar.footer}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
