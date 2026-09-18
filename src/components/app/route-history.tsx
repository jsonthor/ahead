"use client";

import { useAppUser } from "@/components/app/app-shell";
import {
  formatSignedDuration,
  formatSignedHr,
  routeComparison,
  type RouteAttempt,
} from "@/lib/route/compare";
import { createClient } from "@/lib/supabase/client";
import { formatHms, formatPace, formatSpeed, type Units } from "@/lib/units";
import { useEffect, useState } from "react";

function rateLabel(mps: number | null, sport: string, units: Units) {
  if (sport === "ride") {
    return formatSpeed(mps, units);
  }
  return formatPace(mps, units);
}

function timesLine(sport: string, count: number) {
  if (sport === "run") {
    return `You've run this route ${count} times`;
  }
  if (sport === "walk") {
    return `You've walked this route ${count} times`;
  }
  if (sport === "ride") {
    return `You've ridden this route ${count} times`;
  }
  return `You've done this route ${count} times`;
}

export function RouteHistory({ activityId, sport }: { activityId: string; sport: string }) {
  const user = useAppUser();
  const [view, setView] = useState<ReturnType<typeof routeComparison> | null | undefined>(
    undefined,
  );

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    void (async () => {
      const { data: mine } = await supabase
        .from("activity_routes")
        .select("route_cluster_id, route_overlap")
        .eq("activity_id", activityId)
        .maybeSingle();
      if (cancelled) {
        return;
      }
      if (!mine?.route_cluster_id) {
        setView(null);
        return;
      }
      const [{ data: cluster }, { data: memberRows }] = await Promise.all([
        supabase
          .from("route_clusters")
          .select("attempt_count, typical_distance_m")
          .eq("id", mine.route_cluster_id)
          .maybeSingle(),
        supabase
          .from("activity_routes")
          .select("activity_id, route_overlap")
          .eq("route_cluster_id", mine.route_cluster_id),
      ]);
      if (cancelled) {
        return;
      }
      const ids = (memberRows ?? []).map((row) => row.activity_id);
      const { data: activityRows } = ids.length
        ? await supabase
            .from("activities")
            .select(
              "id, started_at, duration_seconds, moving_seconds, elapsed_seconds, distance_m, avg_hr, avg_speed_mps",
            )
            .in("id", ids)
        : { data: [] };
      if (cancelled) {
        return;
      }
      const byId = new Map((activityRows ?? []).map((row) => [row.id, row]));
      const attempts = (memberRows ?? []).flatMap((row) => {
        const activity = byId.get(row.activity_id);
        if (!activity) {
          return [];
        }
        return [
          {
            activityId: activity.id,
            startedAt: activity.started_at,
            durationSeconds: activity.duration_seconds,
            movingSeconds: activity.moving_seconds,
            elapsedSeconds: activity.elapsed_seconds,
            distanceM: activity.distance_m,
            avgHr: activity.avg_hr,
            avgSpeedMps: activity.avg_speed_mps,
            overlap: row.route_overlap,
          } satisfies RouteAttempt,
        ];
      });
      const current = attempts.find((attempt) => attempt.activityId === activityId);
      if (!current || (cluster?.attempt_count ?? attempts.length) < 2) {
        setView(null);
        return;
      }
      setView(
        routeComparison({
          current,
          attempts,
          typicalDistanceM: cluster?.typical_distance_m ?? null,
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  if (!view) {
    return null;
  }

  const timeDelta =
    view.timeDeltaSeconds != null ? formatSignedDuration(view.timeDeltaSeconds) : null;
  const hrDelta = view.hrDelta != null ? formatSignedHr(view.hrDelta) : null;

  return (
    <section className="mt-6 border border-line bg-paper-sunken px-4 py-4 sm:px-5">
      <p className="text-[13px] font-medium tracking-[0.16em] text-muted uppercase">
        This route
      </p>
      <h3 className="mt-2 text-lg font-medium tracking-[-0.03em] text-ink">
        {timesLine(sport, view.attemptCount)}
      </h3>
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-[12px] tracking-[0.14em] text-muted uppercase">Today</p>
          <p className="mt-1 text-ink">{formatHms(view.current.timeSeconds) ?? "—"}</p>
          <p className="text-ink-soft">{rateLabel(view.current.speedMps, sport, user.units) ?? "—"}</p>
          <p className="text-ink-soft">
            {view.current.avgHr != null ? `${view.current.avgHr} bpm` : "No HR"}
          </p>
        </div>
        <div>
          <p className="text-[12px] tracking-[0.14em] text-muted uppercase">Typical</p>
          <p className="mt-1 text-ink">{formatHms(view.typical.timeSeconds) ?? "—"}</p>
          <p className="text-ink-soft">{rateLabel(view.typical.speedMps, sport, user.units) ?? "—"}</p>
          <p className="text-ink-soft">
            {view.typical.avgHr != null ? `${view.typical.avgHr} bpm` : "No HR"}
          </p>
        </div>
      </div>
      {timeDelta || hrDelta ? (
        <p className="mt-4 text-[15px] text-ink">
          {[timeDelta, hrDelta].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {view.similarHr ? (
        <p className="mt-2 text-sm text-ink-soft">
          Compared with {view.similarHr.count} attempts at a similar heart rate:{" "}
          {view.similarHr.fasterPct >= 0 ? `${view.similarHr.fasterPct}% faster` : `${Math.abs(view.similarHr.fasterPct)}% slower`}{" "}
          than your median.
        </p>
      ) : null}
      {view.comparability.caution ? (
        <p className="mt-2 text-sm text-muted">
          Treat this comparison with caution: {view.comparability.reasons.join(", ")}.
        </p>
      ) : null}
    </section>
  );
}
