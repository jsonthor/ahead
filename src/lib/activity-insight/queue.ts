import { ensureActivityInsight } from "@/lib/activity-insight/ensure";
import { isRecentActivity } from "@/lib/activity-insight/eligible";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateInsightsForNewActivities(input: {
  athleteId: string;
  timeZone: string;
  activities: { id: string; startedAt: string }[];
}) {
  const recent = input.activities.filter((row) => isRecentActivity(row.startedAt)).slice(0, 3);
  if (recent.length === 0) {
    return;
  }
  const admin = createAdminClient();
  for (const activity of recent) {
    try {
      await ensureActivityInsight({
        client: admin,
        athleteId: input.athleteId,
        activityId: activity.id,
        timeZone: input.timeZone,
      });
    } catch (error) {
      console.error("Activity Insight after import failed", {
        activityId: activity.id,
        error,
      });
    }
  }
}
