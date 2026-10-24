"use client";

import { useEffect, useRef } from "react";
import { NEURAL_TEMPLATE } from "./neural.template";
import { mountNeural } from "./neural.mount";
import { ensureThree } from "./ensureThree";
import { readRingData } from "./ring-data";
import { on as busOn } from "@/components/studio/bus";

/* 隔离补丁：原版的「主题」按钮由外壳的 picker 接管，这里没有外壳，
 * 留着就是死按钮 —— 只在本 Shadow Root 内隐藏它，不改模板文件。
 * 子模块下钻补丁：左侧神经团列表行可点，给行补 pointer 光标（画布
 * 扇区的 pointer 已由模板 .gl.hov 自带，不改模板文件）。 */
const SHADOW_PATCH_CSS = `<style>[data-series-pick]{display:none!important}.cl{cursor:pointer}</style>`;

export default function NeuralRing({
  onSelect,
}: {
  /** 环位点击下钻回调（页面层接住后路由跳转）；不传则点击只聚焦。 */
  onSelect?: (face: string) => void;
} = {}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const selectRef = useRef(onSelect);
  useEffect(() => {
    selectRef.current = onSelect;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let dead = false;
    let dispose: (() => void) | undefined;
    let sr: ShadowRoot | null = null;

    const mount = () => {
      if (!sr) return;
      try {
        /* 只读快照：每次挂载读一次，绝不写任何键 */
        const data = readRingData();
        dispose = mountNeural(host, sr, data) as (() => void) | undefined;
      } catch (err) {
        console.error("[ring] mountNeural failed", err);
      }
    };

    const teardown = () => {
      try { dispose?.(); } catch (err) { console.error("[ring] dispose failed", err); }
      dispose = undefined;
    };

    /* 只读刷新接线（P1 接入改动，渲染本体一行未动）：数据变化时先
     * dispose 旧场景，再以新的 readRingData() 快照重新挂载。 */
    const remount = () => {
      if (dead || !sr) return;
      teardown();
      sr.innerHTML = NEURAL_TEMPLATE + SHADOW_PATCH_CSS;
      mount();
    };

    const boot = async () => {
      await ensureThree();
      if (dead) return;

      /* Shadow Root 一旦附加就无法移除（StrictMode 会二次挂载），
       * 所以复用已有的，只清内容。 */
      sr = host.shadowRoot ?? host.attachShadow({ mode: "open" });
      sr.innerHTML = NEURAL_TEMPLATE + SHADOW_PATCH_CSS;
      mount();
    };

    void boot();

    /* 跨标签页：storage 事件（过滤口径与主干 ring-surface 一致） */
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.startsWith("studio_")) remount();
    };
    window.addEventListener("storage", onStorage);
    /* 同页：主干业务总线（动作真正落盘后才 emit，本组件只读消费） */
    const offBus = busOn(() => remount());

    /* ── 点击下钻接线（子模块工作台接入改动，渲染本体一行未动） ──
     * mount 的拾取状态（focus / pickAt）封在本体闭包内、不对外暴露，
     * 故接线层只读本体已渲染出的 DOM 状态，不改本体：
     * 1) 左侧神经团列表行（.cl，行内 <b class="k"> 即 face id）：委托
     *    click，按 composedPath 找到行元素读 k 抛出。
     * 2) 画布扇区：pointerdown/up 自行复刻本体的拖拽判定（位移 ≤6px
     *    才算点击），点击后短轮询本体给聚焦行打的 .foc 类，读其 k
     *    抛出；点已聚焦团（取消聚焦）或未拾中则无 .foc，不跳转。 */
    const fireSelect = (k: string | null | undefined) => {
      const key = (k ?? "").trim();
      if (key) selectRef.current?.(key);
    };
    const inPath = (e: Event, pred: (n: EventTarget) => boolean) =>
      e.composedPath().some(pred);
    const isRow = (n: EventTarget): n is HTMLElement =>
      n instanceof HTMLElement && n.classList.contains("cl");
    const isGl = (n: EventTarget): boolean =>
      n instanceof HTMLElement && n.id === "gl";

    const onClick = (e: MouseEvent) => {
      const row = e.composedPath().find(isRow);
      if (row) fireSelect(row.querySelector(".k")?.textContent);
    };
    let downPos: { x: number; y: number } | null = null;
    let navTimers: number[] = [];
    const onPointerDown = (e: PointerEvent) => {
      downPos = inPath(e, isGl) ? { x: e.clientX, y: e.clientY } : null;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!downPos) return;
      const moved =
        Math.abs(e.clientX - downPos.x) + Math.abs(e.clientY - downPos.y);
      downPos = null;
      if (moved > 6 || !inPath(e, isGl)) return;
      navTimers.forEach((t) => window.clearTimeout(t));
      navTimers = [60, 160, 300].map((ms) =>
        window.setTimeout(() => {
          if (dead) return;
          const k =
            host.shadowRoot
              ?.querySelector(".cl.foc .k")
              ?.textContent?.trim() ?? "";
          if (k) {
            navTimers.forEach((t) => window.clearTimeout(t));
            navTimers = [];
            fireSelect(k);
          }
        }, ms),
      );
    };
    host.addEventListener("click", onClick);
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointerup", onPointerUp);

    return () => {
      dead = true;
      window.removeEventListener("storage", onStorage);
      offBus();
      host.removeEventListener("click", onClick);
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointerup", onPointerUp);
      navTimers.forEach((t) => window.clearTimeout(t));
      teardown();
      if (sr) { try { sr.innerHTML = ""; } catch { /* ignore */ } }
    };
  }, []);

  return (
    <div
      ref={hostRef}
      data-testid="ring-host"
      style={{ position: "fixed", inset: 0, display: "block" }}
    />
  );
}
