import type { Json } from "@/lib/database.types";
import type { StreamPoint } from "@/lib/fit/parse";
import {
  bboxOf,
  bboxOverlaps,
  distanceWithin,
  DISTANCE_TOLERANCE,
  haversineMeters,
  resampleByDistance,
  sameDirection,
  startsOrEndsNear,
  symmetricOverlap,
  type LatLng,
  OVERLAP_MIN,
} from "@/lib/route/geometry";
import { createAdminClient } from "@/lib/supabase/admin";

function gpsPoints(stream: StreamPoint[]): LatLng[] {
  return stream.flatMap((point) =>
    point.lat != null && point.lng != null ? [{ lat: point.lat, lng: point.lng }] : [],
  );
}

function asPoints(value: Json): LatLng[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }
    const row = item as { lat?: unknown; lng?: unknown };
    if (typeof row.lat !== "number" || typeof row.lng !== "number") {
      return [];
    }
    return [{ lat: row.lat, lng: row.lng }];
  });
}

export function fingerprintFromStream(stream: StreamPoint[]) {
  const resampled = resampleByDistance(gpsPoints(stream));
  const start = resampled[0];
  const end = resampled[resampled.length - 1];
  const bbox = bboxOf(resampled);
  if (!start || !end || !bbox) {
    return null;
  }
  const distanceM = resampled.reduce((sum, point, index) => {
    if (index === 0) {
      return 0;
    }
    const prev = resampled[index - 1];
    return prev ? sum + haversineMeters(prev, point) : sum;
  }, 0);
  return {
    points: resampled,
    start,
    end,
    bbox,
    distanceM,
  };
}

