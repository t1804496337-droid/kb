"use client";

import * as React from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";

/** Delay router.push so Spring Overshoot bounce is visible before route change */
const NAV_DELAY_MS = 200;

const SHADOW_REST =
  "5px 5px 14px rgba(0, 0, 0, 0.55), -4px -4px 10px rgba(255, 255, 255, 0.07)";
const SHADOW_HOVER =
  "7px 12px 22px rgba(0, 0, 0, 0.5), -3px -3px 10px rgba(255, 255, 255, 0.09), 0 0 18px rgba(94, 234, 212, 0.16)";
const SHADOW_PRESS =
  "inset 5px 5px 14px rgba(0, 0, 0, 0.62), inset -2px -2px 6px rgba(255, 255, 255, 0.04)";
const SHADOW_ACTIVE_REST =
  "5px 5px 14px rgba(0, 0, 0, 0.45), -3px -3px 8px rgba(255, 255, 255, 0.06), 0 0 14px rgba(200, 245, 66, 0.2)";
const SHADOW_ACTIVE_HOVER =
  "7px 12px 22px rgba(0, 0, 0, 0.4), -2px -2px 8px rgba(255, 255, 255, 0.08), 0 0 22px rgba(200, 245, 66, 0.3)";
const SHADOW_ACTIVE_PRESS =
  "inset 5px 5px 12px rgba(0, 0, 0, 0.52), inset -1px -1px 4px rgba(255, 255, 255, 0.05), 0 0 10px rgba(200, 245, 66, 0.12)";

const springRelease = {
  type: "spring" as const,
  stiffness: 480,
  damping: 16,
  mass: 0.65,
};

const springDrawer = {
  type: "spring" as const,
  stiffness: 380,
  damping: 28,
  mass: 0.85,
};

type RailBtnProps = {
  href: string;
  label: string;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
  onNavigate?: () => void;
};

function RailButton({
  href,
  label,
  active,
  className,
  children,
  onNavigate,
}: RailBtnProps) {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const timer = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const navigate = () => {
    if (timer.current) window.clearTimeout(timer.current);
    const run = () => {
      if (pathname !== href) router.push(href);
      onNavigate?.();
    };
    if (reduce) {
      run();
      return;
    }
    timer.current = window.setTimeout(run, NAV_DELAY_MS);
  };

  const restShadow = active ? SHADOW_ACTIVE_REST : SHADOW_REST;
  const hoverShadow = active ? SHADOW_ACTIVE_HOVER : SHADOW_HOVER;
  const pressShadow = active ? SHADOW_ACTIVE_PRESS : SHADOW_PRESS;

  return (
    <motion.button
      type="button"
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={navigate}
      className={cn(
        "rail-icon flex items-center justify-center rounded-full text-muted",
        active && "rail-icon-active",
        className
      )}
      initial={false}
      animate={
        reduce
          ? { scale: 1, y: 0 }
          : { scale: 1, y: 0, boxShadow: restShadow }
      }
      whileHover={
        reduce ? undefined : { scale: 1.05, y: -2, boxShadow: hoverShadow }
      }
      whileTap={
        reduce ? undefined : { scale: 0.96, y: 1, boxShadow: pressShadow }
      }
      transition={reduce ? { duration: 0 } : springRelease}
    >
      {children}
    </motion.button>
  );
}

type DrawerRowProps = {
  href: string;
  label: string;
  subtitle: string;
  active?: boolean;
  icon: React.ReactNode;
  onNavigate?: () => void;
};

function DrawerRow({
  href,
  label,
  subtitle,
  active,
  icon,
  onNavigate,
}: DrawerRowProps) {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const timer = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const navigate = () => {
    if (timer.current) window.clearTimeout(timer.current);
    const run = () => {
      if (pathname !== href) router.push(href);
      onNavigate?.();
    };
    if (reduce) {
      run();
      return;
    }
    timer.current = window.setTimeout(run, NAV_DELAY_MS);
  };

  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={navigate}
      className={cn(
        "drawer-row group flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2 text-left",
        active ? "drawer-row-active" : "text-muted"
      )}
      initial={false}
      whileHover={reduce ? undefined : { scale: 1.02, x: 2 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={reduce ? { duration: 0 } : springRelease}
    >
      <span
        className={cn(
          "rail-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          active && "rail-icon-active"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm font-medium leading-tight",
            active ? "text-accent" : "text-foreground group-hover:text-foreground"
          )}
        >
          {label}
        </span>
        <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted">
          {subtitle}
        </span>
      </span>
      {active ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full dot-neon" aria-hidden />
      ) : null}
    </motion.button>
  );
}

