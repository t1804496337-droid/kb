"use client";

/**
 * 灵感拓扑 Mind-Map（2026-10-22，hud-mindmap）。
 *
 * A retained-scene canvas layered over the overview's centre stage:
 * the CORE MAP sphere stays behind as a dim backdrop while this layer
 * owns every gesture inside it. World coordinates throughout —
 * screen = world * s + t — with ONE transform on the node layer and
 * the same matrix handed to the edge canvas via setTransform, so
 * pan/zoom never touches per-node layout.
 *
 * Data lives in localStorage `studio_mindmap_v1` (written on every
 * change) and is registered in snapshot.ts as the `mindmap` slice,
 * so export / import / undo-import cover it for free. The graph
 * starts EMPTY by design — no fabricated seed nodes; the empty state
 * shows the gesture primer instead.
 *
 * Painters deliberately mirror the overview drag engine
 * (neural-landing drawDragFrame): a 1px near-invisible glass rail
 * under a flowing dashed stream, and a 600ms comet pulse — white-hot
 * head, beam-colour trail of fading samples — when an edge is born.
 * The frame loop runs ONLY during gestures and pulses; a static
 * scene costs zero rAF.
 *
 * Gesture contract:
 *  · dblclick empty space — create a node there and edit it at once
 *  · node — click selects, drag (>4px) moves, dblclick edits,
 *    the × chip (or Delete) removes it with its edges
 *  · port (right edge of a node, shown on hover/selection) — drag
 *    out a link; release over another node creates the edge and
 *    fires the comet; self-links and duplicates are refused
 *  · wheel — zoom anchored at the cursor; middle / right drag, or
 *    one-finger drag on empty space — pan; two fingers — pinch zoom
 *  · right-click inside never reaches the radial wheel: the wheel
 *    itself stands down for [data-mindmap] targets (radial-menu.tsx)
 *    and this layer suppresses contextmenu outright
 *  · Delete/Backspace — delete the selected edge, else the node
 *  · Esc — exit (the host's command palette outranks it while open)
 */

import * as React from "react";

export type MMNode = { id: string; x: number; y: number; text: string };
export type MMEdge = { id: string; from: string; to: string };
export type MMView = { s: number; tx: number; ty: number };
export type MMState = { nodes: MMNode[]; edges: MMEdge[]; view: MMView };

export const MINDMAP_KEY = "studio_mindmap_v1";

const DEFAULT_VIEW: MMView = { s: 1, tx: 0, ty: 0 };
const MIN_S = 0.3;
const MAX_S = 2.5;
const PULSE_MS = 600;
const NODE_HIT_R = 58; /* world units: link-drop catch radius */
const EDGE_HIT_PX = 7; /* screen px: edge pick tolerance */
const LINK_COL = "#00ffff";

