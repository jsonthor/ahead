import { CorosImport } from "@/components/app/coros-import";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Importing COROS — Potential",
};

export default function CorosImportPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-16">
          <p className="text-sm text-muted">Connecting to COROS…</p>
        </main>
      }
    >
      <CorosImport />
    </Suspense>
  );
}
