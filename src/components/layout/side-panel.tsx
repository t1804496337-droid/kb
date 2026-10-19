"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";

function PanelBody({ pathname }: { pathname: string }) {
  if (pathname === "/" || pathname.startsWith("/?")) {
    return (
      <ul className="space-y-1 text-sm text-muted">
        <li className="rounded-[8px] bg-white/5 px-3 py-2 text-foreground">
          Metrics
        </li>
        <li className="rounded-[8px] px-3 py-2 hover:bg-white/5">
          Recent edits
        </li>
        <li className="rounded-[8px] px-3 py-2 hover:bg-white/5">
          Quick links
        </li>
      </ul>
    );
  }
  if (pathname.startsWith("/kb")) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-muted">Folder tree (stub)</p>
        <ul className="space-y-1 font-mono text-xs text-foreground/80">
          <li className="rounded-[8px] px-3 py-2 hover:bg-white/5">AI视频情报库/</li>
          <li className="rounded-[8px] px-3 py-2 hover:bg-white/5">skills/</li>
          <li className="rounded-[8px] px-3 py-2 hover:bg-white/5">_site/</li>
        </ul>
      </div>
    );
  }
  if (pathname.startsWith("/workflows")) {
    return (
      <p className="text-sm text-muted">
        Reads <code className="font-mono text-accent">_site/workflows/*.md</code>{" "}
        (stub)
      </p>
    );
  }
  if (pathname.startsWith("/tickets")) {
    return (
      <ul className="space-y-1 text-sm text-muted">
        <li className="rounded-[8px] bg-white/5 px-3 py-2 text-foreground">
          Todo
        </li>
        <li className="rounded-[8px] px-3 py-2 hover:bg-white/5">In Progress</li>
        <li className="rounded-[8px] px-3 py-2 hover:bg-white/5">Done</li>
      </ul>
    );
  }
  if (pathname.startsWith("/tools")) {
    return (
      <p className="text-sm text-muted">
        Reads <code className="font-mono text-accent">_site/tools.json</code>{" "}
        (stub)
      </p>
    );
  }
  return <p className="text-sm text-muted">Context panel</p>;
}

export function SidePanel() {
  const pathname = usePathname();
  const item =
    NAV_ITEMS.find((n) =>
      n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)
    ) ?? NAV_ITEMS[0];

  return (
    <aside
      className="fixed inset-y-0 left-14 z-30 hidden w-[260px] flex-col border-r border-border bg-panel md:flex"
      aria-label="Section panel"
    >
      <div className="border-b border-border px-4 py-4">
        <p className="text-xs text-muted">{item.label}</p>
        <h2 className="text-base font-medium text-foreground">
          {item.panelTitle}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <PanelBody pathname={pathname} />
      </div>
    </aside>
  );
}
