"use client";

import { IconRail } from "./icon-rail";
import { SidePanel } from "./side-panel";
import { CommandPalette, CommandKHint } from "./command-palette";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <IconRail />
      <SidePanel />
      <div className="md:pl-[calc(56px+260px)] pl-14">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm md:px-6">
          <p className="text-sm text-muted">Personal Knowledge Base</p>
          <CommandKHint />
        </header>
        <main className="px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
      <CommandPalette />
      {/* Mobile bottom nav stub — polish in S7 */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t border-border bg-rail md:hidden"
        aria-label="Mobile navigation stub"
      >
        <span className="text-xs text-muted">Home</span>
        <span className="text-xs text-muted">KB</span>
        <span className="text-xs text-muted">Search</span>
        <span className="text-xs text-muted">Tickets</span>
      </nav>
    </div>
  );
}
