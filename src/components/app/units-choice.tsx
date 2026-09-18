"use client";

import type { Units } from "@/lib/units";

const OPTIONS = [
  { id: "imperial", label: "Miles", hint: "mi · ft" },
  { id: "metric", label: "Kilometres", hint: "km · m" },
] as const;

type Props = {
  value: Units;
  onChange: (units: Units) => void;
};

export function UnitsChoice({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {OPTIONS.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`rounded-sm border px-3 py-2 text-left ${
              selected
                ? "border-ink bg-ink text-paper"
                : "border-line bg-paper hover:bg-paper-sunken"
            }`}
          >
            <span className="block text-sm font-medium">{option.label}</span>
            <span
              className={`mt-0.5 block text-[12px] ${
                selected ? "text-paper/70" : "text-muted"
              }`}
            >
              {option.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
