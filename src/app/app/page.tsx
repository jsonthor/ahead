"use client";

import { DashboardMetrics } from "@/components/app/dashboard-metrics";
import { useAppUser } from "@/components/app/app-shell";
import { hourInZone } from "@/lib/calendar";

function greetingForNow(timeZone: string) {
  const hour = hourInZone(new Date(), timeZone);
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 17) {
    return "Good afternoon";
  }
  return "Good evening";
}

export default function AppHomePage() {
  const user = useAppUser();

  return (
    <main className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-[13px] font-medium tracking-[0.16em] text-muted uppercase">
        Dashboard
      </p>
      <h1 className="mt-3 text-4xl font-medium tracking-[-0.04em] text-ink">
        {greetingForNow(user.timezone)} {user.displayName}.
      </h1>
      <DashboardMetrics />
    </main>
  );
}
