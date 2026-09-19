import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Coming soon — Ahead",
  description: "Ahead is in a private test. Sign up opens soon.",
};

export default function SignupComingSoonPage() {
  return (
    <div>
      <p className="text-[13px] font-medium tracking-[0.16em] text-muted uppercase">
        Invite only
      </p>
      <h1 className="mt-3 text-4xl font-medium tracking-[-0.04em] text-ink">
        Sign up is coming soon
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-7 text-ink-soft">
        Ahead is in a private test with family and friends. Public accounts
        aren’t open yet.
      </p>
      <p className="mt-8">
        <Link href="/login" className="home-cta home-cta-sm">
          Log in
        </Link>
      </p>
      <p className="mt-6 text-sm text-muted">
        Already invited? Use the log in link we sent you.
      </p>
    </div>
  );
}
