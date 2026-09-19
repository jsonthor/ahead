import { ProfileForm } from "@/components/app/profile-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile — Ahead",
};

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="kicker">Profile</p>
      <h1 className="title mt-3 text-ink">
        How Ahead should know you
      </h1>
      <p className="lede mt-3 max-w-xl">
        Name, units, and timezone. Training answers stay here too — they are
        not something a file can tell us.
      </p>
      <div className="mt-10">
        <ProfileForm />
      </div>
    </main>
  );
}
