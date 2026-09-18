"use client";

import {
  applyCalendarProposal,
  extractAiMemory,
  invokePotentialAi,
  potentialAiReady,
  undoCalendarProposal,
} from "@/lib/chat/edge";
import {
  parseProposal,
  type CalendarProposal,
} from "@/lib/chat/proposal";
import { formatWeekdayDate } from "@/lib/calendar";
import {
  appliedSummary,
  changeMeta,
  headingFor,
  proposedChanges,
  durationLabel,
} from "@/lib/chat/proposal-view";
import { notifyCalendarChanged, notifyCalendarPreview } from "@/lib/calendar-event";
import { ChatMarkdown } from "@/components/app/chat-markdown";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef, useState, type FormEvent } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposal: CalendarProposal | null;
};

export function AskPotential() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const [readyFlag, conversationRes] = await Promise.all([
          potentialAiReady(),
          supabase
            .from("conversations")
            .select("id")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (cancelled) {
          return;
        }
        setReady(readyFlag);
        const conversation = conversationRes.data;
        if (!conversation) {
          return;
        }
        setConversationId(conversation.id);
        const { data: rows } = await supabase
          .from("messages")
          .select("id, role, content, proposal, created_at")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: true });
        if (cancelled) {
          return;
        }
        setMessages(
          (rows ?? []).map((row) => ({
            id: row.id,
            role: row.role as "user" | "assistant",
            content: row.content,
            proposal: parseProposal(row.proposal),
          })),
        );
      } catch {
        if (!cancelled) {
          setError("Could not load your conversation.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, open, busy]);

  useEffect(() => {
    const pending = [...messages]
      .reverse()
      .find((message) => message.proposal?.status === "pending")?.proposal;
    notifyCalendarPreview(
      pending
        ? { operations: pending.operations, snapshot: pending.snapshot }
        : null,
    );
  }, [messages]);

  useEffect(() => {
    return () => {
      notifyCalendarPreview(null);
    };
  }, []);

  async function send(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy) {
      return;
    }
    setDraft("");
    setError(null);
    setBusy(true);
    const pendingId = `local-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: pendingId, role: "user", content, proposal: null },
      { id: `${pendingId}-reply`, role: "assistant", content: "", proposal: null },
    ]);
    try {
      const response = await invokePotentialAi({
        conversationId,
        message: content,
        uiContext: {
          route: window.location.pathname,
          activityId: new URLSearchParams(window.location.search).get("activity") ?? undefined,
        },
      });
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let reply = "";
      let proposal: CalendarProposal | null = null;
      let savedId: string | null = null;
      let nextConversationId = conversationId;
      let extractMemory = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n");
        buffer = chunks.pop() ?? "";
        for (const line of chunks) {
          if (!line.startsWith("data:")) {
            continue;
          }
          const payload = line.slice(5).trim();
          if (!payload) {
            continue;
          }
          let eventRow: {
            type: string;
            text?: string;
            conversationId?: string;
            messageId?: string;
            message?: string;
            proposal?: CalendarProposal;
            extractMemory?: boolean;
          };
          try {
            eventRow = JSON.parse(payload) as typeof eventRow;
          } catch {
            continue;
          }
          if (eventRow.type === "conversation" && eventRow.conversationId) {
            nextConversationId = eventRow.conversationId;
            setConversationId(eventRow.conversationId);
          } else if (eventRow.type === "text" && eventRow.text) {
            reply += eventRow.text;
            const next = reply;
            setMessages((current) =>
              current.map((row) =>
                row.id === `${pendingId}-reply` ? { ...row, content: next } : row,
              ),
            );
          } else if (eventRow.type === "proposal" && eventRow.proposal) {
            proposal = parseProposal(eventRow.proposal);
            const captured = proposal;
            setMessages((current) =>
              current.map((row) =>
                row.id === `${pendingId}-reply` ? { ...row, proposal: captured } : row,
              ),
            );
          } else if (eventRow.type === "error") {
            throw new Error(eventRow.message || "Ask Ahead failed.");
          } else if (eventRow.type === "done") {
            savedId = eventRow.messageId ?? null;
            if (eventRow.conversationId) {
              nextConversationId = eventRow.conversationId;
              setConversationId(eventRow.conversationId);
            }
            extractMemory = eventRow.extractMemory === true;
          }
        }
      }
      if (!reply && !proposal) {
        throw new Error("Ask Ahead returned an empty answer. Try again.");
      }
      setMessages((current) =>
        current.map((row) =>
          row.id === `${pendingId}-reply`
            ? {
                id: savedId ?? row.id,
                role: "assistant",
                content: reply,
                proposal,
              }
            : row,
        ),
      );
      if (extractMemory && nextConversationId) {
        void extractAiMemory(nextConversationId);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ask Ahead failed.");
      setMessages((current) =>
        current.filter((row) => row.id !== pendingId && row.id !== `${pendingId}-reply`),
      );
      setDraft(content);
    } finally {
      setBusy(false);
    }
  }

  async function applyProposal(message: ChatMessage) {
    if (!message.proposal || message.proposal.status !== "pending") {
      return;
    }
    if (!message.proposal.id) {
      setError("This proposal cannot be applied. Ask again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await applyCalendarProposal(message.proposal.id);
      const next: CalendarProposal = { ...message.proposal, status: "applied" };
      setMessages((current) =>
        current.map((row) => (row.id === message.id ? { ...row, proposal: next } : row)),
      );
      notifyCalendarPreview(null);
      notifyCalendarChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not apply that change.");
    } finally {
      setBusy(false);
    }
  }

  async function dismissProposal(message: ChatMessage) {
    if (!message.proposal) {
      return;
    }
    const next: CalendarProposal = { ...message.proposal, status: "dismissed" };
    const supabase = createClient();
    if (message.proposal.id) {
      await supabase
        .from("calendar_proposals")
        .update({ status: "dismissed" })
        .eq("id", message.proposal.id);
    }
    await supabase.from("messages").update({ proposal: next }).eq("id", message.id);
    setMessages((current) =>
      current.map((row) => (row.id === message.id ? { ...row, proposal: next } : row)),
    );
    notifyCalendarPreview(null);
  }

  async function undoProposal(message: ChatMessage) {
    if (!message.proposal?.id || message.proposal.status !== "applied") {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await undoCalendarProposal(message.proposal.id);
      const next: CalendarProposal = { ...message.proposal, status: "undone" };
      setMessages((current) =>
        current.map((row) => (row.id === message.id ? { ...row, proposal: next } : row)),
      );
      notifyCalendarChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not undo that change.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="home-cta home-cta-sm"
        aria-expanded={open}
        aria-controls="ask-potential"
      >
        <AskPotentialIcon />
        Ask Ahead
      </button>
      {open ? (
        <div
          id="ask-potential"
          className="fixed inset-x-3 top-[5.25rem] bottom-3 z-40 flex flex-col overflow-hidden border border-line bg-paper-raised shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:inset-x-auto sm:right-4 sm:w-[24rem]"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-xl font-medium tracking-tight text-ink">Ask Ahead</p>
              <p className="text-[12px] text-muted">I remember you and this calendar.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 items-center rounded-sm px-2 text-sm text-ink-soft hover:bg-paper-sunken hover:text-ink"
            >
              Close
            </button>
          </div>
          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <p className="text-sm leading-6 text-ink-soft">
                Ask about a week, a race, or what to do next. I can read your
                history and put sessions on the diary — you apply the change.
              </p>
            ) : (
              <ul className="grid gap-4">
                {messages.map((message) => (
                  <li key={message.id}>
                    <p className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">
                      {message.role === "user" ? "You" : "Ahead"}
                    </p>
                    {message.content ? (
                      message.role === "assistant" ? (
                        <ChatMarkdown text={message.content} />
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">
                          {message.content}
                        </p>
                      )
                    ) : busy && message.role === "assistant" ? (
                      <p className="mt-1 text-sm text-muted" aria-live="polite">
                        Thinking
                        <span className="ml-0.5 inline-flex w-[1.1em] justify-between tracking-normal" aria-hidden="true">
                          <span className="potential-thinking-dot">.</span>
                          <span className="potential-thinking-dot">.</span>
                          <span className="potential-thinking-dot">.</span>
                        </span>
                      </p>
                    ) : null}
                    {message.proposal ? (
                      <ProposalCard
                        proposal={message.proposal}
                        disabled={busy}
                        onApply={() => void applyProposal(message)}
                        onDismiss={() => void dismissProposal(message)}
                        onUndo={() => void undoProposal(message)}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <form className="border-t border-line p-3" onSubmit={(event) => void send(event)}>
            {error ? (
              <p className="mb-2 text-[13px] text-danger" role="alert">
                {error}
              </p>
            ) : null}
            {!ready ? (
              <p className="mb-2 text-[13px] text-muted">
                Ask Ahead is not configured yet. Add OPENAI_API_KEY as a
                Supabase Edge Function secret.
              </p>
            ) : null}
            <label htmlFor="ask-input" className="sr-only">
              Message Ask Ahead
            </label>
            <textarea
              id="ask-input"
              className="min-h-16 w-full resize-none border border-line bg-paper-sunken px-3 py-2 text-sm text-ink placeholder:text-muted"
              value={draft}
              onChange={(change) => setDraft(change.target.value)}
              onKeyDown={(key) => {
                if (key.key === "Enter" && !key.shiftKey) {
                  key.preventDefault();
                  key.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="How did the last four weeks look?"
              disabled={busy || !ready}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted">Not a doctor. Not a watch.</p>
              <button
                type="submit"
                className="home-cta home-cta-sm disabled:opacity-50"
                disabled={busy || !ready || !draft.trim()}
              >
                {busy ? "…" : "Send"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function ProposalCard({
  proposal,
  disabled,
  onApply,
  onDismiss,
  onUndo,
}: {
  proposal: CalendarProposal;
  disabled: boolean;
  onApply: () => void;
  onDismiss: () => void;
  onUndo: () => void;
}) {
  const changes = proposedChanges(proposal.operations, proposal.snapshot);
  if (proposal.status === "applied") {
    const summary = appliedSummary(changes);
    return (
      <div className="mt-3 rounded-sm border border-line bg-paper-raised p-3">
        <p className="text-sm font-medium text-ink">{summary.headline}</p>
        {summary.dates ? (
          <p className="mt-1 text-[13px] text-ink-soft">{summary.dates}</p>
        ) : null}
        <button
          type="button"
          onClick={onUndo}
          disabled={disabled}
          className="mt-3 inline-flex h-8 items-center rounded-sm px-3 text-[13px] text-ink-soft hover:bg-paper-sunken hover:text-ink"
        >
          Undo
        </button>
      </div>
    );
  }
  if (proposal.status === "dismissed" || proposal.status === "undone") {
    return (
      <p className="mt-2 text-[12px] text-muted">
        {proposal.status === "undone" ? "Undone." : "Dismissed."}
      </p>
    );
  }
  return (
    <div className="mt-3 rounded-sm border border-line bg-paper-raised p-3">
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">
        Proposed calendar changes
      </p>
      <ul className="mt-3 grid gap-3">
        {changes.map((change, index) => (
          <li key={`${change.kind}-${index}`}>
            {change.kind === "move" ? (
              <>
                <p className="text-[13px] text-muted line-through">
                  {formatWeekdayDate(change.fromDate)} {change.title}
                  {durationLabel(change.durationMinutes)
                    ? ` ${durationLabel(change.durationMinutes)}`
                    : ""}
                </p>
                <p className="mt-1 text-[13px] font-medium text-ink">
                  {headingFor(change)}
                </p>
                <p className="text-sm text-ink">{change.title}</p>
                {durationLabel(change.durationMinutes) ? (
                  <p className="mt-0.5 text-[13px] text-ink-soft">
                    {durationLabel(change.durationMinutes)}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-[13px] font-medium text-ink">{headingFor(change)}</p>
                <p className={`text-sm ${change.kind === "delete" ? "text-muted line-through" : "text-ink"}`}>
                  {change.title}
                </p>
                {changeMeta(change) ? (
                  <p className="mt-0.5 text-[13px] text-ink-soft">{changeMeta(change)}</p>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onApply}
          disabled={disabled}
          className="home-cta home-cta-sm"
        >
          Apply changes
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={disabled}
          className="inline-flex h-8 items-center rounded-sm px-3 text-[13px] text-ink-soft hover:bg-paper-sunken hover:text-ink"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function AskPotentialIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 1.25l1.05 4.2 4.2 1.05-4.2 1.05L8 11.75l-1.05-4.2-4.2-1.05 4.2-1.05z"
        fill="currentColor"
      />
      <path
        d="M12.75 9.5l.48 1.72 1.72.48-1.72.48-.48 1.72-.48-1.72-1.72-.48 1.72-.48z"
        fill="currentColor"
      />
    </svg>
  );
}
