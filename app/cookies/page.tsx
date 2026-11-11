import { Cookie, Shield, CheckCircle2 } from "lucide-react";
import { SiteNav, Footer } from "@/components/landing/site-chrome";
import { PageTransition } from "@/components/lily/page-transition";

export const metadata = {
  title: "Cookies Policy · LILY CRM",
  description: "Minimal essential session cookies used to authenticate your private LILY CRM workspace.",
};

export default function CookiesPage() {
  return (
    <div className="marketing min-h-screen bg-background text-foreground">
      <SiteNav />
      <PageTransition>
        <main className="mx-auto max-w-3xl px-6 pt-36 pb-24 sm:pt-44">
          <div className="flex items-center gap-2 text-xs font-mono text-foreground mb-3">
            <Cookie className="size-3.5" />
            <span>SESSION & SECURITY</span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-semibold tracking-tight text-foreground">
            Cookie Policy
          </h1>
          <p className="mt-2 text-xs font-mono text-muted-foreground">
            Zero third-party tracking · Essential authenticated sessions only
          </p>

          <div className="mt-10 space-y-10 text-[14px] leading-relaxed text-muted-foreground">
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Shield className="size-4 text-foreground" />
                <span>1. Zero Marketing Tracking / Third-Party Spyware</span>
              </h2>
              <p>
                LILY CRM does not use advertising cookies, third-party pixel trackers, Facebook Pixel, or cross-site data aggregators. We believe high-performing agency pipelines require privacy and speed, not ad surveillance.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" />
                <span>2. Strictly Necessary Authentication Cookies</span>
              </h2>
              <p>
                We only set first-party HTTP-only session cookies required to verify your sign-in identity and preserve your active workspace state across page refreshes:
              </p>
              <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="border-b border-border bg-surface text-muted-foreground">
                    <tr>
                      <th className="p-3">Cookie Key</th>
                      <th className="p-3">Purpose</th>
                      <th className="p-3">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-muted-foreground">
                    <tr>
                      <td className="p-3 text-foreground">sb-*-auth-token</td>
                      <td className="p-3">LILY encrypted authentication session token</td>
                      <td className="p-3">Session / 30 Days</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-foreground">lily_theme</td>
                      <td className="p-3">Workspace theme preference (Dark / Light)</td>
                      <td className="p-3">1 Year</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                3. Managing Cookie Preferences
              </h2>
              <p>
                You can disable cookies entirely within your browser settings. However, disabling session cookies will prevent secure login to your private CRM workspace.
              </p>
            </section>

            <section className="pt-6 border-t border-border text-xs text-muted-foreground font-mono">
              Direct privacy inquiries:{" "}
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

