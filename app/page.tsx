import { PageTransition } from "@/components/lily/page-transition";
import { SiteNav, Footer } from "@/components/landing/site-chrome";
import { Hero } from "@/components/landing/hero";
import { Pillars } from "@/components/landing/pillars";
import { Engine } from "@/components/landing/engine";
import { RoiCalculator } from "@/components/landing/roi-calculator";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { ClosingCta } from "@/components/landing/closing-cta";
import {
  IntegrationBand,
  ProductFrame,
  MoonBand,
  NightFeature,
  Reveal,
} from "@/components/landing/experience";

export const metadata = {
  title: "LILY — Let your next opportunity bloom",
  description:
    "The autonomous B2B revenue pipeline for digital agencies. Verified, trigger-matched decision-makers and AI outreach delivered to your private workspace at 08:00 IST.",
};

export default function IndexPage() {
  return (
    <>
      {/* Outside the transition wrapper: the nav is sticky, and the wrapper's
          transform/animation would otherwise change its containing block. */}
      <SiteNav />
      <PageTransition className="marketing min-h-screen overflow-x-clip bg-background text-foreground">
        <main>
          <Hero />
          <IntegrationBand />
          <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-5 border-b border-border px-6 py-8 text-[11px] text-muted-foreground">
            <span className="text-primary">Built for the agency side of the table</span>
            {[
              "Performance marketing",
              "Web & product studios",
              "B2B SaaS",
              "Design partnerships",
              "Talent & staffing",
              "Ecommerce growth",
            ].map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
          <Reveal>
            <Pillars />
          </Reveal>
          <MoonBand />
          <Reveal>
            <Engine />
          </Reveal>
          <ProductFrame />
          <NightFeature />
          <Reveal>
            <RoiCalculator />
          </Reveal>
          <Reveal>
            <Pricing />
          </Reveal>
          <Reveal>
            <Faq />
          </Reveal>
          <Reveal>
            <ClosingCta />
          </Reveal>
        </main>
        <Footer />
      </PageTransition>
    </>
  );
}

