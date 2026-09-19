"use client";

import { BrandConnect } from "@/components/onboarding/brand-connect";
import { QuestionView } from "@/components/onboarding/question-view";
import { getSession, saveOnboarding } from "@/lib/auth";
import { connectProvider, type ProviderId } from "@/lib/integrations";
import {
  defaultValue,
  emptyAnswers,
  validateQuestion,
  visibleQuestions,
  type OnboardingAnswers,
} from "@/lib/onboarding";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const DRAFT_KEY = "potential.onboarding.draft";

type Phase = "questions" | "connect";

type Draft = {
  answers: OnboardingAnswers;
  index: number;
  phase: Phase;
};

function readDraft(): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft) {
  window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function clearDraft() {
  window.sessionStorage.removeItem(DRAFT_KEY);
}

export function OnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("questions");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(emptyAnswers);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSession().then((session) => {
      if (cancelled) {
        return;
      }
      if (!session) {
        router.replace("/login");
        return;
      }
      if (session.onboarding) {
        router.replace("/app");
        return;
      }
      const draft = readDraft();
      if (draft) {
        setAnswers(draft.answers);
        setIndex(draft.index);
        setPhase(draft.phase);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const fail = searchParams.get("error");
    if (connected) {
      connectProvider(connected as ProviderId);
      setPhase("connect");
      setNotice(`${labelFor(connected)} is connected. Add another, or continue.`);
    }
    if (fail === "denied") {
      setPhase("connect");
      setError("Permission was denied. You can try another brand.");
    } else if (fail) {
      setPhase("connect");
      setError("That connection did not finish. Try again.");
    }
    if (connected || fail) {
      router.replace("/onboarding");
    }
  }, [router, searchParams]);

  const steps = useMemo(() => visibleQuestions(answers), [answers]);
  const safeIndex = Math.min(index, Math.max(0, steps.length - 1));
  const question = steps[safeIndex];
  const total = steps.length;
  const current = question ? safeIndex + 1 : 0;
  const value = question ? answers.values[question.id] : undefined;

  useEffect(() => {
    if (!question || answers.values[question.id]) {
      return;
    }
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      values: {
        ...currentAnswers.values,
        [question.id]: defaultValue(question),
      },
    }));
  }, [answers.values, question]);

  function persist(next: Partial<Draft>) {
    writeDraft({
      answers,
      index: safeIndex,
      phase,
      ...next,
    });
  }

  function setValue(next: typeof value) {
    if (!question || !next) {
      return;
    }
    const updated = {
      ...answers,
      values: { ...answers.values, [question.id]: next },
    };
    setAnswers(updated);
    setError(null);
    persist({ answers: updated });
  }

  function goBack() {
    setError(null);
    setNotice(null);
    if (phase === "connect") {
      setPhase("questions");
      persist({ phase: "questions" });
      return;
    }
    setIndex((currentIndex) => Math.max(0, currentIndex - 1));
  }

  function goNext() {
    if (phase === "connect") {
      finish();
      return;
    }
    if (!question) {
      return;
    }
    const message = validateQuestion(question, answers.values[question.id]);
    if (message) {
      setError(message);
      return;
    }
    if (safeIndex >= steps.length - 1) {
      setPhase("connect");
      persist({ phase: "connect", answers, index: safeIndex });
      return;
    }
    setIndex(safeIndex + 1);
  }

  async function finish() {
    const result = await saveOnboarding(answers);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    clearDraft();
    router.push("/app");
    router.refresh();
  }

  if (!ready || !question) {
    return <div className="text-sm text-muted">Loading…</div>;
  }

  if (phase === "connect") {
    return (
      <div>
        <p className="kicker">Connect</p>
        <h1 className="title mt-3 text-ink">
          Whose data should Potential learn from?
        </h1>
        <p className="lede mt-3">
          COROS and file upload are live. Garmin, Polar, and the rest are
          coming soon.
        </p>
        <div className="mt-8">
          <BrandConnect
            onLeave={() => persist({ phase: "connect", answers, index: safeIndex })}
          />
        </div>
        {notice ? (
          <p className="mt-4 text-sm text-ink-soft">{notice}</p>
        ) : null}
        {error ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-8 flex gap-2">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-sm border border-line text-sm text-ink hover:bg-paper-sunken"
          >
            Back
          </button>
          <button
            type="button"
            onClick={finish}
            className="home-cta flex-[1.6]"
          >
            Continue
          </button>
        </div>
        <p className="mt-3 text-[13px] text-muted">
          Skip if you want a blank calendar.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="kicker">
        {current} of {total}
      </p>
      <h1 className="title mt-3 text-ink">{question.title}</h1>
      <p className="lede mt-3">{question.help}</p>

      <div className="mt-8">
        <QuestionView
          key={question.id}
          question={question}
          value={value}
          onChange={setValue}
        />
      </div>

      {error ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex gap-2">
        {index > 0 ? (
          <button
            type="button"
            onClick={goBack}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-sm border border-line text-sm text-ink hover:bg-paper-sunken"
          >
            Back
          </button>
        ) : null}
        <button
          type="button"
          onClick={goNext}
          className="home-cta flex-[1.6]"
        >
          Continue
        </button>
      </div>
      {!question.required ? (
        <p className="mt-3 text-[13px] text-muted">Optional — continue with none.</p>
      ) : null}
    </div>
  );
}

function labelFor(id: string) {
  const names: Record<string, string> = {
    garmin: "Garmin",
    coros: "COROS",
    polar: "Polar",
    strava: "Strava",
    wahoo: "Wahoo",
    suunto: "Suunto",
    apple: "Apple Health",
  };
  return names[id] ?? id;
}
