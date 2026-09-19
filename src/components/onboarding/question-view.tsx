"use client";

import { inputClassName } from "@/components/auth/field";
import {
  DAYS,
  DURATION_OPTIONS,
  defaultValue,
  sportPicks,
  type AnswerValue,
  type DayId,
  type FixedSession,
  type Priority,
  type Question,
} from "@/lib/onboarding";
import { useState } from "react";

const chip = (on: boolean) =>
  `h-9 rounded-sm border px-3 text-sm ${
    on
      ? "border-ink bg-ink text-paper"
      : "border-line bg-paper text-ink hover:bg-paper-sunken"
  }`;

type Props = {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
};

export function QuestionView({ question, value, onChange }: Props) {
  const current = value ?? defaultValue(question);

  switch (question.type) {
    case "choice":
      if (current.type !== "choice") {
        return null;
      }
      return (
        <div className="grid gap-2">
          {question.options.map((option) => {
            const selected = current.ids.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  if (question.multiple) {
                    const ids = selected
                      ? current.ids.filter((id) => id !== option.id)
                      : [...current.ids, option.id];
                    onChange({ type: "choice", ids });
                    return;
                  }
                  onChange({ type: "choice", ids: [option.id] });
                }}
                className={`rounded-sm border px-4 py-3 text-left ${
                  selected
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-paper hover:bg-paper-sunken"
                }`}
              >
                <span className="block text-sm font-medium">{option.label}</span>
                {option.hint ? (
                  <span
                    className={`mt-1 block text-[13px] leading-5 ${
                      selected ? "text-paper/70" : "text-muted"
                    }`}
                  >
                    {option.hint}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      );

    case "sport_discipline":
      if (current.type !== "sport_discipline") {
        return null;
      }
      {
        const picks = sportPicks(current);
        const selected = question.sports.filter((entry) =>
          picks.some((pick) => pick.sport === entry.id),
        );
        return (
          <div className="grid gap-5">
            <div className="flex flex-wrap gap-2">
              {question.sports.map((entry) => {
                const on = picks.some((pick) => pick.sport === entry.id);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const next = on
                        ? picks.filter((pick) => pick.sport !== entry.id)
                        : [...picks, { sport: entry.id, disciplines: [] }];
                      onChange({ type: "sport_discipline", picks: next });
                    }}
                    className={chip(on)}
                  >
                    {entry.label}
                  </button>
                );
              })}
            </div>
            {selected.map((sport) => {
              const pick = picks.find((entry) => entry.sport === sport.id);
              const disciplines = pick?.disciplines ?? [];
              return (
                <div key={sport.id}>
                  <p className="text-sm font-medium text-ink">
                    {selected.length > 1 ? sport.label : "Discipline"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sport.disciplines.map((entry) => {
                      const on = disciplines.includes(entry.id);
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            const next = disciplines.includes(entry.id)
                              ? disciplines.filter((id) => id !== entry.id)
                              : [...disciplines, entry.id];
                            onChange({
                              type: "sport_discipline",
                              picks: picks.map((item) =>
                                item.sport === sport.id
                                  ? { ...item, disciplines: next }
                                  : item,
                              ),
                            });
                          }}
                          className={chip(on)}
                        >
                          {entry.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }

    case "availability":
      if (current.type !== "availability") {
        return null;
      }
      return (
        <div className="grid gap-2">
          {DAYS.map((day) => (
            <label
              key={day.id}
              className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3"
            >
              <span className="text-sm text-ink">{day.label}</span>
              <select
                value={String(current.days[day.id])}
                onChange={(event) => {
                  const raw = event.target.value;
                  const minutes = raw === "null" ? null : Number(raw);
                  onChange({
                    type: "availability",
                    days: { ...current.days, [day.id]: minutes },
                  });
                }}
                className={inputClassName}
              >
                {DURATION_OPTIONS.map((option) => (
                  <option
                    key={String(option.minutes)}
                    value={String(option.minutes)}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      );

    case "fixed_sessions":
      if (current.type !== "fixed_sessions") {
        return null;
      }
      return (
        <FixedSessionsEditor
          presets={question.presets}
          sessions={current.sessions}
          onChange={(sessions) => onChange({ type: "fixed_sessions", sessions })}
        />
      );

    case "event_list":
      if (current.type !== "event_list") {
        return null;
      }
      return (
        <EventListEditor
          events={current.events}
          onChange={(events) => onChange({ type: "event_list", events })}
        />
      );

    case "date":
      if (current.type !== "date") {
        return null;
      }
      return (
        <input
          type="date"
          name={question.id}
          autoComplete="bday"
          value={current.value}
          max={new Date().toISOString().slice(0, 10)}
          min="1900-01-01"
          onChange={(event) =>
            onChange({ type: "date", value: event.target.value })
          }
          className={inputClassName}
        />
      );
  }
}

function FixedSessionsEditor({
  presets,
  sessions,
  onChange,
}: {
  presets: { id: string; label: string }[];
  sessions: FixedSession[];
  onChange: (sessions: FixedSession[]) => void;
}) {
  const [draftDay, setDraftDay] = useState<DayId>("mon");
  const [draftTitle, setDraftTitle] = useState("");

  function add(title: string) {
    const name = title.trim();
    if (!name) {
      return;
    }
    onChange([...sessions, { day: draftDay, title: name }]);
    setDraftTitle("");
  }

  return (
    <div className="grid gap-4">
      <label className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2">
        <span className="text-sm text-ink">Day</span>
        <select
          aria-label="Day"
          value={draftDay}
          onChange={(event) => setDraftDay(event.target.value as DayId)}
          className={inputClassName}
        >
          {DAYS.map((day) => (
            <option key={day.id} value={day.id}>
              {day.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="h-9 rounded-sm border border-line px-3 text-sm text-ink hover:bg-paper-sunken"
            onClick={() => add(preset.label)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add(draftTitle);
            }
          }}
          placeholder="Or type one"
          className={inputClassName}
        />
        <button
          type="button"
          onClick={() => add(draftTitle)}
          className="h-10 rounded-sm border border-line px-3 text-sm text-ink hover:bg-paper-sunken"
        >
          Add
        </button>
      </div>
      {sessions.length > 0 ? (
        <ul className="grid gap-2">
          {sessions.map((session, index) => (
            <li
              key={`${session.day}-${session.title}-${index}`}
              className="flex items-center justify-between rounded-sm border border-line px-3 py-2 text-sm"
            >
              <span>
                {DAYS.find((day) => day.id === session.day)?.label} · {session.title}
              </span>
              <button
                type="button"
                className="text-muted hover:text-ink"
                onClick={() =>
                  onChange(sessions.filter((_, item) => item !== index))
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">Skip if nothing is fixed.</p>
      )}
    </div>
  );
}

function EventListEditor({
  events,
  onChange,
}: {
  events: { name: string; date?: string; priority: Priority }[];
  onChange: (events: { name: string; date?: string; priority: Priority }[]) => void;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [priority, setPriority] = useState<Priority>("A");

  function add() {
    const trimmed = name.trim();
    if (!trimmed || !date) {
      return;
    }
    onChange([...events, { name: trimmed, date, priority }]);
    setName("");
    setDate("");
  }

  return (
    <div className="grid gap-4">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        }}
        placeholder="Race name"
        className={inputClassName}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_auto] gap-2">
        <input
          type="date"
          aria-label="Race date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className={inputClassName}
        />
        <select
          aria-label="Priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value as Priority)}
          className={inputClassName}
        >
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </select>
        <button
          type="button"
          onClick={add}
          className="h-10 rounded-sm border border-line px-3 text-sm text-ink hover:bg-paper-sunken"
        >
          Add
        </button>
      </div>
      {events.length > 0 ? (
        <ul className="grid gap-2">
          {events.map((event, index) => (
            <li
              key={`${event.name}-${event.date ?? ""}-${index}`}
              className="flex items-center justify-between rounded-sm border border-line px-3 py-2 text-sm"
            >
              <span>
                {event.priority} · {event.name}
                {event.date ? ` · ${formatRaceDate(event.date)}` : ""}
              </span>
              <button
                type="button"
                className="text-muted hover:text-ink"
                onClick={() => onChange(events.filter((_, item) => item !== index))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">
          Skip and mark A / B / C on the calendar later.
        </p>
      )}
    </div>
  );
}

function formatRaceDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) {
    return key;
  }
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
