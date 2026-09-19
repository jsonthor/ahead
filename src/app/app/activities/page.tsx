import { WeekCalendar } from "@/components/app/week-calendar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activities — Ahead",
};

export default function ActivitiesPage() {
  return (
    <main className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6 lg:px-8">
      <WeekCalendar />
    </main>
  );
}
