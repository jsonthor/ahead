"use client";

import { formatWeekdayDate } from "@/lib/calendar";
import type { CalendarIntent } from "@/lib/calendar-event";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useState } from "react";

const OPTIONS: {
  intent: CalendarIntent;
  label: string;
  detail: string;
}[] = [
  {
    intent: "training",
    label: "Training",
    detail: "Plan it, or log what you already did.",
  },
  {
    intent: "race",
    label: "Race",
    detail: "Upcoming or past. Complete the result.",
  },
  {
    intent: "rest",
    label: "Rest",
    detail: "Mark the day. No work.",
  },
];

export function DayAdd({
  date,
  onChoose,
}: {
  date: string;
  onChoose: (intent: CalendarIntent) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li
      className={`min-w-0 ${
        open
          ? ""
          : "hidden group-hover/day:block max-md:block"
      }`}
    >
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={`Add to ${formatWeekdayDate(date)}`}
            className={`flex w-full min-w-0 items-center justify-center rounded-sm border border-dashed px-2 py-1.5 text-[15px] leading-none ${
              open
                ? "border-forest bg-paper text-forest"
                : "border-line bg-paper text-ink-soft hover:border-forest hover:text-forest"
            }`}
          >
            <span aria-hidden>+</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            side="bottom"
            sideOffset={4}
            collisionPadding={12}
            className="z-[70] w-56 border border-line bg-paper-raised p-2 shadow-[0_16px_40px_rgba(0,0,0,0.45)] outline-none"
          >
            <p className="kicker px-2 py-1.5">{formatWeekdayDate(date)}</p>
            {OPTIONS.map((option) => (
              <DropdownMenu.Item
                key={option.intent}
                onSelect={() => onChoose(option.intent)}
                className="cursor-pointer rounded-sm px-2 py-2 outline-none data-[highlighted]:bg-paper-sunken"
              >
                <span className="block text-sm font-medium text-ink">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[12px] leading-4 text-ink-soft">
                  {option.detail}
                </span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </li>
  );
}
