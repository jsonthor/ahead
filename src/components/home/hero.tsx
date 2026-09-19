"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { HomePhoto } from "@/components/home/photo";

const HERO_SCORES = [
  { name: "Fitness", value: "61.4" },
  { name: "Fatigue", value: "54.1" },
  { name: "Form", value: "+7.3" },
];

export function HomeHero({ signedIn = false }: { signedIn?: boolean }) {
  const play = useHeroPlay();

  return (
      <section id="after-session">
        <div className="relative min-h-[calc(100svh-4.25rem)] overflow-hidden sm:min-h-[calc(100svh-4.75rem)]">
          <HomePhoto
            src="/home/session-runner.jpg"
            alt="A runner checking her watch mid-session in the rain"
            preload
            objectPosition="40% 8%"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/24 to-black/18" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/58 via-transparent to-black/10" />

          <div className="relative z-10 mx-auto flex min-h-[calc(100svh-4.25rem)] max-w-[1540px] flex-col justify-between gap-10 px-4 py-10 sm:min-h-[calc(100svh-4.75rem)] sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:py-16">
            <div
              className={`max-w-xl transition-opacity duration-500 ${
                play.messages > 0
                  ? "max-lg:pointer-events-none max-lg:opacity-0"
                  : ""
              }`}
            >
              <p className="home-mono text-[10px] font-bold tracking-[0.22em] text-white/70 uppercase">
                For self-coached endurance athletes
              </p>
              <h1 className="home-display mt-8 max-w-[11ch] text-[clamp(3.2rem,6.4vw,6.6rem)] text-white">
                Know if the work is working.
              </h1>
              <p className="mt-8 max-w-md text-[18px] leading-[1.5] tracking-[-0.018em] text-white/78">
                Ahead follows the training you actually do, shows whether it’s
                moving you forward, and helps you make the next call.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
                <Link href={signedIn ? "/app" : "/signup"} className="home-cta">
                  {signedIn ? "Open Ahead" : "Coming soon"}
                </Link>
                <a
                  href="#product"
                  className="inline-flex h-11 items-center text-[14px] text-white/70 transition-colors hover:text-white"
                >
                  See how it works
                </a>
              </div>
            </div>

            <div className="flex w-full max-w-[26rem] flex-col items-stretch gap-3 self-end lg:min-w-[26rem]">
              <MetricsPanel compact={play.compact} />
              <div className="flex flex-col gap-2" aria-label="Ask Ahead">
                <TypingBubble
                  side="user"
                  show={play.typing === "user" && play.messages === 0}
                />
                <ChatBubble side="user" name="You" show={play.messages >= 1}>
                  I’m shattered, I can’t train Thursday, and I race Sunday. What
                  should I do?
                </ChatBubble>
                <TypingBubble
                  side="ahead"
                  show={play.typing === "ahead" && play.messages === 1}
                />
                <ChatBubble side="ahead" name="Ahead" show={play.messages >= 2}>
                  <p>
                    Wednesday already landed hard and Sunday is the priority.
                    Take Thursday off, keep Friday easy, and leave the rest of
                    the week alone.
                  </p>
                  <HeroProposal
                    status={
                      play.proposal === "hidden" ? "pending" : play.proposal
                    }
                    pressing={play.pressing}
                    onApply={play.apply}
                    onDismiss={play.dismiss}
                    onUndo={play.undo}
                  />
                </ChatBubble>
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}

function MetricsPanel({ compact }: { compact: boolean }) {
  return (
    <div
      className={`home-metrics text-right ${compact ? "is-compact" : ""}`}
    >
      <p className="home-metrics-inline">
        <span>
          <span className="home-metrics-inline-row">
            <span>Performance</span>
            <span className="home-metrics-inline-score">74</span>
            <span className="home-metrics-inline-delta">↑ 8</span>
          </span>
          <span className="home-metrics-inline-band">Building</span>
        </span>
      </p>
      <div className="home-metrics-lead">
        <p className="home-mono home-score-in home-score-in-1 text-[12px] tracking-[0.16em] text-white/70 uppercase">
          Performance
        </p>
        <p className="home-mono home-metrics-score home-metrics-flash home-score-in home-score-in-2 mt-1 leading-none tracking-[-0.08em] text-white [text-shadow:0_1px_22px_rgba(0,0,0,0.45)]">
          74
        </p>
        <div className="home-metrics-move home-score-in home-score-in-3 mt-2 flex items-center justify-end gap-3">
          <p className="home-mono text-[1.05rem] text-[var(--home-cta)] sm:text-[1.35rem]">
            ↑ 8
          </p>
          <ReadinessSpark />
        </div>
        <p className="home-mono home-metrics-band home-score-in home-score-in-3 mt-2 text-[11px] tracking-[0.12em] text-white/70 uppercase">
          Building
        </p>
      </div>
      <div className="home-metrics-detail mt-8">
        <div>
          <dl className="ml-auto w-[13.5rem] space-y-3.5">
            {HERO_SCORES.map((score) => (
              <div
                key={score.name}
                className="flex items-baseline justify-between gap-6"
              >
                <dt className="home-mono text-[11px] tracking-[0.14em] text-white/55 uppercase">
                  {score.name}
                </dt>
                <dd className="home-mono text-[2rem] leading-none tracking-[-0.05em] text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.45)]">
                  {score.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  side,
  name,
  show,
  children,
}: {
  side: "user" | "ahead";
  name?: string;
  show: boolean;
  children: ReactNode;
}) {
  const user = side === "user";

  return (
    <div className={`home-msg ${show ? "is-in" : ""}`}>
      <div className={user ? "flex justify-end pb-0.5" : "pb-0.5"}>
        <div className={user ? "ml-auto w-fit max-w-[min(20rem,100%)]" : "w-full"}>
          {name ? (
            <p
              className={`home-mono mb-1.5 text-[10px] font-bold tracking-[0.16em] text-white/78 uppercase ${
                user ? "text-right" : ""
              }`}
            >
              {name}
            </p>
          ) : null}
          <div className={bubbleClass(user)}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function TypingBubble({
  side,
  show,
}: {
  side: "user" | "ahead";
  show: boolean;
}) {
  const user = side === "user";

  return (
    <div className={`home-msg ${show ? "is-in" : ""}`} aria-hidden={!show}>
      <div className={user ? "flex justify-end pb-0.5" : "pb-0.5"}>
        <p
          className={`${bubbleClass(user)} inline-flex h-10 items-center gap-1.5 px-3.5`}
          aria-label={user ? "Typing" : "Ahead is typing"}
        >
          <span
            className={`home-type-dot ${user ? "bg-[#04140a]" : "bg-[#0a0b0a]"}`}
          />
          <span
            className={`home-type-dot ${user ? "bg-[#04140a]" : "bg-[#0a0b0a]"}`}
          />
          <span
            className={`home-type-dot ${user ? "bg-[#04140a]" : "bg-[#0a0b0a]"}`}
          />
        </p>
      </div>
    </div>
  );
}

function HeroProposal({
  status,
  pressing,
  onApply,
  onDismiss,
  onUndo,
}: {
  status: "pending" | "applied" | "dismissed";
  pressing: boolean;
  onApply: () => void;
  onDismiss: () => void;
  onUndo: () => void;
}) {
  if (status === "dismissed") {
    return <p className="mt-3 text-[12px] text-black/40">Dismissed.</p>;
  }

  if (status === "applied") {
    return (
      <div className="mt-3 border-t border-black/8 pt-3">
        <p className="text-sm font-medium text-[#0a0b0a]">✓ Plan updated</p>
        <p className="mt-1 text-[13px] leading-5 text-black/50">
          Thursday is off and Friday is easy. Everything else stays put.
        </p>
        <button
          type="button"
          onClick={onUndo}
          className="mt-3 inline-flex h-8 items-center rounded-sm px-3 text-[13px] text-black/45 hover:bg-black/5 hover:text-[#0a0b0a]"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-black/8 pt-3">
      <p className="text-[10px] font-bold tracking-[0.16em] text-black/40 uppercase">
        Proposed
      </p>
      <ul className="mt-2.5 grid gap-3 text-[#0a0b0a]">
        <li>
          <p className="text-[13px] text-black/45">Thu 24</p>
          <p className="text-sm font-medium">Rest</p>
        </li>
        <li>
          <p className="text-[13px] text-black/45">Fri 25</p>
          <p className="text-sm font-medium">Easy · 40m</p>
        </li>
      </ul>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onApply}
          className={`home-cta home-cta-sm transition-transform ${
            pressing ? "scale-95" : ""
          }`}
        >
          Approve changes
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-8 items-center rounded-sm px-3 text-[13px] text-black/45 hover:bg-black/5 hover:text-[#0a0b0a]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function bubbleClass(user: boolean) {
  return user
    ? "ml-auto rounded-2xl rounded-br-md bg-[var(--home-cta)] px-3.5 py-2.5 text-[15px] leading-6 text-[#04140a]"
    : "w-full rounded-2xl rounded-bl-md bg-white/92 px-3.5 py-2.5 text-[15px] leading-6 text-[#0a0b0a] shadow-[0_8px_24px_rgba(0,0,0,0.18)]";
}

function ReadinessSpark() {
  return (
    <svg
      viewBox="0 0 132 28"
      className="home-metrics-spark h-8 w-40"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="home-spark-line"
        d="M1 21 C18 20 28 18 40 16 C52 14 58 13 68 11 C78 9 84 8 96 6 C108 5 118 4 131 3"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth="1.75"
      />
      <circle cx="131" cy="3" r="2.4" fill="#00e05a" />
    </svg>
  );
}

function useHeroPlay() {
  const [compact, setCompact] = useState(false);
  const [messages, setMessages] = useState(0);
  const [typing, setTyping] = useState<"user" | "ahead" | null>(null);
  const [proposal, setProposal] = useState<
    "hidden" | "pending" | "applied" | "dismissed"
  >("hidden");
  const [pressing, setPressing] = useState(false);
  const settled = useRef(false);

  function apply() {
    settled.current = true;
    setPressing(false);
    setProposal("applied");
  }

  function dismiss() {
    settled.current = true;
    setPressing(false);
    setProposal("dismissed");
  }

  function undo() {
    settled.current = true;
    setProposal("pending");
  }

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCompact(true);
      setMessages(2);
      setProposal("applied");
      settled.current = true;
      return;
    }

    const timers = [
      window.setTimeout(() => setCompact(true), 2200),
      window.setTimeout(() => setTyping("user"), 2600),
      window.setTimeout(() => {
        setTyping(null);
        setMessages(1);
      }, 3400),
      window.setTimeout(() => setTyping("ahead"), 3900),
      window.setTimeout(() => {
        setTyping(null);
        setMessages(2);
        setProposal("pending");
      }, 5000),
      window.setTimeout(() => {
        if (!settled.current) {
          setPressing(true);
        }
      }, 6400),
      window.setTimeout(() => {
        if (!settled.current) {
          settled.current = true;
          setPressing(false);
          setProposal("applied");
        }
      }, 6700),
    ];

    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  return { compact, messages, typing, proposal, pressing, apply, dismiss, undo };
}
