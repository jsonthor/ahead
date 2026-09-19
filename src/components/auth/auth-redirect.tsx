"use client";

import { useEffect } from "react";

function isAuthLanding(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/signup/confirm" ||
    pathname === "/signup/join"
  );
}

export function AuthRedirect() {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    if (pathname.startsWith("/invite") || pathname.startsWith("/auth/")) {
      return;
    }

    const query = new URLSearchParams(search);
    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    const code = query.get("code");
    if (
      code &&
      isAuthLanding(pathname) &&
      !pathname.startsWith("/api/") &&
      !pathname.startsWith("/connect")
    ) {
      const next = new URL("/auth/callback", window.location.origin);
      next.searchParams.set("code", code);
      next.searchParams.set("next", "/invite");
      window.location.replace(next.toString());
      return;
    }

    const inviteLike =
      hashParams.get("access_token") ||
      hashParams.get("type") === "invite" ||
      query.get("type") === "invite" ||
      query.get("token_hash") ||
      hashParams.get("token_hash");
    if (!inviteLike) {
      return;
    }
    window.location.replace(`/invite${search}${hash}`);
  }, []);

  return null;
}
