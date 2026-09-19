"use client";

import { AccountMenu } from "@/components/app/account-menu";
import { ActivityModal } from "@/components/app/activity-modal";
import { CompareModal } from "@/components/app/compare-modal";
import { AskPotential } from "@/components/app/ask-potential";
import { SyncMenu } from "@/components/app/sync-menu";
import { getSession, needsOnboarding, type AuthUser } from "@/lib/auth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, Suspense, useContext, useEffect, useState, type ReactNode } from "react";

type AppSession = {
  user: AuthUser;
  setUser: (user: AuthUser) => void;
};

const AppUserContext = createContext<AppSession | null>(null);

export function useAppSession(): AppSession {
  const session = useContext(AppUserContext);
  if (!session) {
    throw new Error("useAppSession must be used inside AppShell");
  }
  return session;
}

export function useAppUser(): AuthUser {
  return useAppSession().user;
}

export function useOptionalAppUser(): AuthUser | null {
  return useContext(AppUserContext)?.user ?? null;
}

function navClass(active: boolean) {
  return `inline-flex h-11 items-center px-3 text-[16px] ${
    active ? "text-ink" : "text-ink-soft hover:text-ink"
  }`;
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

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
      if (needsOnboarding(session)) {
        router.replace("/onboarding");
        return;
      }
      setUser(session);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!user) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-muted">
        Loading…
      </div>
    );
  }

  const dashboardActive = pathname === "/app";
  const activitiesActive =
    pathname.startsWith("/app/activities") || pathname.startsWith("/app/calendar");
  const reviewsActive = pathname.startsWith("/app/reviews");

  return (
    <AppUserContext.Provider value={{ user, setUser }}>
      <div className="min-h-full">
        <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-paper">
          <div className="mx-auto flex h-[4.25rem] max-w-[1360px] items-center px-4 sm:h-[4.75rem] sm:px-6 lg:px-8">
            <Link
              href="/app"
              className="text-[1.35rem] font-semibold tracking-tight text-ink sm:text-[1.5rem]"
            >
              Ahead
            </Link>
            <nav aria-label="Main" className="ml-6 flex items-center gap-1 sm:ml-10 sm:gap-2">
              <Link
                href="/app"
                className={navClass(dashboardActive)}
                aria-current={dashboardActive ? "page" : undefined}
              >
                Dashboard
              </Link>
              <Link
                href="/app/activities"
                className={navClass(activitiesActive)}
                aria-current={activitiesActive ? "page" : undefined}
              >
                Activities
              </Link>
              <Link
                href="/app/reviews"
                className={navClass(reviewsActive)}
                aria-current={reviewsActive ? "page" : undefined}
              >
                Reviews
              </Link>
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <SyncMenu />
              <Suspense>
                <AskPotential />
              </Suspense>
              <AccountMenu user={user} />
            </div>
          </div>
        </header>
        <div className="h-[4.25rem] sm:h-[4.75rem]" aria-hidden />
        {children}
        <Suspense>
          <ActivityModal />
          <CompareModal />
        </Suspense>
      </div>
    </AppUserContext.Provider>
  );
}
