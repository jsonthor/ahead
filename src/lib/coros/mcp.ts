import type { CallToolResult, Client } from "@modelcontextprotocol/client";
import { parseToolJson } from "@/lib/coros/map";

type SchemaProp = {
  description?: string;
  format?: string;
  type?: string | string[];
  items?: { type?: string };
};

export function schemaProps(schema: unknown): Record<string, SchemaProp> {
  if (!schema || typeof schema !== "object") {
    return {};
  }
  const props = (schema as { properties?: Record<string, SchemaProp> }).properties;
  return props ?? {};
}

export function schemaKeys(schema: unknown): string[] {
  return Object.keys(schemaProps(schema));
}

function isArrayProp(prop: SchemaProp | undefined) {
  if (!prop) {
    return false;
  }
  const type = prop.type;
  return type === "array" || (Array.isArray(type) && type.includes("array"));
}

/** COROS label IDs are often 18 digits — larger than JS safe integers. */
export function corosIdValue(id: string): string | number {
  if (/^\d+$/.test(id) && id.length <= 15) {
    return Number(id);
  }
  return id;
}

export function dateArg(
  schema: unknown,
  key: string,
  daysAgo: number,
  compact = false,
) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  const iso = date.toISOString().slice(0, 10);
  const hint = `${key} ${schemaProps(schema)[key]?.description ?? ""} ${schemaProps(schema)[key]?.format ?? ""}`.toLowerCase();
  if (compact || hint.includes("yyyymmdd") || hint.includes("compact")) {
    return iso.replaceAll("-", "");
  }
  return iso;
}

export function argsForDateRange(
  schema: unknown,
  startDaysAgo: number,
  endDaysAgo = 0,
  extras: {
    timezone?: string;
    limit?: number;
    page?: number;
    offset?: number;
    compactDates?: boolean;
  } = {},
) {
  const keys = schemaKeys(schema);
  const args: Record<string, unknown> = {};
  const compact = extras.compactDates === true;
  for (const key of keys) {
    const lower = key.toLowerCase();
    if (
      (lower.includes("start") || lower === "from" || lower === "begin" || lower === "fromdate") &&
      (lower.includes("date") || lower.includes("day") || lower.includes("time") || lower === "from" || lower === "begin")
    ) {
      args[key] = dateArg(schema, key, startDaysAgo, compact);
    } else if (
      (lower.includes("end") || lower === "to" || lower === "todate") &&
      (lower.includes("date") || lower.includes("day") || lower.includes("time") || lower === "to")
    ) {
      args[key] = dateArg(schema, key, endDaysAgo, compact);
    } else if (lower === "from" || lower === "begin" || lower === "fromdate") {
      args[key] = dateArg(schema, key, startDaysAgo, compact);
    } else if (lower === "to" || lower === "todate") {
      args[key] = dateArg(schema, key, endDaysAgo, compact);
    } else if (lower === "timezone") {
      args[key] = extras.timezone ?? "Europe/London";
    } else if (lower === "days") {
      const requested = extras.limit ?? Math.max(1, startDaysAgo - endDaysAgo + 1);
      const hint = `${schemaProps(schema)[key]?.description ?? ""}`.toLowerCase();
      const max = hint.match(/maximum\s+(\d+)/);
      args[key] = max ? Math.min(requested, Number(max[1])) : requested;
    } else if (
      ["limit", "size", "pagesize", "page_size", "count", "max", "maxresults", "pagesize"].includes(
        lower,
      ) &&
      extras.limit != null
    ) {
      args[key] = extras.limit;
    } else if (
      ["page", "pageno", "pagenum", "pagenumber", "pageindex"].includes(lower) &&
      extras.page != null
    ) {
      args[key] = extras.page;
    } else if ((lower === "offset" || lower === "skip") && extras.offset != null) {
      args[key] = extras.offset;
    } else if (lower === "page" && extras.page == null && extras.limit != null) {
      args[key] = 1;
    }
  }
  return args;
}

export function argsForActivity(
  schema: unknown,
  record: Record<string, unknown>,
  id: string | null,
) {
  const keys = schemaKeys(schema);
  const props = schemaProps(schema);
  const args: Record<string, unknown> = {};
  const sport = record.sportType ?? record.sport_type ?? record.SportType;
  for (const key of keys) {
    const lower = key.toLowerCase();
    const prop = props[key];
    if (
      ["activityid", "activity_id", "id", "labelid", "label_id", "sportrecordid"].includes(lower) &&
      id
    ) {
      args[key] = isArrayProp(prop) ? [corosIdValue(id)] : corosIdValue(id);
    } else if (
      ["activityids", "labelids", "ids", "sportrecordids"].includes(lower) &&
      id
    ) {
      args[key] = [corosIdValue(id)];
    } else if (["sporttype", "sport_type", "sporttypecode"].includes(lower) && sport != null) {
      args[key] = Number.isFinite(Number(sport)) ? Number(sport) : sport;
    }
  }
  if (Object.keys(args).length === 0 && id) {
    args.labelId = id;
    if (sport != null) {
      args.sportType = Number.isFinite(Number(sport)) ? Number(sport) : sport;
    }
  }
  return args;
}

export async function callToolResult(
  client: Client,
  name: string,
  args: Record<string, unknown>,
  retries = 3,
): Promise<CallToolResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const result = await client.callTool({ name, arguments: args });
      if (result.isError) {
        lastError = result;
        console.error("COROS tool error", {
          name,
          args,
          content: result.content,
          structured: result.structuredContent,
        });
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        continue;
      }
      return result;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`COROS ${name} failed.`);
}

export async function callToolJson(
  client: Client,
  name: string,
  args: Record<string, unknown>,
) {
  return parseToolJson(await callToolResult(client, name, args));
}
