"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── FUI radial menu engine (2026-10-22, hud-radial) ──
 * One component, two summon flows:
 *  · desktop — a global contextmenu listener opens the wheel at the
 *    cursor. Form fields are exempt (same pass-through rule as the
 *    command palette): INPUT / TEXTAREA / SELECT / contentEditable
 *    targets keep the browser's native copy/paste menu.
 *  · mobile — a still 450ms long-press (pointerdown, touch/pen)
 *    opens it "armed": the finger slides to a sector and release
 *    fires. Movement >10px / lift / scroll cancels the press, so it
 *    never fights the drag engine (a press that moves is a drag; a
 *    press that stays is a summon).
 * Sectors are SVG annular paths — the path itself is the hit area,
 * and hit-testing is pure geometry (angle → sector, radius must sit
 * in the [R0, R1] band): the inter-sector gaps, the hub and the
 * outside never hit. */

export type RadialActions = {
  exportSnap: () => void;
  importSnap: () => void;
  newTicket: () => void;
  toggleZen: () => void;
  openPalette: () => void;
  /** 拼图三（hud-health-sync）：剪贴板健康解析口，宿主异步执行。 */
  syncHealth: () => void;
  /** UX 整改（hud-ux-dock）：打开顶部标语编辑浮层。 */
  editMarquee: () => void;
};

type Sector = {
  key: string;
  label: string;
  short: string;
  act: keyof RadialActions;
};

/* clockwise from the top — geometry is parameterised by the sector
 * count (STEP = 360 / n), so adding a sector re-flows the whole wheel
 * without touching the hit-test math. */
const SECTORS: Sector[] = [
  { key: "export", label: "导出快照", short: "导出", act: "exportSnap" },
  { key: "import", label: "导入还原", short: "导入", act: "importSnap" },
  { key: "zen", label: "禅定模式", short: "禅定", act: "toggleZen" },
  { key: "palette", label: "命令面板", short: "面板", act: "openPalette" },
  { key: "ticket", label: "新建待办", short: "待办", act: "newTicket" },
  { key: "health", label: "同步健康 · SYNC HEALTH", short: "健康", act: "syncHealth" },
  { key: "marquee", label: "编辑标语", short: "标语", act: "editMarquee" },
];

const R0 = 36;
const R1 = 106;
const GAP = 4; /* degrees of dead angle between neighbouring sectors */
const STEP = 360 / SECTORS.length; /* ≈51.4° at seven sectors */
const LONG_PRESS_MS = 450;
const EDGE = 126; /* wheel radius 118 + 8px safety, for centre clamping */

/** Point on the wheel for radius r at `deg` (0° = top, clockwise). */
const pt = (r: number, deg: number): [number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [120 + r * Math.sin(rad), 120 - r * Math.cos(rad)];
};

const sectorPath = (i: number): string => {
  const a0 = i * STEP + GAP / 2;
  const a1 = (i + 1) * STEP - GAP / 2;
  const [x0, y0] = pt(R1, a0);
  const [x1, y1] = pt(R1, a1);
  const [x2, y2] = pt(R0, a1);
  const [x3, y3] = pt(R0, a0);
  const f = (n: number) => n.toFixed(2);
  return (
    `M${f(x0)},${f(y0)} A${R1},${R1} 0 0 1 ${f(x1)},${f(y1)} ` +
    `L${f(x2)},${f(y2)} A${R0},${R0} 0 0 0 ${f(x3)},${f(y3)} Z`
  );
};

/**
 * Geometric hit-test against the wheel centred at (cx, cy) in client
 * coordinates. The band edges and the gap edges are exclusive (with
 * a hair of epsilon), so boundary probes never highlight.
 */
export const radialHitSector = (
  x: number,
  y: number,
  cx: number,
  cy: number,
): number | null => {
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.hypot(dx, dy);
  if (r <= R0 + 0.5 || r >= R1 - 0.5) return null;
  const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  const i = Math.floor(deg / STEP);
  const local = deg - i * STEP;
  if (local <= GAP / 2 + 0.05 || local >= STEP - GAP / 2 - 0.05) return null;
  return i;
};

type MenuState = { x: number; y: number; mode: "context" | "armed" };

