export type ImportProgress = {
  phase: "listing" | "activities" | "fit" | "wellness" | "load" | "done" | "error";
  message: string;
  processed: number;
  total: number;
  saved: number;
  reauth?: boolean;
};

export async function readImportProgress(
  response: Response,
  onProgress: (progress: ImportProgress) => void,
) {
  if (!response.body) {
    throw new Error("No progress stream.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let last: ImportProgress | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      const parsed = JSON.parse(line) as ImportProgress;
      last = parsed;
      onProgress(parsed);
    }
  }
  if (buffer.trim()) {
    const parsed = JSON.parse(buffer) as ImportProgress;
    last = parsed;
    onProgress(parsed);
  }
  return last;
}
