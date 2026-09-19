import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Onboarding — Ahead",
};

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Loading…</div>}>
      <OnboardingFlow />
    </Suspense>
  );
}
