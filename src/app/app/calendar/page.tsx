import { redirect } from "next/navigation";

export default async function CalendarRedirect({
  searchParams,
}: PageProps<"/app/calendar">) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
    } else if (value) {
      query.set(key, value);
    }
  }
  const suffix = query.toString();
  redirect(suffix ? `/app/activities?${suffix}` : "/app/activities");
}
