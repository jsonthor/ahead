import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-paper">
        <div className="mx-auto flex h-[4.25rem] max-w-[1360px] items-center justify-between px-4 sm:h-[4.75rem] sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-[1.35rem] font-semibold tracking-tight text-ink sm:text-[1.5rem]"
          >
            Ahead
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="inline-flex h-11 items-center px-3 text-[16px] text-ink-soft transition-colors hover:text-ink sm:px-4"
            >
              Log in
            </Link>
            <Link href="/signup" className="home-cta home-cta-sm">
              Sign up
            </Link>
          </div>
        </div>
      </header>
      <div className="h-[4.25rem] sm:h-[4.75rem]" aria-hidden />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-12 sm:py-16">
        {children}
      </main>
    </div>
  );
}
