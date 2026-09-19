import { ZonesForm } from "@/components/app/zones-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zones — Ahead",
};

export default function ZonesPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="kicker">Zones</p>
      <h1 className="title mt-3 text-ink">How Ahead should read your intensity</h1>
      <p className="lede mt-3 max-w-xl">
        Threshold heart rate first, maximum heart rate as a fallback. Ahead
        estimates these from your files. You can overwrite them.
      </p>
      <div className="mt-10">
        <ZonesForm />
      </div>
    </main>
  );
}
