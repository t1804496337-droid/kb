"use client";

import { useEffect, useRef } from "react";
import { NEURAL_TEMPLATE } from "./neural.template";
import { mountNeural } from "./neural.mount";
import { ensureThree } from "./ensureThree";
import { readRingData } from "./ring-data";
import { on as busOn } from "@/components/studio/bus";

/* 隔离补丁：原版的「主题」按钮由外壳的 picker 接管，这里没有外壳，
 * 留着就是死按钮 —— 只在本 Shadow Root 内隐藏它，不改模板文件。 */
const SHADOW_PATCH_CSS = `<style>[data-series-pick]{display:none!important}</style>`;

export default function NeuralRing() {
  const hostRef = useRef<HTMLDivElement | null>(null);

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

    return () => {
      dead = true;
      window.removeEventListener("storage", onStorage);
      offBus();
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
