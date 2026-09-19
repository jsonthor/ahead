import { ACTIVITY_PARAM, COMPARE_PARAM } from "@/lib/activity-modal";

export { COMPARE_PARAM };
export const COMPARE_MAX = 4;
export const COMPARE_CLOSED_EVENT = "ahead:compare-closed";

export function notifyCompareClosed() {
  window.dispatchEvent(new Event(COMPARE_CLOSED_EVENT));
}

export const COMPARE_TONES = [
  { swatch: "bg-forest", ring: "border-forest", text: "text-forest" },
  { swatch: "bg-ember", ring: "border-ember", text: "text-ember" },
  { swatch: "bg-steel", ring: "border-steel", text: "text-steel" },
  { swatch: "bg-ink", ring: "border-ink", text: "text-ink" },
] as const;

export const COMPARE_STROKES = [
  "var(--forest)",
  "var(--ember)",
  "var(--steel)",
  "var(--ink)",
] as const;

function searchParams(search: string) {
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

export function parseCompareIds(search: string): string[] {
  const raw = searchParams(search).get(COMPARE_PARAM);
  if (!raw) {
    return [];
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
    if (ids.length >= COMPARE_MAX) {
      break;
    }
  }
  return ids;
}

export function compareHref(pathname: string, search: string, ids: string[]): string {
  const params = searchParams(search);
  params.delete(ACTIVITY_PARAM);
  const next = ids.filter(Boolean).slice(0, COMPARE_MAX);
  if (next.length === 0) {
    params.delete(COMPARE_PARAM);
  } else {
    params.set(COMPARE_PARAM, next.join(","));
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function stripCompareParam(pathname: string, search: string): string {
  return compareHref(pathname, search, []);
}

export function toggleCompareId(ids: string[], id: string): string[] {
  if (ids.includes(id)) {
    return ids.filter((entry) => entry !== id);
  }
  if (ids.length >= COMPARE_MAX) {
    return ids;
  }
  return [...ids, id];
}
