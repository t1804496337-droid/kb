"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Neumorph #3 — shared-element style expand (same node morphs) */
export function SharedExpand({
  className,
  title,
  subtitle,
  children,
}: {
  className?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      className={cn(
        "shared-expand glass text-left w-full rounded-[16px] border border-white/10 p-4",
        open && "shared-expand-open",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          {subtitle ? (
            <p className="mt-0.5 font-mono text-[11px] text-muted">{subtitle}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "shared-expand-chevron text-muted transition-transform duration-300",
            open && "rotate-90 text-accent"
          )}
        >
          ›
        </span>
      </div>
      <div
        className={cn(
          "shared-expand-body grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="pt-3 text-sm text-muted">{children}</div>
        </div>
      </div>
    </button>
  );
}
