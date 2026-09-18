import type { WorkoutSport } from "@/lib/workout";

export function sportFromLabel(value: string | null | undefined): WorkoutSport {
  const lower = (value ?? "").toLowerCase();
  if (/triathlon|duathlon|brick/.test(lower)) {
    return "triathlon";
  }
  if (/run|jog|trail/.test(lower)) {
    return "run";
  }
  if (/cycl|bike|ride|gravel|mtb|zwift|indoor.?cycle/.test(lower)) {
    return "ride";
  }
  if (/swim|pool|open.?water/.test(lower)) {
    return "swim";
  }
  if (/walk|hike|ruck/.test(lower)) {
    return "walk";
  }
  if (/row|erg/.test(lower)) {
    return "row";
  }
  if (/ski|xc ski|roller.?ski/.test(lower)) {
    return "ski";
  }
  if (/strength|weight|gym|lift|training/.test(lower)) {
    return "strength";
  }
  return "other";
}
