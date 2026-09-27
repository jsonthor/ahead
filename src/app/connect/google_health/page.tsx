import { GoogleHealthImport } from "@/components/app/google-health-import";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Google Health — Ahead",
};

export default function GoogleHealthConnectPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-16">
          <p className="text-sm text-muted">Connecting to Google Health…</p>
        </main>
      }
    >
      <GoogleHealthImport />
    </Suspense>
  );
}
