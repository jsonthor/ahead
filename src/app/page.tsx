import Link from "next/link";

import { HomeFaq } from "@/components/home/faq";
import { HomeFooter } from "@/components/home/footer";
import { HomeHeader } from "@/components/home/header";
import { HomeHero } from "@/components/home/hero";
import { HomePhoto } from "@/components/home/photo";
import { HomeHistory } from "@/components/home/history";
import { HomeIngest } from "@/components/home/ingest";
import { HomeMemory } from "@/components/home/memory";
import { HomeMetrics } from "@/components/home/metrics";
import { HomeProviders } from "@/components/home/providers";
import { HomeQuestions } from "@/components/home/questions";
import { HomeReveal } from "@/components/home/reveal";
import { HomeTalk } from "@/components/home/talk";
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
          <HomeTalk />
          <HomeQuestions />
          <HomeHistory />
          <HomeReveal>
            <HomeMemory />
          </HomeReveal>
          <HomeReveal>
            <HomeMetrics />
          </HomeReveal>
          <HomeIngest />
          <HomeReveal>
            <HomeTrust />
          </HomeReveal>
          <HomeFaq />

          <section className="relative min-h-[76vh] overflow-hidden">
            <HomePhoto
              src="/home/after.jpg"
              alt="An athlete sitting beside a bike after a session"
              objectPosition="70% 45%"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/20" />
            <div className="relative z-10 mx-auto flex min-h-[76vh] max-w-[1470px] flex-col items-start justify-end px-4 py-24 sm:px-6 lg:px-8 lg:py-28">
              <h2 className="home-display max-w-4xl text-[clamp(3rem,6vw,7.2rem)] text-white">
                Stop guessing whether
                <span className="block">the work is working.</span>
              </h2>
              <p className="mt-8 max-w-md text-[17px] leading-8 text-white/70">
                Connect your training. Add your races. Ask Ahead.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-5">
                <Link href="/signup" className="home-cta">
                  Coming soon
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center text-[14px] text-white/60 hover:text-white"
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
