"use client";

import { useAppUser } from "@/components/app/app-shell";
import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISS_KEY = "ahead.dob-prompt";

export function ProfileCompletion() {
  const user = useAppUser();
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed === null || user.dateOfBirth || dismissed) {
    return null;
  }

  return (
    <div className="mt-8 max-w-xl border border-line bg-paper-raised px-4 py-4">
      <p className="text-sm font-medium text-ink">Complete your athlete profile</p>
      <p className="mt-1 text-[13px] leading-5 text-muted">
        Add your date of birth to improve age-aware training interpretation.
      </p>
      <div className="mt-3 flex items-center gap-5">
        <Link
          href="/app/profile"
          className="text-sm text-ink underline-offset-2 hover:underline"
        >
          Add date of birth
        </Link>
        <button
          type="button"
          className="text-[13px] text-muted hover:text-ink"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
