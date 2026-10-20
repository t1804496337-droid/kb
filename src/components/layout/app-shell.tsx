"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Search, Ticket, Plus } from "lucide-react";
import { DrawerNav } from "./drawer-nav";
import { BloomAtmosphere } from "./bloom-atmosphere";
import { MeshGradient } from "./mesh-gradient";
import { CursorSpotlight } from "./cursor-spotlight";
import { CommandPalette, CommandKHint, openCommandPalette } from "./command-palette";
import { MagneticCursor } from "@/components/ui/magnetic-cursor";
import { NAV_ITEMS } from "@/lib/nav";

const HEADERS: Record<string, { title: string; sub: string }> = {
  "/": { title: "Hey, Need help?", sub: "Just ask me anything." },
  "/kb": { title: "知识库", sub: "Folders · Tags · 本地 stub" },
  "/studio": { title: "创作台", sub: "TANG / NEURAL · 银黑 Creative studio" },
  "/workflows": { title: "工作流", sub: "_site/workflows · 流程卡片" },
  "/tickets": { title: "工单看板", sub: "_site/tickets · 待办 / 进行 / 完成" },
  "/tools": { title: "入口", sub: "Shortcuts · 工具网格" },
};

function headerFor(pathname: string) {
  if (HEADERS[pathname]) return HEADERS[pathname];
  const hit = NAV_ITEMS.find((n) => n.href !== "/" && pathname.startsWith(n.href));
  if (hit) return HEADERS[hit.href] ?? { title: hit.label, sub: hit.panelTitle };
  return HEADERS["/"];
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { title, sub } = headerFor(pathname);

  /* Xuan 创作面板：全屏原版壳，不套 KB 顶栏 / 抽屉 */
  if (pathname === "/studio" || pathname.startsWith("/studio/")) {
    return <>{children}</>;
  }

  return (
    <div className="bg-wealth relative min-h-screen text-foreground">
      {/* Layer: base bg → mesh → bloom → spotlight → UI */}
      <MeshGradient />
      <BloomAtmosphere />
      <CursorSpotlight />
      {/* Soft magnetic glow above glass UI (md+); pointer-events none */}
      <MagneticCursor />
      <DrawerNav />

      {/* Layout reserved for slim rail only — drawer overlays, does not crush */}
      <div className="relative z-10 flex min-h-screen flex-col justify-start pl-[4.5rem] pr-3 pt-3 pb-3 md:pl-20 md:pr-5 md:pt-4 md:pb-4">
        <div className="relative flex min-h-0 flex-1 flex-col">
          <header className="relative z-20 mb-4 flex shrink-0 items-start justify-between gap-4 px-1 md:mb-5 md:px-2">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {title}
              </h1>
              <p className="mt-0.5 text-lg text-foreground/80 md:text-xl">{sub}</p>
            </div>
            <div className="flex items-center gap-3">
              <CommandKHint />
              <div className="glass-pill hidden items-center gap-2 rounded-full py-1 pl-1 pr-3 sm:flex">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/25 text-xs font-bold text-accent">
                  T
                </span>
                <div className="leading-tight">
                  <p className="text-xs font-medium">tang</p>
                  <p className="text-[10px] text-muted">KB Radar</p>
                </div>
              </div>
              <button
                type="button"
                className="glass flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-accent"
                aria-label="添加"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </header>

          <main className="relative flex flex-1 flex-col justify-start overflow-y-auto pb-20 md:pb-6">
            {children}
          </main>
        </div>
      </div>

      <CommandPalette />

      <nav
        className="glass-strong fixed inset-x-3 bottom-3 z-40 flex h-14 items-center justify-around rounded-[16px] border border-white/15 md:hidden"
        aria-label="移动端导航"
      >
        <Link href="/" className="flex flex-col items-center gap-0.5 text-muted hover:text-accent">
          <Home className="h-5 w-5" strokeWidth={1.75} />
          <span className="text-[10px]">首页</span>
        </Link>
        <Link href="/kb" className="flex flex-col items-center gap-0.5 text-muted hover:text-accent">
          <BookOpen className="h-5 w-5" strokeWidth={1.75} />
          <span className="text-[10px]">知识库</span>
        </Link>
        <button
          type="button"
          onClick={() => openCommandPalette()}
          className="flex flex-col items-center gap-0.5 text-muted hover:text-accent"
        >
          <Search className="h-5 w-5" strokeWidth={1.75} />
          <span className="text-[10px]">搜索</span>
        </button>
        <Link href="/tickets" className="flex flex-col items-center gap-0.5 text-muted hover:text-accent">
          <Ticket className="h-5 w-5" strokeWidth={1.75} />
          <span className="text-[10px]">工单</span>
        </Link>
      </nav>
    </div>
  );
}
