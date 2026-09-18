import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseServiceRoleKey, supabaseUrl } from "@/lib/supabase/env";

if (typeof globalThis.WebSocket === "undefined") {
  // Node 20 scripts have no WebSocket; we only use PostgREST from here.
  globalThis.WebSocket = class {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    CONNECTING = 0;
    OPEN = 1;
    CLOSING = 2;
    CLOSED = 3;
    readyState = 3;
    url = "";
    protocol = "";
    onopen = null;
    onmessage = null;
    onclose = null;
    onerror = null;
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
  } as unknown as typeof WebSocket;
}

export function createAdminClient() {
  return createClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