export async function assignActivityRoute(input: {
  athleteId: string;
  activityId: string;
  sport: string;
  distanceM: number | null;
  elevationM: number | null;
  stream: StreamPoint[];
  replace?: boolean;
}) {
  const fingerprint = fingerprintFromStream(input.stream);
  if (!fingerprint) {
    return null;
  }
  const admin = createAdminClient();
  if (!input.replace) {
    const { data: existing } = await admin
      .from("activity_routes")
      .select("activity_id, route_cluster_id")
      .eq("activity_id", input.activityId)
      .maybeSingle();
    if (existing?.route_cluster_id) {
      return existing.route_cluster_id;
    }
  }

  const distanceM = input.distanceM && input.distanceM > 0 ? input.distanceM : fingerprint.distanceM;
  const row = {
    activity_id: input.activityId,
    athlete_id: input.athleteId,
    sport: input.sport,
    distance_m: distanceM,
    elevation_m: input.elevationM,
    start_lat: fingerprint.start.lat,
    start_lng: fingerprint.start.lng,
    end_lat: fingerprint.end.lat,
    end_lng: fingerprint.end.lng,
    bbox_min_lat: fingerprint.bbox.minLat,
    bbox_min_lng: fingerprint.bbox.minLng,
    bbox_max_lat: fingerprint.bbox.maxLat,
    bbox_max_lng: fingerprint.bbox.maxLng,
    points: fingerprint.points as unknown as Json,
  };

  const { error: upsertError } = await admin.from("activity_routes").upsert(row);
  if (upsertError) {
    console.error("Activity route fingerprint failed", upsertError);
    return null;
  }

  const low = distanceM * (1 - DISTANCE_TOLERANCE);
  const high = distanceM * (1 + DISTANCE_TOLERANCE);
  const { data: clusters, error: clusterError } = await admin
    .from("route_clusters")
    .select("id, representative_activity_id, typical_distance_m")
    .eq("athlete_id", input.athleteId)
    .eq("sport", input.sport)
    .gte("typical_distance_m", low)
    .lte("typical_distance_m", high);
  if (clusterError) {
    console.error("Route cluster lookup failed", clusterError);
  }

  const representativeIds = (clusters ?? [])
    .map((cluster) => cluster.representative_activity_id)
    .filter((id) => id !== input.activityId);
  let best:
    | {
        clusterId: string;
        overlap: number;
        direction: boolean;
      }
    | null = null;

  if (representativeIds.length > 0) {
    const { data: representatives } = await admin
      .from("activity_routes")
      .select(
        "activity_id, distance_m, start_lat, start_lng, end_lat, end_lng, bbox_min_lat, bbox_min_lng, bbox_max_lat, bbox_max_lng, points",
      )
      .in("activity_id", representativeIds);

    const here = {
      start: fingerprint.start,
      end: fingerprint.end,
      bbox: fingerprint.bbox,
    };

    for (const candidate of representatives ?? []) {
      if (!distanceWithin(distanceM, candidate.distance_m)) {
        continue;
      }
      const near = startsOrEndsNear(here, {
        start: { lat: candidate.start_lat, lng: candidate.start_lng },
        end: { lat: candidate.end_lat, lng: candidate.end_lng },
      });
      const box = bboxOverlaps(here.bbox, {
        minLat: candidate.bbox_min_lat,
        minLng: candidate.bbox_min_lng,
        maxLat: candidate.bbox_max_lat,
        maxLng: candidate.bbox_max_lng,
      });
      if (!near && !box) {
        continue;
      }
      const other = asPoints(candidate.points);
      if (other.length < 2) {
        continue;
      }
      const overlap = symmetricOverlap(fingerprint.points, other);
      const direction = sameDirection(fingerprint.points, other);
      if (overlap < OVERLAP_MIN || !direction) {
        continue;
      }
      if (!best || overlap > best.overlap) {
        const cluster = (clusters ?? []).find(
          (row) => row.representative_activity_id === candidate.activity_id,
        );
        if (cluster) {
          best = { clusterId: cluster.id, overlap, direction };
        }
      }
    }
  }

  let clusterId = best?.clusterId ?? null;
  const overlap = best?.overlap ?? 1;
  const direction = best?.direction ?? true;

  if (clusterId) {
    const { data: members } = await admin
      .from("activity_routes")
      .select("distance_m, elevation_m")
      .eq("route_cluster_id", clusterId);
    const distances = [...(members ?? []).map((member) => member.distance_m), distanceM];
    const elevations = [
      ...(members ?? []).map((member) => member.elevation_m).filter((value): value is number => value != null),
      ...(input.elevationM != null ? [input.elevationM] : []),
    ];
    const typicalDistance = distances.reduce((sum, value) => sum + value, 0) / distances.length;
    const typicalElevation =
      elevations.length > 0
        ? elevations.reduce((sum, value) => sum + value, 0) / elevations.length
        : null;
    const { error: updateClusterError } = await admin
      .from("route_clusters")
      .update({
        attempt_count: distances.length,
        typical_distance_m: typicalDistance,
        typical_elevation_m: typicalElevation,
      })
      .eq("id", clusterId);
    if (updateClusterError) {
      console.error("Route cluster update failed", updateClusterError);
    }
  } else {
    const { data: created, error: createError } = await admin
      .from("route_clusters")
      .insert({
        athlete_id: input.athleteId,
        sport: input.sport,
        representative_activity_id: input.activityId,
        typical_distance_m: distanceM,
        typical_elevation_m: input.elevationM,
        attempt_count: 1,
      })
      .select("id")
      .single();
    if (createError || !created) {
      console.error("Route cluster create failed", createError);
      return null;
    }
    clusterId = created.id;
  }

  const similarity = overlap;
  const { error: linkError } = await admin
    .from("activity_routes")
    .update({
      route_cluster_id: clusterId,
      route_similarity: Math.round(similarity * 1000) / 1000,
      route_overlap: Math.round(overlap * 1000) / 1000,
      direction_match: direction,
    })
    .eq("activity_id", input.activityId);
  if (linkError) {
    console.error("Activity route cluster link failed", linkError);
  }
  return clusterId;
}
