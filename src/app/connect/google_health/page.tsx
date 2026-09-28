import { GoogleHealthImport } from "@/components/app/google-health-import";
import { safeReturnPath } from "@/lib/oauth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Google Health — Ahead",
};

export default async function GoogleHealthConnectPage({
  searchParams,
}: PageProps<"/connect/google_health">) {
  const query = await searchParams;
  const returnPath = safeReturnPath(
    typeof query.return === "string" ? query.return : "/app/connect",
  );
  return <GoogleHealthImport returnPath={returnPath} />;
}
