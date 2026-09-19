import { InviteForm } from "@/components/auth/invite-form";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Accept invite — Ahead",
  robots: { index: false, follow: false },
};

export default function InvitePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Opening your invite…</p>}>
      <InviteForm />
    </Suspense>
  );
}
