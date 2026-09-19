"use client";

import { useEffect } from "react";

export default function ConfirmPage() {
  useEffect(() => {
    window.location.replace(`/invite${window.location.search}${window.location.hash}`);
  }, []);

  return <p className="text-sm text-muted">Opening your invite…</p>;
}
