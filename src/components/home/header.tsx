"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import Link from "next/link";

const links = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
];

export function HomeHeader() {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-paper">
        <div className="mx-auto flex h-[4.25rem] max-w-[1440px] items-center justify-between px-4 sm:h-[4.75rem] sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-[1.35rem] font-semibold tracking-tight text-ink sm:text-[1.5rem]"
          >
            Ahead
          </Link>

          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Main"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex h-11 items-center px-3 text-[16px] text-ink-soft transition-colors hover:text-ink sm:px-4"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="inline-flex h-11 items-center px-3 text-[16px] text-ink-soft transition-colors hover:text-ink sm:px-4"
            >
              Log in
            </Link>
            <Link href="/signup" className="home-cta home-cta-sm">
              Coming soon
            </Link>

            <Dialog.Root>
              <Dialog.Trigger asChild>
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center text-ink md:hidden"
                  aria-label="Open menu"
                >
                  <MenuIcon />
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/70 md:hidden" />
                <Dialog.Content className="fixed inset-x-0 top-0 z-[100] border-b border-line bg-paper p-4 md:hidden">
                  <VisuallyHidden>
                    <Dialog.Title>Navigation</Dialog.Title>
                    <Dialog.Description>
                      Site sections and account links
                    </Dialog.Description>
                  </VisuallyHidden>
                  <div className="flex items-center justify-between">
                    <span className="text-[1.35rem] font-semibold tracking-tight text-ink">
                      Ahead
                    </span>
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        className="inline-flex h-11 w-11 items-center justify-center text-ink"
                        aria-label="Close menu"
                      >
                        <CloseIcon />
                      </button>
                    </Dialog.Close>
                  </div>
                  <nav className="mt-6 grid gap-1">
                    {links.map((link) => (
                      <Dialog.Close key={link.href} asChild>
                        <Link
                          href={link.href}
                          className="px-1 py-3 text-[17px] text-ink"
                        >
                          {link.label}
                        </Link>
                      </Dialog.Close>
                    ))}
                    <Dialog.Close asChild>
                      <Link
                        href="/login"
                        className="px-1 py-3 text-[17px] text-ink"
                      >
                        Log in
                      </Link>
                    </Dialog.Close>
                    <Dialog.Close asChild>
                      <Link href="/signup" className="home-cta mt-3 w-full">
                        Coming soon
                      </Link>
                    </Dialog.Close>
                  </nav>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </div>
      </header>
      <div className="h-[4.25rem] sm:h-[4.75rem]" aria-hidden />
    </>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M3 5h14M3 10h14M3 15h14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M4 4l12 12M16 4L4 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  );
}
