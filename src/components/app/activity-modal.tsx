"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ActivityDetail } from "@/components/app/activity-detail";
import { ACTIVITY_PARAM, stripActivityParam } from "@/lib/activity-modal";
import { COMPARE_SELECTING_EVENT } from "@/lib/activity-compare";
import { keepAskAhead } from "@/lib/chat/ask-layer";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function ActivityModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const id = searchParams.get(ACTIVITY_PARAM);
  const [selecting, setSelecting] = useState(false);
  const open = Boolean(id) && !selecting;

  useEffect(() => {
    function onSelecting(event: Event) {
      setSelecting(Boolean((event as CustomEvent<boolean>).detail));
    }
    window.addEventListener(COMPARE_SELECTING_EVENT, onSelecting);
    return () => window.removeEventListener(COMPARE_SELECTING_EVENT, onSelecting);
  }, []);

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
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/70" />
        <Dialog.Content
          className="fixed inset-0 z-[60] flex h-dvh w-screen flex-col overflow-hidden bg-paper-raised outline-none"
          onPointerDownOutside={keepAskAhead}
          onFocusOutside={keepAskAhead}
          onInteractOutside={keepAskAhead}
        >
          {id ? <ActivityDetail id={id} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
