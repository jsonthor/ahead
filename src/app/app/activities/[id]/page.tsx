import { redirect } from "next/navigation";

export default async function ActivityPage({
  params,
}: PageProps<"/app/activities/[id]">) {
  const { id } = await params;
  redirect(`/app/activities?activity=${encodeURIComponent(id)}`);
}
