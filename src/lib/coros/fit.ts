import type { CallToolResult } from "@modelcontextprotocol/client";

const FIT_MAGIC = Buffer.from(".FIT");

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function looksLikeFit(bytes: Buffer) {
  if (bytes.length < 14) {
    return false;
  }
  return bytes.subarray(8, 12).equals(FIT_MAGIC);
}

function fromBase64(value: string): Buffer | null {
  try {
    const bytes = Buffer.from(value, "base64");
    return bytes.length > 0 ? bytes : null;
  } catch {
    return null;
  }
}

function collectUrls(value: unknown, into: string[]) {
  if (typeof value === "string") {
    for (const match of value.matchAll(/https?:\/\/[^\s"'<>\\]+/gi)) {
      into.push(match[0].replace(/[),.;]+$/, ""));
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectUrls(item, into));
    return;
  }
  const record = asRecord(value);
  if (!record) {
    return;
  }
  for (const [key, item] of Object.entries(record)) {
    if (/url|uri|href|link/i.test(key) && typeof item === "string") {
      into.push(item);
    }
    collectUrls(item, into);
  }
}

async function fetchFit(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    return looksLikeFit(bytes) || bytes.length > 200 ? bytes : null;
  } catch {
    return null;
  }
}

export function extractFitBytes(result: CallToolResult): Buffer | null {
  for (const block of result.content ?? []) {
    const row = block as {
      type?: string;
      text?: string;
      data?: string;
      mimeType?: string;
      uri?: string;
      blob?: string;
      resource?: {
        uri?: string;
        blob?: string;
        mimeType?: string;
        text?: string;
      };
    };
    if (row.resource?.blob) {
      const bytes = fromBase64(row.resource.blob);
      if (bytes) {
        return bytes;
      }
    }
    if (typeof row.blob === "string") {
      const bytes = fromBase64(row.blob);
      if (bytes) {
        return bytes;
      }
    }
    if (typeof row.data === "string" && (row.mimeType?.includes("fit") || row.type === "resource")) {
      const bytes = fromBase64(row.data);
      if (bytes) {
        return bytes;
      }
    }
    if (typeof row.text === "string" && row.text.length > 200 && !row.text.includes(" ")) {
      const bytes = fromBase64(row.text);
      if (bytes && looksLikeFit(bytes)) {
        return bytes;
      }
    }
  }
  const structured = asRecord(result.structuredContent);
  if (structured?.blob && typeof structured.blob === "string") {
    const bytes = fromBase64(structured.blob);
    if (bytes) {
      return bytes;
    }
  }
  return null;
}

export function extractFitUrls(result: CallToolResult): string[] {
  const urls: string[] = [];
  collectUrls(result.structuredContent, urls);
  for (const block of result.content ?? []) {
    const row = block as {
      type?: string;
      text?: string;
      uri?: string;
      resource?: { uri?: string };
    };
    if (row.uri) {
      urls.push(row.uri);
    }
    if (row.resource?.uri) {
      urls.push(row.resource.uri);
    }
    if (row.text) {
      collectUrls(row.text, urls);
    }
  }
  return [...new Set(urls)];
}

export async function fitBytesFromToolResult(result: CallToolResult): Promise<Buffer | null> {
  const embedded = extractFitBytes(result);
  if (embedded) {
    return embedded;
  }
  for (const url of extractFitUrls(result)) {
    const fetched = await fetchFit(url);
    if (fetched) {
      return fetched;
    }
  }
  return null;
}
