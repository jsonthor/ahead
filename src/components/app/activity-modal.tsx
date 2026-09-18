"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ActivityDetail } from "@/components/app/activity-detail";
import { ACTIVITY_PARAM, stripActivityParam } from "@/lib/activity-modal";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function ActivityModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const id = searchParams.get(ACTIVITY_PARAM);
  const open = Boolean(id);

  function close() {
    router.push(stripActivityParam(pathname, searchParams.toString()), {
      scroll: false,
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          close();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content className="fixed inset-3 z-50 flex max-h-[calc(100dvh-1.5rem)] w-auto flex-col overflow-hidden border border-line bg-paper-raised outline-none sm:inset-y-8 sm:inset-x-auto sm:left-1/2 sm:w-[min(52rem,calc(100vw-2rem))] sm:-translate-x-1/2">
          <div className="flex items-center justify-end border-b border-line px-4 py-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-sm px-3 text-sm text-ink-soft hover:bg-paper-sunken hover:text-ink"
              >
                Close
              </button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            {id ? <ActivityDetail id={id} /> : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