/**
 * 抽屉卡片式 left nav — collapsed slim icon rail;
 * hover (desktop) / tap toggle expands a floating glass drawer card
 * overlaying content (does not reflow main).
 */
export function DrawerNav() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [hovered, setHovered] = React.useState(false);
  const [pinned, setPinned] = React.useState(false);
  const closeTimer = React.useRef<number | null>(null);

  const open = hovered || pinned;

  const clearClose = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const onEnter = () => {
    clearClose();
    setHovered(true);
  };

  const onLeave = () => {
    clearClose();
    // Small grace so moving between rail and card doesn't flicker
    closeTimer.current = window.setTimeout(() => setHovered(false), 120);
  };

  React.useEffect(
    () => () => {
      clearClose();
    },
    []
  );

  // Esc closes pinned drawer
  React.useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinned(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned]);

  const afterNavigate = () => {
    // Keep hover open on desktop; unpin on intentional pin-mode (tap)
    setPinned(false);
  };

  return (
    <>
      {/* Soft scrim when pinned — click closes; pointer-events only when pinned */}
      <AnimatePresence>
        {pinned ? (
          <motion.button
            type="button"
            aria-label="关闭导航抽屉"
            className="fixed inset-0 z-[35] bg-black/25 md:bg-transparent"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.18 }}
            onClick={() => setPinned(false)}
          />
        ) : null}
      </AnimatePresence>

      <div
        className="pointer-events-none fixed top-4 bottom-4 left-3 z-40 flex items-start gap-0 md:left-4"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {/* Slim icon rail — always visible */}
        <aside
          className="glass-strong pointer-events-auto relative flex h-full w-14 shrink-0 flex-col items-center rounded-[22px] py-4 shadow-[0_16px_48px_rgba(0,0,0,0.4)]"
          aria-label="主导航"
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
        >
          <RailButton
            href="/"
            label="KB Radar"
            className="mb-3 h-9 w-9 bg-accent/20 font-mono text-xs font-bold text-accent"
            onNavigate={afterNavigate}
          >
            KB
          </RailButton>

          <button
            type="button"
            className={cn(
              "mb-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-muted transition-colors hover:text-accent",
              pinned && "bg-accent/15 text-accent border-accent/30"
            )}
            aria-label={open ? "收起导航抽屉" : "展开导航抽屉"}
            aria-expanded={open}
            aria-controls="drawer-nav-panel"
            onClick={() => setPinned((p) => !p)}
          >
            <PanelLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>

          <nav className="flex flex-1 flex-col items-center gap-2">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <RailButton
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={active}
                  className="h-10 w-10"
                  onNavigate={afterNavigate}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </RailButton>
              );
            })}
          </nav>

          <span className="mt-auto h-1.5 w-1.5 rounded-full dot-neon" aria-hidden />
        </aside>

        {/* Invisible hover bridge across gap so drawer stays open */}
        {open ? (
          <div
            className="pointer-events-auto h-48 w-2 shrink-0 self-start"
            aria-hidden
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
          />
        ) : null}

        {/* Floating drawer card — overlays content, does not crush layout */}
        <AnimatePresence>
          {open ? (
            <motion.div
              id="drawer-nav-panel"
              role="dialog"
              aria-label="导航抽屉"
              className="drawer-card glass-strong pointer-events-auto relative z-50 flex w-[248px] shrink-0 flex-col rounded-[22px] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.06)]"
              onMouseEnter={onEnter}
              onMouseLeave={onLeave}
              initial={
                reduce
                  ? { opacity: 1, x: 0, scale: 1 }
                  : { opacity: 0, x: -18, scale: 0.94 }
              }
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, x: -14, scale: 0.96 }
              }
              transition={reduce ? { duration: 0 } : springDrawer}
            >
              <div className="mb-2 flex items-center justify-between px-1.5 pt-0.5">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
                    Navigate
                  </p>
                  <p className="text-sm font-semibold text-foreground">KB Radar</p>
                </div>
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                  tang
                </span>
              </div>

              <nav className="flex flex-col gap-0.5" aria-label="抽屉导航">
                {NAV_ITEMS.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <DrawerRow
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      subtitle={item.subtitle}
                      active={active}
                      onNavigate={afterNavigate}
                      icon={
                        <Icon className="h-4 w-4" strokeWidth={1.75} />
                      }
                    />
                  );
                })}
              </nav>

              <p className="mt-3 px-1.5 text-[10px] leading-relaxed text-muted/80">
                悬停展开 · 点{" "}
                <PanelLeft className="inline h-3 w-3 align-[-2px]" />{" "}
                固定 · Esc 关闭
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}

/** @deprecated use DrawerNav — kept for any stray imports */
export { DrawerNav as IconRail };
