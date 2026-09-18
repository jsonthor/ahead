import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export type UserClient = SupabaseClient;

export function userClient(req: Request): UserClient {
  const auth = req.headers.get("Authorization");
  if (!auth) {
    throw new Error("Missing Authorization");
  }
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) {
    throw new Error("Missing Supabase env");
  }
  return createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireUser(client: UserClient) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    throw new Error("Not signed in");
  }
  return user;
}

export function openaiKey() {
  return Deno.env.get("OPENAI_API_KEY")?.trim() || "";
}
