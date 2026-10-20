"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";

const OPEN_EVENT = "kb:open-cmdk";

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 pt-[14vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="命令面板"
      onClick={() => setOpen(false)}
    >
      <Command
        className={cn(
          "glass-strong panel-glow w-full max-w-lg overflow-hidden rounded-[16px]"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-white/[0.08] px-3">
          <Search className="h-4 w-4 text-accent" aria-hidden />
          <Command.Input
            placeholder="搜索笔记、跳转页面…"
            className="h-12 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted"
            autoFocus
          />
        </div>
        <Command.List className="max-h-72 overflow-y-auto p-2 text-sm">
          <Command.Empty className="px-3 py-6 text-center text-muted">
            搜索索引尚未构建（FlexSearch stub）
          </Command.Empty>
          <Command.Group
            heading="跳转"
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted"
          >
            {NAV_ITEMS.map((item) => (
              <Command.Item
                key={item.href}
                className="cursor-pointer rounded-[10px] px-3 py-2.5 text-foreground aria-selected:bg-accent/10 aria-selected:text-accent"
                onSelect={() => {
                  setOpen(false);
                  router.push(item.href);
                }}
              >
                {item.label}
              </Command.Item>
            ))}
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
      className="glass hidden items-center gap-2 rounded-[12px] px-3 py-1.5 text-sm text-muted transition-all duration-200 hover:border-accent/30 hover:text-foreground md:inline-flex"
      onClick={() => openCommandPalette()}
      aria-label="打开命令面板"
    >
      <Search className="h-3.5 w-3.5 text-accent/80" />
      <span>搜索</span>
      <kbd className="rounded border border-white/10 bg-black/30 px-1.5 font-mono text-[11px] text-muted">
        ⌘K
      </kbd>
    </button>
  );
}
