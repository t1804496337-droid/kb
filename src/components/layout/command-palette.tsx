"use client";

import * as React from "react";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

const OPEN_EVENT = "kb:open-cmdk";

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[15vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={() => setOpen(false)}
    >
      <Command
        className={cn(
          "w-full max-w-lg overflow-hidden rounded-[12px] border border-border bg-card shadow-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 text-muted" aria-hidden />
          <Command.Input
            placeholder="Search notes, jump, or run a command…"
            className="h-12 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted"
            autoFocus
          />
        </div>
        <Command.List className="max-h-72 overflow-y-auto p-2 text-sm">
          <Command.Empty className="px-3 py-6 text-center text-muted">
            Search index not built yet (FlexSearch stub).
          </Command.Empty>
          <Command.Group
            heading="Navigate"
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted"
          >
            <Command.Item
              className="cursor-pointer rounded-[8px] px-3 py-2 text-foreground aria-selected:bg-white/5"
              onSelect={() => setOpen(false)}
            >
              Dashboard
            </Command.Item>
            <Command.Item
              className="cursor-pointer rounded-[8px] px-3 py-2 text-foreground aria-selected:bg-white/5"
              onSelect={() => setOpen(false)}
            >
              Knowledge Base
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}

export function CommandKHint() {
  return (
    <button
      type="button"
      className="hidden items-center gap-2 rounded-[12px] border border-border bg-card px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:text-foreground md:inline-flex"
      onClick={() => openCommandPalette()}
      aria-label="Open command palette"
    >
      <span>Search</span>
      <kbd className="rounded border border-border bg-background px-1.5 font-mono text-[11px]">
        ⌘K
      </kbd>
    </button>
  );
}
