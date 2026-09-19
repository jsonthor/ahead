import { daysSince } from "@/lib/coach-review/period";
import { formatDuration } from "@/lib/units";
import { workoutSportLabel } from "@/lib/workout";
import { sessionRole, type SessionPacket } from "@/lib/session-note/packet";
import {
  SESSION_NOTE_VERSION,
  type SessionNote,
  type SessionRole,
} from "@/lib/session-note/types";

function rolePhrase(role: SessionRole) {
  if (role === "race") {
    return "a race";
  }
  if (role === "opener") {
    return "an opener";
  }
  if (role === "main-stress") {
    return "the week's main training stress";
  }
  if (role === "easy-contrast") {
    return "an easier contrast in the week";
  }
  if (role === "aerobic") {
    return "aerobic work";
  }
  if (role === "quality") {
    return "the midweek quality session";
  }
  return "a session";
}

function mixPhrase(mix: SessionPacket["mix"]) {
  if (mix === "specific") {
    return "mostly specific work rather than easy aerobic volume";
  }
  if (mix === "easy") {
    return "mostly easy aerobic work";
  }
  if (mix === "mixed") {
    return "a mix of easy and specific work";
  }
  return null;
}

function sportWord(sport: string) {
  if (sport === "run" || sport === "ride" || sport === "walk" || sport === "swim") {
    return sport;
  }
  return workoutSportLabel(sport as "run").toLowerCase();
}

function raceEveLine(packet: SessionPacket, role: SessionRole) {
  if (!packet.nextRace || role === "race") {
    return null;
  }
  if (daysSince(packet.date, packet.nextRace.date) !== 1) {
    return null;
  }
  return `Arrive fresh for ${packet.nextRace.title} tomorrow. Keep today light; do not add training to make up for anything before the race.`;
}

function reviewHook(packet: SessionPacket, role: SessionRole) {
  const eve = raceEveLine(packet, role);
  if (eve) {
    return eve;
  }
  const review = packet.review;
  if (!review) {
    return null;
  }
  const keep = review.nextKeep.join(" ").toLowerCase();
  const change = review.nextChange.join(" ").toLowerCase();
  if (role === "opener" && /opener/.test(change)) {
    return "Kept as preparation, not another hard session — as we said for Friday openers.";
  }
  if (role === "aerobic" && /aerobic/.test(keep)) {
    return "This is the aerobic session we said to keep in the week.";
  }
  if ((role === "quality" || role === "main-stress") && /quality|coached/.test(keep)) {
    return "This is the midweek quality role we said to keep when recovery allows.";
  }
  return null;
}

export function fingerprintSessionPacket(packet: SessionPacket, role: SessionRole) {
  return [
    SESSION_NOTE_VERSION,
    packet.activityId,
    packet.load ?? "",
    packet.durationSeconds ?? "",
    packet.mix,
    packet.planned?.load ?? "",
    packet.planned?.purpose ?? "",
    role,
    packet.week.sessions.map((row) => `${row.id}:${row.load ?? ""}`).join(","),
    packet.route?.versusTypical ?? "",
    packet.review?.reviewId ?? "",
    packet.nextRace ? `${packet.nextRace.date}:${packet.nextRace.title}` : "",
    packet.intensityStatus,
  ].join("|");
}

export function composeSessionNote(packet: SessionPacket): SessionNote {
  const role = sessionRole(packet);
  const duration = formatDuration(packet.durationSeconds);
  const load = packet.load != null ? `${Math.round(packet.load)} load` : null;
  const mix = mixPhrase(packet.mix);
  const facts = [duration, load, mix].filter(Boolean).join(", ");
  const opening = facts
    ? `${packet.weekday}'s ${sportWord(packet.sport)} was ${rolePhrase(role)}: ${facts}.`
    : `${packet.weekday}'s ${sportWord(packet.sport)} was ${rolePhrase(role)}.`;

  const sentences = [opening];

  if (packet.planned?.purpose && !packet.race) {
    sentences.push(`The diary had this as ${packet.planned.purpose.replace(/\.$/, "")}.`);
  } else if (packet.planned && packet.race) {
    sentences.push("This was the planned race.");
  }

  if (
    packet.planned?.load != null &&
    packet.load != null &&
    packet.planned.load > 0 &&
    Math.abs(packet.load - packet.planned.load) / packet.planned.load >= 0.2
  ) {
    sentences.push(
      `Landed ${Math.round(packet.load)} load against ${Math.round(packet.planned.load)} planned.`,
    );
  }

  if (packet.route?.versusTypical) {
    sentences.push(`Same roads: ${packet.route.versusTypical}.`);
  }

  const hook = reviewHook(packet, role);
  if (hook) {
    sentences.push(hook);
  }

  return {
    version: SESSION_NOTE_VERSION,
    activityId: packet.activityId,
    fingerprint: fingerprintSessionPacket(packet, role),
    composedAt: new Date().toISOString(),
    title: packet.title,
    date: packet.date,
    role,
    reading: sentences.join(" "),
    planned: packet.planned,
    landed: {
      minutes:
        packet.durationSeconds != null ? Math.round(packet.durationSeconds / 60) : null,
      load: packet.load,
      mix: packet.mix,
      intensity: packet.intensity,
      race: packet.race,
    },
    week: {
      start: packet.week.start,
      end: packet.week.end,
      sessionCount: packet.week.sessions.length,
      peakLoad: packet.week.sessions.reduce<number | null>((peak, row) => {
        if (row.load == null) {
          return peak;
        }
        return peak == null || row.load > peak ? row.load : peak;
      }, null),
    },
    route: packet.route,
    intensityStatus: packet.intensityStatus,
    review: packet.review
      ? {
          reviewId: packet.review.reviewId,
          immediatePriority: packet.review.immediatePriority,
          nextObjective: packet.review.nextObjective,
        }
      : null,
  };
}
