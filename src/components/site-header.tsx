"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import Link from "next/link";

const links = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
];

const productItems = [
  {
    href: "/#product",
    title: "The calendar you can talk to",
    body: "Ask about your history. Let the answer change the week.",
  },
  {
    href: "/#ask",
    title: "Ask Ahead",
    body: "Interrogate years of training, then act on what you learn.",
  },
  {
    href: "/#memory",
    title: "It remembers",
    body: "Every decision becomes part of what Potential knows about you.",
  },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link href="/" className="font-serif text-xl tracking-tight text-ink">
          Ahead
        </Link>

        <NavigationMenu.Root className="relative hidden md:flex">
          <NavigationMenu.List className="flex items-center gap-1">
            <NavigationMenu.Item className="relative">
              <NavigationMenu.Trigger className="inline-flex h-9 items-center rounded-sm px-3 text-sm text-ink-soft hover:text-ink data-[state=open]:text-ink">
                Product
              </NavigationMenu.Trigger>
              <NavigationMenu.Content className="absolute top-full left-0 z-50 pt-2">
                <ul className="w-[22rem] rounded-md border border-line bg-paper-raised p-2">
                  {productItems.map((item) => (
                    <li key={item.href}>
                      <NavigationMenu.Link asChild>
                        <Link
                          href={item.href}
                          className="block rounded-sm px-3 py-2.5 hover:bg-paper-sunken"
                        >
                          <div className="text-sm font-medium text-ink">
                            {item.title}
                          </div>
                          <p className="mt-0.5 text-[13px] leading-5 text-muted">
                            {item.body}
                          </p>
                        </Link>
                      </NavigationMenu.Link>
                    </li>
                  ))}
                </ul>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
            {links.slice(1).map((link) => (
              <NavigationMenu.Item key={link.href}>
                <NavigationMenu.Link asChild>
                  <Link
                    href={link.href}
                    className="inline-flex h-9 items-center rounded-sm px-3 text-sm text-ink-soft hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </NavigationMenu.Link>
              </NavigationMenu.Item>
            ))}
          </NavigationMenu.List>
        </NavigationMenu.Root>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-sm px-2.5 text-[13px] text-ink-soft hover:text-ink sm:px-3 sm:text-sm"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-9 items-center rounded-sm bg-forest px-2.5 text-[13px] font-medium text-paper hover:bg-forest-hover sm:px-3 sm:text-sm"
          >
            Coming soon
          </Link>

          <Dialog.Root>
            <Dialog.Trigger asChild>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-ink md:hidden"
                aria-label="Open menu"
              >
                <MenuIcon />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-[100] bg-ink/50 md:hidden" />
              <Dialog.Content className="fixed inset-x-0 top-0 z-[100] border-b border-line bg-paper p-4 md:hidden">
                <VisuallyHidden>
                  <Dialog.Title>Navigation</Dialog.Title>
                  <Dialog.Description>
                    Site sections and account links
                  </Dialog.Description>
                </VisuallyHidden>
                <div className="flex items-center justify-between">
                  <span className="font-serif text-xl text-ink">Ahead</span>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-ink"
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
                        className="rounded-sm px-2 py-3 text-base text-ink"
                      >
                        {link.label}
                      </Link>
                    </Dialog.Close>
                  ))}
                  <Dialog.Close asChild>
                    <Link
                      href="/login"
                      className="rounded-sm px-2 py-3 text-base text-ink"
                    >
                      Log in
                    </Link>
                  </Dialog.Close>
                </nav>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M3 5h12M3 9h12M3 13h12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M4 4l10 10M14 4L4 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  );
}
