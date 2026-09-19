"use client";

import { signOut, type AuthUser } from "@/lib/auth";
import * as Avatar from "@radix-ui/react-avatar";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";

const itemClassName =
  "flex cursor-pointer items-center rounded-sm px-2 py-2 text-sm text-ink outline-none data-[highlighted]:bg-paper-sunken";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function avatarSrc(name: string) {
  const label = initials(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="19.25" fill="#171717" stroke="rgba(255,255,255,0.16)" stroke-width="1.5"/>
    <text x="20" y="21" text-anchor="middle" dominant-baseline="middle" fill="#f5f5f3" font-family="ui-sans-serif, system-ui, sans-serif" font-size="16" font-weight="600">${label}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function AccountMenu({ user }: { user: AuthUser }) {
  const router = useRouter();
  const label = initials(user.displayName);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full p-0"
          aria-label="Account menu"
        >
          <Avatar.Root className="inline-flex h-10 w-10 overflow-hidden rounded-full border border-line bg-paper-sunken">
            <Avatar.Image
              src={avatarSrc(user.displayName)}
              alt=""
              className="h-full w-full object-cover"
            />
            <Avatar.Fallback
              delayMs={0}
              className="flex h-full w-full items-center justify-center text-[13px] font-medium text-ink"
            >
              {label}
            </Avatar.Fallback>
          </Avatar.Root>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-44 border border-line bg-paper-raised p-1 shadow-[0_16px_40px_rgba(0,0,0,0.4)]"
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-[12px] text-muted">
            {user.displayName}
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            className={itemClassName}
            onSelect={() => router.push("/app/profile")}
          >
            Profile
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={itemClassName}
            onSelect={() => router.push("/app/zones")}
          >
            Zones
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={itemClassName}
            onSelect={() => router.push("/app/connect")}
          >
            Connect
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            className={itemClassName}
            onSelect={() => {
              void signOut().then(() => {
                router.push("/");
                router.refresh();
              });
            }}
          >
            Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
