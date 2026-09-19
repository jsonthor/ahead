import { syncAllConnectedCoros } from "@/lib/coros/auto-sync";
import { SITE_URL } from "@/lib/site";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (secret) {
    return auth === `Bearer ${secret}`;
  }
  return request.headers.get("x-vercel-cron") === "1";
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ error: "auth" }, { status: 401 });
  }

  try {
    const results = await syncAllConnectedCoros(SITE_URL);
    return Response.json({ ok: true, results });
  } catch (error) {
    console.error("Scheduled integration sync failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "sync" },
      { status: 500 },
    );
  }
}
