import { ProfileForm } from "@/components/app/profile-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile — Potential",
};

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="text-[13px] font-medium tracking-[0.16em] text-muted uppercase">
        Profile
      </p>
      <h1 className="mt-3 text-4xl font-medium tracking-[-0.04em] text-ink">
        How Potential should know you
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-6 text-ink-soft">
        Name, units, and timezone. Training answers stay here too — they are
        not something a file can tell us.
      </p>
      <div className="mt-10">
        <ProfileForm />
      </div>
    </main>
  );
}
