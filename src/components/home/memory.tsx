const context = [
  { label: "Wednesday club", value: "Usually hard" },
  { label: "Sunday", value: "Frequent CX race" },
  { label: "Current block", value: "3 races / 14 days" },
  { label: "Decision", value: "Wednesday intensity reduced during race block" },
];

export function HomeMemory() {
  return (
    <section
      id="memory"
      className="scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[1360px]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-16">
          <div>
            <p className="home-mono text-[11px] tracking-[0.18em] text-[var(--home-text-3)] uppercase">
              Persistent context
            </p>
            <h2 className="mt-4 max-w-[16ch] text-4xl leading-[0.94] font-medium tracking-[-0.045em] text-[var(--home-text)] sm:text-6xl">
              It remembers what matters.
              <span className="mt-2 block text-[var(--home-text-2)]">
                You shouldn’t have to explain yourself every time.
              </span>
            </h2>
            <p className="mt-7 max-w-xl text-[17px] leading-7 text-[var(--home-text-2)] sm:text-[18px] sm:leading-8">
              Ahead remembers useful training context between conversations:
              recurring sessions, race priorities, constraints, preferences and
              previous decisions.
            </p>

            <div className="mt-10 max-w-xl border border-[var(--home-border)] bg-[var(--home-surface)] p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-medium text-[var(--home-text)]">
                  You
                </p>
              </div>
              <p className="mt-3 ml-auto max-w-[92%] bg-[#f5f5f3] px-3 py-2 text-[14px] leading-6 text-[#111]">
                Should we put Wednesday intervals back?
              </p>
              <p className="mt-5 text-[13px] font-medium text-[var(--home-text)]">
                Ahead
              </p>
              <div className="mt-3 max-w-[94%] border-l-2 border-[var(--home-accent)] bg-[var(--home-surface-2)] px-3 py-2 text-[14px] leading-6 text-[var(--home-text-2)]">
                We took them out because the Sunday races were suffering after
                hard Wednesday club sessions. I’d keep Wednesday controlled
                until this race block finishes.
              </div>
            </div>
          </div>

          <aside className="border border-[var(--home-border)] bg-[var(--home-surface)]">
            <div className="flex items-center justify-between border-b border-[var(--home-border)] px-4 py-3">
              <p className="home-mono text-[10px] tracking-[0.16em] text-[var(--home-text-3)] uppercase">
                Still true
              </p>
              <p className="home-mono text-[10px] text-[var(--home-accent)]">
                Memory
              </p>
            </div>
            <ul>
              {context.map((item, index) => (
                <li
                  key={item.label}
                  className={`grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 px-4 py-4 ${
                    index < context.length - 1
                      ? "border-b border-[var(--home-border)]"
                      : ""
                  }`}
                >
                  <p className="home-mono text-[11px] leading-6 text-[var(--home-text-3)]">
                    {item.label}
                  </p>
                  <p className="text-[15px] leading-6 text-[var(--home-text)]">
                    {item.value}
                  </p>
                </li>
              ))}
            </ul>
          </aside>
        </div>
        <p className="mt-12 max-w-xl text-[15px] leading-7 text-[var(--home-text-3)]">
          A new conversation doesn’t mean starting again.
        </p>
      </div>
    </section>
  );
}
