export const ACTIVITY_PARAM = "activity";
export const COMPARE_PARAM = "compare";
export const RACE_RESULT_PARAM = "raceResult";

export function activityModalHref(
  pathname: string,
  search: string,
  id: string,
): string {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  params.delete(COMPARE_PARAM);
  params.set(ACTIVITY_PARAM, id);
  return `${pathname}?${params.toString()}`;
}

export function stripActivityParam(pathname: string, search: string): string {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  params.delete(ACTIVITY_PARAM);
  params.delete(RACE_RESULT_PARAM);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