const uid = () =>
  `mm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function saneState(v: unknown): v is MMState {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  const num = (n: unknown): n is number =>
    typeof n === "number" && Number.isFinite(n);
  return (
    Array.isArray(o.nodes) &&
    o.nodes.every(
      (n) =>
        typeof n === "object" &&
        n !== null &&
        typeof (n as MMNode).id === "string" &&
        num((n as MMNode).x) &&
        num((n as MMNode).y) &&
        typeof (n as MMNode).text === "string",
    ) &&
    Array.isArray(o.edges) &&
    o.edges.every(
      (e) =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as MMEdge).id === "string" &&
        typeof (e as MMEdge).from === "string" &&
        typeof (e as MMEdge).to === "string",
    ) &&
    typeof o.view === "object" &&
    o.view !== null &&
    num((o.view as MMView).s) &&
    num((o.view as MMView).tx) &&
    num((o.view as MMView).ty)
  );
}

function loadState(): MMState {
  try {
    const raw = window.localStorage.getItem(MINDMAP_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (saneState(parsed)) return parsed;
    }
  } catch {
    /* unreadable → empty graph */
  }
  return { nodes: [], edges: [], view: { ...DEFAULT_VIEW } };
}

type Pt = { x: number; y: number };

type Gesture =
  | {
      kind: "pan";
      id: number;
      sx: number;
      sy: number;
      tx0: number;
      ty0: number;
      moved: boolean;
    }
  | {
      kind: "node";
      id: number;
      nodeId: string;
      offX: number;
      offY: number;
      sx: number;
      sy: number;
      moved: boolean;
    }
  | { kind: "link"; id: number; fromId: string; x: number; y: number }
  | {
      kind: "pinch";
      ids: [number, number];
      d0: number;
      anchor: Pt; /* world point under the pinch midpoint */
      mid: Pt; /* last midpoint, screen space */
    };

type Pulse = { x0: number; y0: number; x1: number; y1: number; start: number };

export function MindMap({
  siblingOpen,
  onClose,
}: {
  /** host overlay (command palette) currently open — it owns Esc */
  siblingOpen: boolean;
  onClose: () => void;
}) {
  const [state, setState] = React.useState<MMState>(() =>
    typeof window === "undefined"
      ? { nodes: [], edges: [], view: { ...DEFAULT_VIEW } }
      : loadState(),
  );
  const [selNode, setSelNode] = React.useState<string | null>(null);
  const [selEdge, setSelEdge] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<{
    id: string;
    fresh: boolean;
  } | null>(null);
  const [topOff, setTopOff] = React.useState(36);

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const gestureRef = React.useRef<Gesture | null>(null);
  const pointersRef = React.useRef(new Map<number, Pt>());
  const pulsesRef = React.useRef<Pulse[]>([]);
  const rafRef = React.useRef(0);
  const selEdgeRef = React.useRef<string | null>(null);
  const editInputRef = React.useRef<HTMLInputElement | null>(null);
  const siblingRef = React.useRef(siblingOpen);
  siblingRef.current = siblingOpen;
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  selEdgeRef.current = selEdge;
  const { nodes, edges, view } = state;
  const nodeById = React.useMemo(() => {
    const m = new Map<string, MMNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  /* ── persistence: write through on every change ── */
  const firstRun = React.useRef(true);
  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    try {
      window.localStorage.setItem(MINDMAP_KEY, JSON.stringify(state));
    } catch {
      /* storage full/blocked — the scene still works in memory */
    }
  }, [state]);

  /* ── top offset: leave the host topbar visible ── */
  React.useEffect(() => {
    const measure = () => {
      const bar = document.querySelector(".hud-topbar");
      const b = bar?.getBoundingClientRect().bottom;
      setTopOff(typeof b === "number" && b > 0 ? Math.round(b) : 36);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  /* ── coordinate helpers ── */
  const localPt = React.useCallback((cx: number, cy: number): Pt => {
    const r = rootRef.current?.getBoundingClientRect();
    return { x: cx - (r?.left ?? 0), y: cy - (r?.top ?? 0) };
  }, []);
  const s2w = React.useCallback(
    (p: Pt): Pt => ({
      x: (p.x - view.tx) / view.s,
      y: (p.y - view.ty) / view.s,
    }),
    [view],
  );

  /* ── edge canvas ── */
  const sizeCanvas = React.useCallback(() => {
    const c = canvasRef.current;
    const root = rootRef.current;
    if (!c || !root) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = root.clientWidth;
    const h = root.clientHeight;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.dataset.dpr = String(dpr);
  }, []);

  const draw = React.useCallback(
    (now: number) => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const st = stateRef.current;
      const dpr = Number(c.dataset.dpr || 1);
      const { s, tx, ty } = st.view;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * tx, dpr * ty);
      const byId = new Map(st.nodes.map((n) => [n.id, n]));
      /* settled edges */
      for (const e of st.edges) {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) continue;
        const hot = e.id === selEdgeRef.current;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = hot ? "#ffea00" : "rgba(0, 255, 255, 0.45)";
        ctx.lineWidth = (hot ? 2.4 : 1.4) / s;
        if (hot) {
          ctx.shadowColor = "#ffea00";
          ctx.shadowBlur = 8;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      /* in-flight link: glass rail + flowing dash stream */
      const g = gestureRef.current;
      if (g?.kind === "link") {
        const from = byId.get(g.fromId);
        if (from) {
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(g.x, g.y);
          ctx.strokeStyle = "rgba(0, 255, 255, 0.14)";
          ctx.lineWidth = 1 / s;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(g.x, g.y);
          ctx.strokeStyle = LINK_COL;
          ctx.lineWidth = 2 / s;
          ctx.setLineDash([10 / s, 8 / s]);
          ctx.lineDashOffset = -now / 16;
          ctx.shadowColor = LINK_COL;
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(g.x, g.y, 3 / s, 0, Math.PI * 2);
          ctx.fillStyle = LINK_COL;
          ctx.fill();
        }
      }
      /* comet pulses along newborn edges */
      pulsesRef.current = pulsesRef.current.filter(
        (p) => now - p.start < PULSE_MS,
      );
      for (const p of pulsesRef.current) {
        const t = Math.min(1, Math.max(0, (now - p.start) / PULSE_MS));
        const ease = 1 - (1 - t) * (1 - t);
        ctx.beginPath();
        ctx.moveTo(p.x0, p.y0);
        ctx.lineTo(p.x1, p.y1);
        ctx.strokeStyle = "rgba(0, 255, 255, 0.12)";
        ctx.lineWidth = 1 / s;
        ctx.stroke();
        const trailN =
          typeof window !== "undefined" && window.innerWidth <= 768 ? 7 : 14;
        for (let i = trailN; i >= 1; i -= 1) {
          const tt = ease - i * 0.026;
          if (tt < 0) continue;
          const px = p.x0 + (p.x1 - p.x0) * tt;
          const py = p.y0 + (p.y1 - p.y0) * tt;
          const f = 1 - i / (trailN + 1);
          ctx.beginPath();
          ctx.arc(px, py, (0.6 + 4.4 * f) / s, 0, Math.PI * 2);
          ctx.globalAlpha = 0.75 * f * f;
          ctx.fillStyle = LINK_COL;
          ctx.fill();
        }
        const hx = p.x0 + (p.x1 - p.x0) * ease;
        const hy = p.y0 + (p.y1 - p.y0) * ease;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(hx, hy, 7 / s, 0, Math.PI * 2);
        ctx.fillStyle = LINK_COL;
        ctx.shadowColor = LINK_COL;
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(hx, hy, 2.8 / s, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    },
    [],
  );
  const loop = React.useCallback(
    (now: number) => {
      rafRef.current = 0;
      draw(now);
      const busy =
        gestureRef.current !== null || pulsesRef.current.length > 0;
      if (busy) rafRef.current = requestAnimationFrame(loop);
    },
    [draw],
  );
  const ensureLoop = React.useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  /* repaint on settled-state changes (no loop while idle) */
  React.useEffect(() => {
    sizeCanvas();
    draw(performance.now());
  }, [state, selEdge, sizeCanvas, draw]);
  React.useEffect(() => {
    const onResize = () => {
      sizeCanvas();
      draw(performance.now());
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sizeCanvas, draw]);
  React.useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  /* ── mutations ── */
  const addPulse = (a: MMNode, b: MMNode) => {
    pulsesRef.current = [
      ...pulsesRef.current,
      { x0: a.x, y0: a.y, x1: b.x, y1: b.y, start: performance.now() },
    ];
    ensureLoop();
  };
  const deleteNode = React.useCallback((id: string) => {
    setState((st) => ({
      ...st,
      nodes: st.nodes.filter((n) => n.id !== id),
      edges: st.edges.filter((e) => e.from !== id && e.to !== id),
    }));
    setSelNode((v) => (v === id ? null : v));
    setEditing((v) => (v?.id === id ? null : v));
  }, []);
  const deleteEdge = React.useCallback((id: string) => {
    setState((st) => ({ ...st, edges: st.edges.filter((e) => e.id !== id) }));
    setSelEdge((v) => (v === id ? null : v));
  }, []);

  /* ── editor ── */
  const startEdit = (id: string, fresh: boolean) =>
    setEditing({ id, fresh });
  const commitEdit = React.useCallback(
    (id: string, text: string, fresh: boolean) => {
      const t = text.trim();
      setEditing(null);
      if (!t) {
        if (fresh) deleteNode(id);
        return;
      }
      setState((st) => ({
        ...st,
        nodes: st.nodes.map((n) => (n.id === id ? { ...n, text: t } : n)),
      }));
    },
    [deleteNode],
  );
  const cancelEdit = React.useCallback(
    (id: string, fresh: boolean) => {
      setEditing(null);
      if (fresh) deleteNode(id);
    },
    [deleteNode],
  );
  React.useEffect(() => {
    if (editing) {
      const el = editInputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    }
  }, [editing]);

  /* ── keyboard: Delete + Esc (palette outranks Esc) ── */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing) return; /* the input owns its keys */
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selEdge) {
          e.preventDefault();
          deleteEdge(selEdge);
        } else if (selNode) {
          e.preventDefault();
          deleteNode(selNode);
        }
      } else if (e.key === "Escape") {
        if (siblingRef.current) return;
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, selEdge, selNode, deleteEdge, deleteNode]);

  /* ── wheel zoom (non-passive: the page must not scroll) ── */
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = stateRef.current;
      const r = el.getBoundingClientRect();
      const pt = { x: e.clientX - r.left, y: e.clientY - r.top };
      const w = {
        x: (pt.x - st.view.tx) / st.view.s,
        y: (pt.y - st.view.ty) / st.view.s,
      };
      const s = Math.min(
        MAX_S,
        Math.max(MIN_S, st.view.s * Math.exp(-e.deltaY * 0.0012)),
      );
      setState({
        ...st,
        view: { s, tx: pt.x - w.x * s, ty: pt.y - w.y * s },
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* ── gestures ── */
  const edgeHit = (wp: Pt): string | null => {
    const st = stateRef.current;
    const tol = EDGE_HIT_PX / st.view.s;
    let best: { id: string; d: number } | null = null;
    for (const e of st.edges) {
      const a = st.nodes.find((n) => n.id === e.from);
      const b = st.nodes.find((n) => n.id === e.to);
      if (!a || !b) continue;
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const len2 = vx * vx + vy * vy || 1;
      let t = ((wp.x - a.x) * vx + (wp.y - a.y) * vy) / len2;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(wp.x - (a.x + vx * t), wp.y - (a.y + vy * t));
      if (d <= tol && (!best || d < best.d)) best = { id: e.id, d };
    }
    return best?.id ?? null;
  };

  const beginPinchIfReady = () => {
    if (pointersRef.current.size !== 2) return;
    const [p1, p2] = [...pointersRef.current.values()];
    const st = stateRef.current;
    const r = rootRef.current?.getBoundingClientRect();
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const anchor = {
      x: (mid.x - (r?.left ?? 0) - st.view.tx) / st.view.s,
      y: (mid.y - (r?.top ?? 0) - st.view.ty) / st.view.s,
    };
    const ids = [...pointersRef.current.keys()] as [number, number];
    gestureRef.current = {
      kind: "pinch",
      ids,
      d0: Math.max(8, Math.hypot(p2.x - p1.x, p2.y - p1.y)),
      anchor,
      mid,
    };
  };

  const onRootPointerDown = (e: React.PointerEvent) => {
    if (editing) return;
    const pt = localPt(e.clientX, e.clientY);
    pointersRef.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
    });
    if (pointersRef.current.size === 2) {
      beginPinchIfReady();
      ensureLoop();
      return;
    }
    if (e.button === 1 || e.button === 2 || e.button === 0) {
      /* middle / right drag pans; a left press on empty space may
       * still become a pan — or stay a click that picks an edge. */
      const st = stateRef.current;
      gestureRef.current = {
        kind: "pan",
        id: e.pointerId,
        sx: pt.x,
        sy: pt.y,
        tx0: st.view.tx,
        ty0: st.view.ty,
        moved: false,
      };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      ensureLoop();
    }
  };

  const onRootPointerMove = (e: React.PointerEvent) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
      });
    }
    const g = gestureRef.current;
    if (!g) return;
    const st = stateRef.current;
    const pt = localPt(e.clientX, e.clientY);
    if (g.kind === "pinch") {
      const [idA, idB] = g.ids;
      const pa = pointersRef.current.get(idA);
      const pb = pointersRef.current.get(idB);
      if (!pa || !pb) return;
      const r = rootRef.current?.getBoundingClientRect();
      const mid = {
        x: (pa.x + pb.x) / 2 - (r?.left ?? 0),
        y: (pa.y + pb.y) / 2 - (r?.top ?? 0),
      };
      const d = Math.max(8, Math.hypot(pb.x - pa.x, pb.y - pa.y));
      const s = Math.min(
        MAX_S,
        Math.max(MIN_S, st.view.s * (d / g.d0)),
      );
      /* anchor: keep the world point from pinch start under the
       * moving midpoint — scale and pan in one matrix step. */
      setState({
        ...st,
        view: { s, tx: mid.x - g.anchor.x * s, ty: mid.y - g.anchor.y * s },
      });
      g.d0 = d;
      g.mid = mid;
      return;
    }
    if (g.id !== e.pointerId) return;
    if (g.kind === "pan") {
      const dx = pt.x - g.sx;
      const dy = pt.y - g.sy;
      if (Math.hypot(dx, dy) > 4) g.moved = true;
      if (g.moved) {
        setState({
          ...st,
          view: { ...st.view, tx: g.tx0 + dx, ty: g.ty0 + dy },
        });
      }
      return;
    }
    if (g.kind === "node") {
      const wp = s2w(pt);
      const nx = wp.x - g.offX;
      const ny = wp.y - g.offY;
      if (!g.moved) {
        /* 4px threshold, judged on total travel from the grab point
         * — under it the press is still a click and the node
         * must not jitter. */
        if (Math.hypot(nx - g.sx, ny - g.sy) * st.view.s <= 4) return;
        g.moved = true;
      }
      setState({
        ...st,
        nodes: st.nodes.map((n) =>
          n.id === g.nodeId ? { ...n, x: nx, y: ny } : n,
        ),
      });
      return;
    }
    if (g.kind === "link") {
      const wp = s2w(pt);
      g.x = wp.x;
      g.y = wp.y;
    }
  };

  const onRootPointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    const g = gestureRef.current;
    if (!g) return;
    if (g.kind === "pinch") {
      if (pointersRef.current.size < 2) gestureRef.current = null;
      return;
    }
    if (g.id !== e.pointerId) return;
    const st = stateRef.current;
    const pt = localPt(e.clientX, e.clientY);
    const wp = s2w(pt);
    if (g.kind === "pan") {
      if (!g.moved && e.button === 0) {
        /* a still click on empty space: pick an edge or clear */
        setSelEdge(edgeHit(wp));
        setSelNode(null);
      }
      gestureRef.current = null;
      return;
    }
    if (g.kind === "node") {
      if (!g.moved) {
        setSelNode(g.nodeId);
        setSelEdge(null);
      }
      gestureRef.current = null;
      return;
    }
    if (g.kind === "link") {
      const from = st.nodes.find((n) => n.id === g.fromId);
      const target = st.nodes.find(
        (n) =>
          n.id !== g.fromId &&
          Math.hypot(n.x - wp.x, n.y - wp.y) <= NODE_HIT_R,
      );
      gestureRef.current = null;
      if (from && target) {
        const dup = st.edges.some(
          (ed) =>
            (ed.from === from.id && ed.to === target.id) ||
            (ed.from === target.id && ed.to === from.id),
        );
        if (!dup) {
          const edge: MMEdge = { id: uid(), from: from.id, to: target.id };
          setState({ ...st, edges: [...st.edges, edge] });
          addPulse(from, target);
        }
      }
      draw(performance.now());
    }
  };
  const onPointerCancel = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 0) gestureRef.current = null;
  };

  const onRootDoubleClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest(".hud-mm-node") || t.closest(".hud-mm-edit")) return;
    const pt = localPt(e.clientX, e.clientY);
    const wp = s2w(pt);
    const node: MMNode = { id: uid(), x: wp.x, y: wp.y, text: "" };
    setState((st) => ({ ...st, nodes: [...st.nodes, node] }));
    setSelNode(node.id);
    setSelEdge(null);
    startEdit(node.id, true);
  };

  const onNodePointerDown = (e: React.PointerEvent, n: MMNode) => {
    if (editing) return;
    e.stopPropagation();
    if (e.button !== 0) return;
    pointersRef.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
    });
    if (pointersRef.current.size === 2) {
      beginPinchIfReady();
      ensureLoop();
      return;
    }
    const pt = localPt(e.clientX, e.clientY);
    const wp = s2w(pt);
    gestureRef.current = {
      kind: "node",
      id: e.pointerId,
      nodeId: n.id,
      offX: wp.x - n.x,
      offY: wp.y - n.y,
      sx: n.x,
      sy: n.y,
      moved: false,
    };
    rootRef.current?.setPointerCapture?.(e.pointerId);
    ensureLoop();
  };

  const onPortPointerDown = (e: React.PointerEvent, n: MMNode) => {
    if (editing) return;
    e.stopPropagation();
    e.preventDefault();
    const pt = localPt(e.clientX, e.clientY);
    const wp = s2w(pt);
    gestureRef.current = {
      kind: "link",
      id: e.pointerId,
      fromId: n.id,
      x: wp.x,
      y: wp.y,
    };
    rootRef.current?.setPointerCapture?.(e.pointerId);
    setSelNode(n.id);
    ensureLoop();
  };

  const editNode = editing ? nodeById.get(editing.id) : undefined;
  const empty = nodes.length === 0;

  return (
    <div
      ref={rootRef}
      className="hud-mm"
      data-mindmap
      data-testid="hud-mindmap"
      data-view-s={view.s}
      data-nodes={nodes.length}
      data-edges={edges.length}
      style={{ top: topOff }}
      onPointerDown={onRootPointerDown}
      onPointerMove={onRootPointerMove}
      onPointerUp={onRootPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onRootDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="hud-mm-canvas" aria-hidden />
      <div
        className="hud-mm-world"
        style={{
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`,
        }}
      >
        {nodes.map((n) => {
          const isSel = n.id === selNode;
          const isEditing = editing?.id === n.id;
          return (
            <div
              key={n.id}
              className={[
                "hud-mm-node",
                isSel ? "is-sel" : "",
                isEditing ? "is-editing" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-testid="hud-mm-node"
              data-node-id={n.id}
              style={{ left: n.x, top: n.y }}
              onPointerDown={(e) => onNodePointerDown(e, n)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (!editing) startEdit(n.id, false);
              }}
            >
              <span className="hud-mm-node-text">{n.text}</span>
              <span
                className="hud-mm-port"
                data-testid="hud-mm-port"
                aria-hidden
                onPointerDown={(e) => onPortPointerDown(e, n)}
              />
              {isSel && !isEditing && (
                <button
                  type="button"
                  className="hud-mm-del"
                  data-testid="hud-mm-del"
                  aria-label="删除节点"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNode(n.id);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {editNode && editing && (
        <input
          ref={editInputRef}
          className="hud-mm-edit"
          data-testid="hud-mm-edit"
          defaultValue={editNode.text}
          placeholder="输入节点文字…"
          style={{
            left: view.tx + editNode.x * view.s,
            top: view.ty + editNode.y * view.s,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commitEdit(
                editNode.id,
                (e.target as HTMLInputElement).value,
                editing.fresh,
              );
            } else if (e.key === "Escape") {
              e.stopPropagation();
              cancelEdit(editNode.id, editing.fresh);
            }
          }}
          onBlur={(e) => {
            if (editing?.id === editNode.id) {
              commitEdit(editNode.id, e.target.value, editing.fresh);
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      )}

      {empty && !editing && (
        <div className="hud-mm-hint" data-testid="hud-mm-hint">
          双击空白新建节点 · 滚轮缩放 · 右键拖拽平移 · 节点右缘圆点拉线连线 ·
          Esc 退出
        </div>
      )}
      <div className="hud-mm-meta" aria-hidden>
        MINDMAP · {nodes.length} NODES / {edges.length} EDGES · ZOOM{" "}
        {view.s.toFixed(2)}×
      </div>
      <button
        type="button"
        className="hud-mm-close"
        data-testid="hud-mm-close"
        onClick={onClose}
        onPointerDown={(e) => e.stopPropagation()}
      >
        退出拓扑 ESC
      </button>
    </div>
  );
}