export function RadialMenu({
  actions,
  zenActive,
  siblingOpen,
  onOpenChange,
  onLongPressSummon,
}: {
  actions: RadialActions;
  /** 禅定 sector shows its engaged state. */
  zenActive: boolean;
  /** Command palette open → the wheel must not coexist with it. */
  siblingOpen: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Long-press fired: the host cancels any pending drag press. */
  onLongPressSummon?: () => void;
}) {
  const [menu, setMenu] = React.useState<MenuState | null>(null);
  const [hot, setHot] = React.useState<number | null>(null);
  const [closing, setClosing] = React.useState(false);

  const menuRef = React.useRef<MenuState | null>(null);
  const closingRef = React.useRef(false);
  const closeTimer = React.useRef(0);
  const armedId = React.useRef<number | null>(null);
  const pendingTrigger = React.useRef<number | null>(null);
  const suppressCtxUntil = React.useRef(0);
  const suppressClickUntil = React.useRef(0);
  /* true while a sector action runs: its own programmatic clicks
   * (the snapshot download anchor, the hidden file input) are
   * dispatched synchronously inside the pointerup handler and must
   * not be eaten by the trailing-click suppressor below. */
  const actingRef = React.useRef(false);
  const lpTimer = React.useRef(0);
  const lpStart = React.useRef<{ id: number; x: number; y: number } | null>(
    null,
  );
  /* last known armed-pointer position: if the browser still
   * manages to cancel the gesture (pointercancel), the release is
   * settled at this point instead of being lost. */
  const lastPos = React.useRef<{ x: number; y: number } | null>(null);

  const actionsRef = React.useRef(actions);
  const onOpenChangeRef = React.useRef(onOpenChange);
  const onLongPressSummonRef = React.useRef(onLongPressSummon);
  React.useEffect(() => {
    actionsRef.current = actions;
    onOpenChangeRef.current = onOpenChange;
    onLongPressSummonRef.current = onLongPressSummon;
  });

  const openMenu = React.useCallback(
    (x: number, y: number, mode: MenuState["mode"]) => {
      if (closeTimer.current) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = 0;
      }
      const cx = Math.min(Math.max(x, EDGE), window.innerWidth - EDGE);
      const cy = Math.min(Math.max(y, EDGE), window.innerHeight - EDGE);
      closingRef.current = false;
      setClosing(false);
      setHot(null);
      pendingTrigger.current = null;
      menuRef.current = { x: cx, y: cy, mode };
      setMenu(menuRef.current);
      onOpenChangeRef.current?.(true);
    },
    [],
  );

  const closeMenu = React.useCallback((instant = false) => {
    if (!menuRef.current) return;
    if (instant) {
      if (closeTimer.current) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = 0;
      }
      menuRef.current = null;
      closingRef.current = false;
      setMenu(null);
      setHot(null);
      setClosing(false);
      onOpenChangeRef.current?.(false);
      return;
    }
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = 0;
      menuRef.current = null;
      closingRef.current = false;
      setMenu(null);
      setHot(null);
      setClosing(false);
      onOpenChangeRef.current?.(false);
    }, 130);
  }, []);

  const runSector = React.useCallback(
    (i: number) => {
      const s = SECTORS[i];
      if (!s) return;
      const a = actionsRef.current;
      closeMenu();
      actingRef.current = true;
      try {
        switch (s.act) {
          case "exportSnap":
            a.exportSnap();
            break;
          case "importSnap":
            a.importSnap();
            break;
          case "newTicket":
            a.newTicket();
            break;
          case "toggleZen":
            a.toggleZen();
            break;
          case "openPalette":
            a.openPalette();
            break;
          case "syncHealth":
            a.syncHealth();
            break;
          case "editMarquee":
            a.editMarquee();
            break;
        }
      } finally {
        actingRef.current = false;
      }
    },
    [closeMenu],
  );

  /* mutual exclusion: the palette opening force-closes the wheel */
  React.useEffect(() => {
    if (siblingOpen && menuRef.current) closeMenu(true);
  }, [siblingOpen, closeMenu]);

  /* ── summon listeners: contextmenu + still long-press ── */
  React.useEffect(() => {
    const isFormField = (t: EventTarget | null): boolean => {
      if (!(t instanceof Element)) return false;
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT")
        return true;
      if ((t as HTMLElement).isContentEditable) return true;
      return !!t.closest('[contenteditable="true"], [contenteditable=""]');
    };
    const inMindmap = (t: EventTarget | null): boolean =>
      t instanceof Element && !!t.closest("[data-mindmap]");
    const onContextMenu = (e: MouseEvent) => {
      /* a contextmenu trailing a long-press summon is swallowed —
       * the wheel is already open, the native menu must not appear. */
      if (Date.now() < suppressCtxUntil.current) {
        e.preventDefault();
        return;
      }
      if (isFormField(e.target)) return; /* native copy/paste survives */
      /* the mind-map stage owns right-button gestures (pan) — the
       * wheel stands down there; the stage suppresses the native
       * menu itself. */
      if (inMindmap(e.target)) return;
      e.preventDefault();
      openMenu(e.clientX, e.clientY, "context");
    };
    const clearLp = () => {
      if (lpTimer.current) {
        window.clearTimeout(lpTimer.current);
        lpTimer.current = 0;
      }
      lpStart.current = null;
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || e.button !== 0) return;
      if (inMindmap(e.target)) return; /* mind-map owns its presses */
      lpStart.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      if (lpTimer.current) window.clearTimeout(lpTimer.current);
      lpTimer.current = window.setTimeout(() => {
        lpTimer.current = 0;
        const st = lpStart.current;
        if (!st) return;
        lpStart.current = null;
        armedId.current = st.id;
        lastPos.current = { x: st.x, y: st.y };
        suppressCtxUntil.current = Date.now() + 1500;
        onLongPressSummonRef.current?.();
        openMenu(st.x, st.y, "armed");
      }, LONG_PRESS_MS);
    };
    const onPointerMove = (e: PointerEvent) => {
      const st = lpStart.current;
      if (
        st &&
        e.pointerId === st.id &&
        Math.hypot(e.clientX - st.x, e.clientY - st.y) > 10
      ) {
        clearLp();
      }
    };
    const onPointerEnd = (e: PointerEvent) => {
      if (lpStart.current?.id === e.pointerId) clearLp();
    };
    const onScroll = () => clearLp();
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      window.removeEventListener("scroll", onScroll, true);
      clearLp();
    };
  }, [openMenu ]);

  /* ── interaction listeners, alive only while the wheel is open ── */
  React.useEffect(() => {
    if (!menu) return;
    const onMove = (e: PointerEvent) => {
      if (
        menu.mode === "armed" &&
        armedId.current !== null &&
        e.pointerId !== armedId.current
      ) {
        return;
      }
      if (menu.mode === "armed") {
        lastPos.current = { x: e.clientX, y: e.clientY };
      }
      setHot(radialHitSector(e.clientX, e.clientY, menu.x, menu.y));
    };
    /* while armed, the sliding finger must not be hijacked into a
     * page scroll (which would pointercancel the gesture away):
     * swallow touchmove at the source for the life of the wheel. */
    const swallowTouchMove = (e: TouchEvent) => {
      if (menu.mode === "armed") e.preventDefault();
    };
    const finishArmed = (x: number, y: number) => {
      armedId.current = null;
      const idx = radialHitSector(x, y, menu.x, menu.y);
      /* the release's trailing click must not reach the page */
      suppressClickUntil.current = Date.now() + 600;
      if (idx !== null) runSector(idx);
      else closeMenu();
    };
    const onDown = (e: PointerEvent) => {
      if (menu.mode !== "context") return;
      pendingTrigger.current = radialHitSector(
        e.clientX,
        e.clientY,
        menu.x,
        menu.y,
      );
      if (pendingTrigger.current === null) {
        /* pressed outside the wheel: dismiss (the click itself is
         * left alone — it belongs to whatever was pressed). */
        closeMenu();
      }
    };
    const onUp = (e: PointerEvent) => {
      if (menu.mode === "armed") {
        if (armedId.current !== null && e.pointerId !== armedId.current)
          return;
        finishArmed(e.clientX, e.clientY);
        return;
      }
      const p = pendingTrigger.current;
      pendingTrigger.current = null;
      if (p !== null) {
        const idx = radialHitSector(e.clientX, e.clientY, menu.x, menu.y);
        suppressClickUntil.current = Date.now() + 600;
        if (idx === p) runSector(idx);
        else closeMenu();
      }
    };
    const onClickCap = (e: MouseEvent) => {
      /* a sector action's own programmatic clicks pass untouched */
      if (actingRef.current) return;
      if (Date.now() < suppressClickUntil.current) {
        e.preventDefault();
        e.stopPropagation();
        suppressClickUntil.current = 0;
      }
    };
    const onCancel = (e: PointerEvent) => {
      if (menu.mode !== "armed") return;
      if (armedId.current !== null && e.pointerId !== armedId.current)
        return;
      const p = lastPos.current ?? { x: menu.x, y: menu.y };
      finishArmed(p.x, p.y);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    const onBlur = () => closeMenu(true);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onCancel, true);
    window.addEventListener("touchmove", swallowTouchMove, {
      passive: false,
    });
    window.addEventListener("click", onClickCap, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onCancel, true);
      window.removeEventListener("touchmove", swallowTouchMove);
      window.removeEventListener("click", onClickCap, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, [menu, closeMenu, runSector]);

  if (!menu) return null;

  return (
    <div
      className={cn("hud-radial", closing && "hud-radial-closing")}
      style={{ left: menu.x, top: menu.y }}
      data-testid="hud-radial"
      data-mode={menu.mode}
      data-hot={hot !== null ? SECTORS[hot].key : ""}
      role="menu"
      aria-label="轮盘菜单"
    >
      <svg viewBox="0 0 240 240" className="hud-radial-svg" aria-hidden>
        {SECTORS.map((s, i) => (
          <path
            key={s.key}
            d={sectorPath(i)}
            data-testid={`hud-radial-sec-${s.key}`}
            className={cn(
              "hud-radial-sec",
              hot === i && "is-hot",
              s.key === "zen" && zenActive && "is-on",
            )}
            style={{ "--i": i } as React.CSSProperties}
          />
        ))}
        {SECTORS.map((s, i) => {
          const [tx, ty] = pt((R0 + R1) / 2, i * STEP + STEP / 2);
          return (
            <text
              key={s.key}
              x={tx}
              y={ty}
              className={cn(
                "hud-radial-sec-label",
                hot === i && "is-hot",
              )}
              dominantBaseline="central"
            >
              {s.short}
            </text>
          );
        })}
        <circle cx="120" cy="120" r="33" className="hud-radial-hub" />
        <circle cx="120" cy="111" r="4" className="hud-radial-dot" />
        <text
          x="120"
          y="133"
          className="hud-radial-name"
          data-testid="hud-radial-name"
        >
          {hot !== null ? SECTORS[hot].label : "RADIAL"}
        </text>
      </svg>
    </div>
  );
}
