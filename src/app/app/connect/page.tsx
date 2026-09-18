import { BrandConnect } from "@/components/onboarding/brand-connect";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Connect training — Ahead",
};

export default function ConnectPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="text-[13px] font-medium tracking-[0.16em] text-muted uppercase">
        Connect
      </p>
      <h1 className="mt-3 text-4xl font-medium tracking-[-0.04em] text-ink">
        Whose data should Ahead learn from?
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-6 text-ink-soft">
        COROS and file upload are live. Garmin, Polar, and the rest are
        coming soon.
      </p>
      <div className="mt-8">
        <Suspense fallback={<div className="text-sm text-muted">Loading…</div>}>
          <BrandConnect returnTo="/app/connect" />
        </Suspense>
      </div>
    </main>
  );
}
