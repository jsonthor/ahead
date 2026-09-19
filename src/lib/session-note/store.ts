import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/database.types";
import { composeSessionNote } from "@/lib/session-note/compose";
import {
  loadSessionPacket,
  type SessionActivityInput,
} from "@/lib/session-note/packet";
import {
  SESSION_NOTE_VERSION,
  type SessionNote,
  type SessionNoteContext,
} from "@/lib/session-note/types";
import type { CalendarEvent } from "@/lib/calendar-event";

let openNote: SessionNote | null = null;

export function setOpenSessionNote(note: SessionNote | null) {
  openNote = note;
}

export function getOpenSessionNote() {
  return openNote;
}

export function sessionNoteContext(note: SessionNote | null): SessionNoteContext | null {
  if (!note) {
    return null;
  }
  return {
    activityId: note.activityId,
    title: note.title,
    date: note.date,
    role: note.role,
    reading: note.reading,
    planned: note.planned,
    landed: note.landed,
    week: note.week,
    route: note.route,
    intensityStatus: note.intensityStatus,
    review: note.review,
  };
}

function asNote(value: unknown): SessionNote | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as SessionNote;
  if (!row.activityId || !row.reading || row.version !== SESSION_NOTE_VERSION) {
    return null;
  }
  return row;
}

export async function loadStoredSessionNote(activityId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("activity_session_notes")
    .select("note")
    .eq("activity_id", activityId)
    .maybeSingle();
  if (error) {
    console.error("Load session note failed", error);
    return null;
  }
  return asNote(data?.note);
}

export async function saveSessionNote(athleteId: string, note: SessionNote) {
  const supabase = createClient();
  const { error } = await supabase.from("activity_session_notes").upsert({
    activity_id: note.activityId,
    athlete_id: athleteId,
    note: note as unknown as Json,
    composed_at: note.composedAt,
  });
  if (error) {
    console.error("Save session note failed", error);
  }
}

export async function ensureSessionNote(input: {
  athleteId: string;
  timeZone: string;
  activity: SessionActivityInput;
  event: CalendarEvent | null;
}) {
  const packet = await loadSessionPacket(input);
  const next = composeSessionNote(packet);
  const stored = await loadStoredSessionNote(input.activity.id);
  if (stored && stored.fingerprint === next.fingerprint) {
    setOpenSessionNote(stored);
    return stored;
  }
  await saveSessionNote(input.athleteId, next);
  setOpenSessionNote(next);
  return next;
}
