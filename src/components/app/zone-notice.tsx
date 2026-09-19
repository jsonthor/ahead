"use client";

import { noticeCopy, type ZoneNotice } from "@/lib/hr-model/notice";
import type { ZoneSnapshot } from "@/lib/hr-model/profile";
import Link from "next/link";
import { useEffect, useState } from "react";

export function ZoneNoticeCard() {
  const [notices, setNotices] = useState<ZoneNotice[] | null>(null);

  useEffect(() => {
    void fetch("/api/hr-model")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ZoneSnapshot | null) => {
        setNotices(data?.notices.filter((notice) => !notice.dismissed) ?? []);
      })
      .catch(() => {
        setNotices([]);
      });
  }, []);

  const notice = notices?.[0];
  if (!notice) {
    return null;
  }

  return (
    <div className="mt-8 max-w-xl border border-line bg-paper-raised px-4 py-4">
      <p className="text-sm font-medium text-ink">Zones may need an update</p>
      <p className="mt-1 text-[13px] leading-5 text-muted">{noticeCopy(notice)}</p>
      <div className="mt-3 flex items-center gap-5">
        <Link
          href="/app/zones"
          className="text-sm text-ink underline-offset-2 hover:underline"
        >
          Review zones
        </Link>
        <button
          type="button"
          className="text-[13px] text-muted hover:text-ink"
          onClick={() => {
            setNotices((current) => current?.filter((row) => row.id !== notice.id) ?? []);
            void fetch("/api/hr-model", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: notice.id }),
            });
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
