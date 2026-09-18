import type { UserClient } from "./client.ts";
import {
  restorePayload,
  secondsFrom,
  workoutPayload,
  type CalendarOperation,
  type ItemSnapshot,
} from "./operations.ts";

function asItem(row: ItemSnapshot | null): ItemSnapshot | null {
  if (!row?.id) {
    return null;
  }
  return row;
}

export type ApplyResult = {
  createdIds: string[];
};

async function insertItem(client: UserClient, payload: Record<string, unknown>) {
  const { data, error } = await client
    .from("calendar_items")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Could not create the session.");
  }
  return data.id as string;
}

export async function applyOperations(
  client: UserClient,
  athleteId: string,
  operations: CalendarOperation[],
  snapshot: ItemSnapshot[],
): Promise<ApplyResult> {
  const byId = new Map(snapshot.map((item) => [item.id, item]));
  const createdIds: string[] = [];

  for (const op of operations) {
    if (op.type === "move_session" || op.type === "update_session" || op.type === "delete_session") {
      const { data, error } = await client
        .from("calendar_items")
        .select("id, date, title, updated_at")
        .eq("id", op.sessionId)
        .maybeSingle();
      if (error) {
        throw new Error(error.message);
      }
      const current = asItem(data as ItemSnapshot | null);
      if (!current) {
        throw new Error(`Session ${op.sessionId.slice(0, 8)} is no longer on the calendar.`);
      }
      const expected = byId.get(op.sessionId);
      if (expected && expected.updated_at && expected.updated_at !== current.updated_at) {
        throw new Error("The calendar changed since this proposal. Ask Ahead again.");
      }
    }

    if (op.type === "create_session") {
      const id = await insertItem(client, {
        athlete_id: athleteId,
        date: op.date,
        sport: op.session.sport,
        title: op.session.title,
        intent: op.session.intent,
        importance: op.session.importance,
        planned_seconds: secondsFrom(op.session.durationMinutes),
        planned_distance_m: op.session.distanceM,
        planned_load: op.session.expectedLoad,
        purpose: op.session.purpose,
        notes: op.session.notes,
        workout: workoutPayload(op.session),
        created_by: "potential_ai",
      });
      createdIds.push(id);
    } else if (op.type === "create_rest") {
      const id = await insertItem(client, {
        athlete_id: athleteId,
        date: op.date,
        sport: "other",
        title: "Rest",
        intent: "training",
        notes: "Rest day",
        created_by: "potential_ai",
      });
      createdIds.push(id);
    } else if (op.type === "create_race") {
      const id = await insertItem(client, {
        athlete_id: athleteId,
        date: op.date,
        sport: op.sport,
        title: op.title,
        intent: "race",
        importance: op.importance,
        planned_seconds: secondsFrom(op.durationMinutes),
        created_by: "potential_ai",
      });
      createdIds.push(id);
    } else if (op.type === "move_session") {
      const { error } = await client
        .from("calendar_items")
        .update({ date: op.to })
        .eq("id", op.sessionId);
      if (error) {
        throw new Error(error.message);
      }
    } else if (op.type === "update_session") {
      const patch: Record<string, unknown> = {};
      if (op.date) {
        patch.date = op.date;
      }
      if (op.session?.sport) {
        patch.sport = op.session.sport;
      }
      if (op.session?.title) {
        patch.title = op.session.title;
      }
      if (op.session?.intent) {
        patch.intent = op.session.intent;
      }
      if (op.session?.importance !== undefined) {
        patch.importance = op.session.importance;
      }
      if (op.session?.durationMinutes !== undefined) {
        patch.planned_seconds = secondsFrom(op.session.durationMinutes);
      }
      if (op.session?.distanceM !== undefined) {
        patch.planned_distance_m = op.session.distanceM;
      }
      if (op.session?.expectedLoad !== undefined) {
        patch.planned_load = op.session.expectedLoad;
      }
      if (op.session?.purpose !== undefined) {
        patch.purpose = op.session.purpose;
      }
      if (op.session?.notes !== undefined) {
        patch.notes = op.session.notes;
      }
      if (op.session?.structure || op.session?.intensity || op.session?.purpose) {
        patch.workout = workoutPayload({
          structure: op.session.structure ?? null,
          intensity: op.session.intensity ?? null,
          purpose: op.session.purpose ?? null,
        });
      }
      const { error } = await client.from("calendar_items").update(patch).eq("id", op.sessionId);
      if (error) {
        throw new Error(error.message);
      }
    } else if (op.type === "delete_session") {
      const { error } = await client.from("calendar_items").delete().eq("id", op.sessionId);
      if (error) {
        throw new Error(error.message);
      }
    }
  }

  return { createdIds };
}

export async function undoOperations(
  client: UserClient,
  athleteId: string,
  operations: CalendarOperation[],
  snapshot: ItemSnapshot[],
  createdIds: string[],
) {
  const byId = new Map(snapshot.map((item) => [item.id, item]));
  let createCursor = createdIds.length - 1;

  for (const op of [...operations].reverse()) {
    if (op.type === "create_session" || op.type === "create_rest" || op.type === "create_race") {
      const id = createdIds[createCursor];
      createCursor -= 1;
      if (!id) {
        continue;
      }
      const { error } = await client.from("calendar_items").delete().eq("id", id);
      if (error) {
        throw new Error(error.message);
      }
      continue;
    }
    if (op.type === "delete_session") {
      const item = byId.get(op.sessionId);
      if (!item) {
        throw new Error("Could not restore the deleted session.");
      }
      const { error } = await client.from("calendar_items").insert(restorePayload(item, athleteId));
      if (error) {
        throw new Error(error.message);
      }
      continue;
    }
    if (op.type === "move_session" || op.type === "update_session") {
      const item = byId.get(op.sessionId);
      if (!item) {
        throw new Error("Could not restore the previous session.");
      }
      const restored = restorePayload(item, athleteId);
      const { id: _id, athlete_id: _athlete, ...patch } = restored;
      const { error } = await client.from("calendar_items").update(patch).eq("id", op.sessionId);
      if (error) {
        throw new Error(error.message);
      }
    }
  }
}
