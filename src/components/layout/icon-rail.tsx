"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";

export function IconRail() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex w-14 flex-col items-center border-r border-border bg-rail py-3"
      aria-label="Primary navigation"
    >
      <div
        className="mb-4 flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent/15 text-accent font-mono text-xs font-semibold"
        aria-hidden
      >
        KB
      </div>
      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-[12px] transition-colors duration-150",
                active
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:bg-white/5 hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
