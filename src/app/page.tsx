import Link from "next/link";

import { HomeAsk, HomeApplyDemo } from "@/components/home/apply-demo";
import { HomeFaq } from "@/components/home/faq";
import { HomeFooter } from "@/components/home/footer";
import { HomeHeader } from "@/components/home/header";
import { HomeHero } from "@/components/home/hero";
import { HomeHistory } from "@/components/home/history";
import { HomeIngest } from "@/components/home/ingest";
import { HomeMemory } from "@/components/home/memory";
import { HomeMetrics } from "@/components/home/metrics";
import { HomeProviders } from "@/components/home/providers";
import { HomeQuestions } from "@/components/home/questions";
import { HomeReveal } from "@/components/home/reveal";
import { HomeTrust } from "@/components/home/trust";

export default function Home() {
  return (
    <div className="home">
      <HomeProviders>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-[var(--home-surface-3)] focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <HomeHeader />

        <main id="main">
          <HomeHero />

          <HomeReveal>
            <HomeQuestions />
          </HomeReveal>
          <HomeReveal>
            <HomeAsk />
          </HomeReveal>
          <HomeReveal>
            <HomeHistory />
          </HomeReveal>
          <HomeReveal>
            <HomeApplyDemo />
          </HomeReveal>
          <HomeReveal>
            <HomeMemory />
          </HomeReveal>
          <HomeReveal>
            <HomeMetrics />
          </HomeReveal>
          <HomeReveal>
            <HomeIngest />
          </HomeReveal>
          <HomeReveal>
            <HomeTrust />
          </HomeReveal>
          <HomeReveal>
            <HomeFaq />
          </HomeReveal>

          <section className="border-t border-[var(--home-border)] px-4 py-28 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[1360px] flex-col items-start gap-10 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-5xl leading-[0.94] font-medium tracking-[-0.05em] text-[var(--home-text)] sm:text-7xl">
                  Stop guessing whether
                  <span className="mt-2 block">the work is working.</span>
                </h2>
                <p className="mt-7 max-w-lg text-[18px] leading-8 text-[var(--home-text-2)]">
                  Connect your training. Add your races. Ask Ahead.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Link href="/signup" className="home-cta">
                  Coming soon
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center text-sm text-[var(--home-text-2)] hover:text-[var(--home-text)]"
                >
                  Log in
                </Link>
              </div>
            </div>
          </section>
        </main>

        <HomeFooter />
      </HomeProviders>
    </div>
  );
}
