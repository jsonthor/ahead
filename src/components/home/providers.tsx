"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export function HomeProviders({ children }: { children: ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={180} skipDelayDuration={80}>
      {children}
    </Tooltip.Provider>
  );
}
