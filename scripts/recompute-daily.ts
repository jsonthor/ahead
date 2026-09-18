import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { recomputeAllAthleteDailyLoads } from "../src/lib/load/recompute";

function loadLocalEnv() {
  const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

async function main() {
  const results = await recomputeAllAthleteDailyLoads();
  for (const row of results) {
    console.log(`${row.athleteId} daily_loads=${row.days}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
