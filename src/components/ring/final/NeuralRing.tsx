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

    /* ── 影子状态：复刻本体动画/相机状态供扇区坐标命中用（见下方接线）──
     * 本体状态封在 mountNeural 闭包内不对外暴露，接线层按本体源码的
     * 同一规则在旁路复刻：animT 影子时钟（rAF 逐帧 dt=min(.1,real)、
     * document.hidden 冻结）、拖拽 yaw/pitch、滚轮 zoom、模式切换清零。 */
    type ShadowState = {
      t: number; last: number;
      yaw: number; pitch: number; zoom: number; userT: number;
      modeZh: string; modePoll: number;
    };
    let sh: ShadowState | null = null;
    let shadowRaf = 0;
    const stopShadow = () => {
      if (shadowRaf) cancelAnimationFrame(shadowRaf);
      shadowRaf = 0;
    };
    const startShadow = () => {
      stopShadow();
      const s: ShadowState = {
        t: 0, last: performance.now(),
        yaw: 0, pitch: 0, zoom: 1, userT: 0, modeZh: "", modePoll: 0,
      };
      sh = s;
      const step = (now: number) => {
        if (dead) return;
        if (!document.hidden) {
          const dt = Math.min(.1, Math.max(0, (now - s.last) / 1000));
          s.t += dt;
          /* 相机 yaw/pitch 衰减：复刻本体 frame()（userT 倒数完才衰减） */
          if (s.userT > 0) s.userT -= dt;
          else { const d = Math.exp(-dt * .7); s.yaw *= d; s.pitch *= d; }
          /* 视角模式由本体按钮 act('mode') 切换并清零 yaw/pitch：
           * 每 ~30 帧读一次当前标签与影子同步（标签即模式地面真值） */
          if (++s.modePoll >= 30) {
            s.modePoll = 0;
            const zh = host.shadowRoot
              ?.querySelector('[data-f="mode"]')?.textContent?.trim() ?? "";
            if (s.modeZh && zh && zh !== s.modeZh) { s.yaw = 0; s.pitch = 0; }
            if (zh) s.modeZh = zh;
          }
        }
        s.last = now;
        shadowRaf = requestAnimationFrame(step);
      };
      shadowRaf = requestAnimationFrame(step);
    };

    const mount = () => {
      if (!sr) return;
      try {
        /* 只读快照：每次挂载读一次，绝不写任何键 */
        const data = readRingData();
        dispose = mountNeural(host, sr, data) as (() => void) | undefined;
        /* 本体每次挂载 animT/相机状态都从零开始，影子同步重启 */
        startShadow();
      } catch (err) {
        console.error("[ring] mountNeural failed", err);
      }
    };

    const teardown = () => {
      stopShadow();
      sh = null;
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

    /* ── 点击下钻接线 v2：坐标命中（渲染本体一行未动）──
     * 旧接线对真人点击是两条死路：#gl 画布全屏覆盖画板且其余面板
     * pointer-events:none，真实指针事件的目标恒为画布、composedPath
     * 到不了 .cl 行；.foc 类只在画布拾中神经团时才出现，点环带永远
     * 等不到。故改走纯坐标命中，与事件路径、DOM 类名彻底脱钩：
     * 1) 行命中：pointerup 位移（曼哈顿）≤6px 视为点击，用释放点对
     *    shadow 内全部 .cl 行做实时 getBoundingClientRect 命中，读行
     *    内 .k 文本抛出。
     * 2) 扇区命中：按本体源码的确定性模型把 13 个扇区中心投影到屏幕
     *    坐标，按点击点相对环心的极角与半径判定。模型出处（括号内为
     *    neural.mount.ts 源码行号）：扇区顺序 ORDER（51-52）、
     *    SEC_A=TAU/13 与 secAng(k)=π/2−k·SEC_A（284-285）、环带半径
     *    2.31–2.69 与 z=−.04（558）、spin.rotation.z=animT·.035（1035）、
     *    相机 fov 38（612）、camWant 四模式分支（746-759）、layout 的
     *    fitD 与 setViewOffset（1129-1148）。animT 不用墙钟（低帧率下
     *    dt 被钳制、墙钟必然脱钩），用影子时钟同规则累积（见上）；
     *    yaw/pitch/zoom 由下方对真实拖拽/滚轮事件的影子跟踪复刻。
     *    校准实测（脚本 login-qa/ring-calib3.js，本体 tooltip 为地面
     *    真值）：12 面两轮投影误差 ≤17px（含神经团位置随机抖动）。
     * 拖拽（位移 >6px）绝不跳转；CRAWLER 无环扇区，其行点击抛出的
     * face 由页面层映射表忽略，不跳转。 */
    const fireSelect = (k: string | null | undefined) => {
      const key = (k ?? "").trim();
      if (key) selectRef.current?.(key);
    };

    const SECTORS = [
      "HUB", "SKILLS", "WORKS", "DB", "FINANCE", "SNAPSHOT", "SYNC",
      "DECISION", "INSPIRE", "ONTOLOGY", "CALENDAR", "HEALTH", "LOG",
    ];
    const TAU = Math.PI * 2;
    const clampN = (v: number, a: number, b: number) =>
      Math.max(a, Math.min(b, v));

    /* 命中行：client 坐标 → .cl 行的 .k 文本 */
    const rowAt = (x: number, y: number): string | null => {
      const root = host.shadowRoot;
      if (!root) return null;
      const rows = root.querySelectorAll(".cl");
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i].getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          return rows[i].querySelector(".k")?.textContent?.trim() || null;
        }
      }
      return null;
    };

    /* 落点是否压在真按钮上：模板里只有 .pe 容器内的按钮吃指针事件
     * （其余面板 pointer-events:none、事件目标恒为画布），本体拖拽/
     * 滚轮只从画布发起——按钮落点的拖拽/滚轮不进影子跟踪。 */
    const overButton = (x: number, y: number): boolean => {
      const root = host.shadowRoot;
      if (!root) return false;
      const els = root.querySelectorAll("button");
      for (let i = 0; i < els.length; i++) {
        const r = els[i].getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
      }
      return false;
    };

    /* 复刻本体相机把世界点投影到 host 坐标；参数每次命中现算
     * （fitIn 实时 rect + 影子 animT/模式/yaw/pitch/zoom）。 */
    const makeProjector = () => {
      const s = sh;
      const root = host.shadowRoot;
      if (!s || !root) return null;
      const glFail = root.querySelector("#glFail") as HTMLElement | null;
      if (glFail && !glFail.hidden) return null;
      const fitEl = root.querySelector("#fitIn");
      if (!fitEl) return null;
      const fr = fitEl.getBoundingClientRect();
      const W = host.clientWidth, H = host.clientHeight;
      if (W < 2 || H < 2 || !(fr.width > 0) || !(fr.height > 0)) return null;
      const bs = Math.min(fr.width / 1920, fr.height / 1080);
      if (!(bs > 0)) return null;
      const BW = fr.width / bs, BH = fr.height / bs;
      const tanF = Math.tan((38 * Math.PI) / 360), Rr = 2.95;
      const narrow = W < 760 || W / H < 1.05;
      let fitD: number, offY: number;
      if (narrow) {
        fitD = Math.max((Rr * H) / (.94 * W * tanF), Rr / (.6 * tanF));
        offY = H * .02;
      } else {
        const ringPx = Math.min(BH * .9, BW - 900) * bs;
        fitD = (Rr * H) / (ringPx * tanF);
        offY = 30 * bs;
      }
      /* camWant（746-759）：模式分支按 [data-f="mode"] 当前标签 */
      const tt = s.t;
      let az = 0, el = 0, tx = 0, ty = 0, rMul = 1;
      switch (s.modeZh) {
        case "正视":
          az = .03 * Math.sin(tt * .13); el = .025 * Math.cos(tt * .11); break;
        case "斜看":
          az = .8 + .06 * Math.sin(tt * .09); el = .28 + .05 * Math.sin(tt * .07);
          tx = -.15; ty = .14; break;
        case "贴近":
          az = 1.02 + .12 * Math.sin(tt * .05); el = -.16 + .07 * Math.sin(tt * .07);
          rMul = .45; tx = 1.1; ty = .35; break;
        default: /* 环绕（默认模式） */
          az = .42 * Math.sin(tt * .07); el = .2 + .12 * Math.sin(tt * .051); break;
      }
      az += s.yaw;
      el = clampN(el + s.pitch, -1.25, 1.25);
      const D = fitD * s.zoom * rMul;
      const P: [number, number, number] = [
        D * Math.sin(az) * Math.cos(el) + tx,
        D * Math.sin(el) + ty,
        D * Math.cos(az) * Math.cos(el),
      ];
      const T: [number, number, number] = [tx, ty, 0];
      let zc: [number, number, number] = [P[0] - T[0], P[1] - T[1], P[2] - T[2]];
      const zl = Math.hypot(zc[0], zc[1], zc[2]) || 1;
      zc = [zc[0] / zl, zc[1] / zl, zc[2] / zl];
      let xc: [number, number, number] = [zc[2], 0, -zc[0]];
      const xl = Math.hypot(xc[0], xc[1], xc[2]) || 1;
      xc = [xc[0] / xl, xc[1] / xl, xc[2] / xl];
      const yc: [number, number, number] = [
        zc[1] * xc[2] - zc[2] * xc[1],
        zc[2] * xc[0] - zc[0] * xc[2],
        zc[0] * xc[1] - zc[1] * xc[0],
      ];
      const aspect = W / H, hN = 2 * tanF, wN = aspect * hN;
      const l = -wN / 2, r = l + wN;
      const tp = tanF - (offY * hN) / H, b = tp - hN;
      return (wx: number, wy: number, wz: number): [number, number] => {
        const dx = wx - P[0], dy = wy - P[1], dz = wz - P[2];
        const cx = dx * xc[0] + dy * xc[1] + dz * xc[2];
        const cy = dx * yc[0] + dy * yc[1] + dz * yc[2];
        const cz = dx * zc[0] + dy * zc[1] + dz * zc[2];
        const dep = -cz;
        if (!(dep > 0)) return [NaN, NaN];
        const ndcX = (2 * (cx / dep) - (r + l)) / (r - l);
        const ndcY = (2 * (cy / dep) - (tp + b)) / (tp - b);
        return [((ndcX + 1) / 2) * W, ((1 - ndcY) / 2) * H];
      };
    };

    /* 扇区命中：host 坐标 → face。极角按相邻投影扇区中心的实测角距
     * 取中点为界；半径门按该扇区投影尺度换算环带并放宽容差，吸收
     * 相机位置 lerp 滞后等小残差。 */
    const sectorAt = (x: number, y: number): string | null => {
      const project = makeProjector();
      if (!project || !sh) return null;
      const spin = sh.t * .035;
      const [cx, cy] = project(0, 0, -.04);
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
      const pts = SECTORS.map((_, k) => {
        const a = Math.PI / 2 - (k * TAU) / 13 + spin;
        return project(Math.cos(a) * 2.5, Math.sin(a) * 2.5, -.04);
      });
      const angOf = (px: number, py: number) => Math.atan2(-(py - cy), px - cx);
      const gap = (a: number, b: number) => {
        const d = Math.abs(a - b) % TAU;
        return d > Math.PI ? TAU - d : d;
      };
      const phi = angOf(x, y);
      const angs = pts.map((p) => angOf(p[0], p[1]));
      let best = -1, bestD = Infinity;
      for (let k = 0; k < 13; k++) {
        const d = gap(phi, angs[k]);
        if (d < bestD) { bestD = d; best = k; }
      }
      if (best < 0) return null;
      const half = Math.min(
        gap(angs[best], angs[(best + 12) % 13]),
        gap(angs[best], angs[(best + 1) % 13]),
      ) / 2;
      if (bestD > half * 1.02) return null;
      const scale = Math.hypot(pts[best][0] - cx, pts[best][1] - cy) / 2.5;
      if (!(scale > 0)) return null;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < 2.31 * scale * .88 || dist > 2.69 * scale * 1.13) return null;
      return SECTORS[best];
    };

    /* 指针接线：down 记点并（画布落点时）影子跟踪拖拽；up 按位移判定 */
    let downPt: { x: number; y: number } | null = null;
    let dragTr: {
      sx: number; sy: number; x: number; y: number;
      moved: boolean; mirror: boolean;
    } | null = null;
    const onPointerDown = (e: PointerEvent) => {
      downPt = { x: e.clientX, y: e.clientY };
      dragTr = {
        sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY,
        moved: false, mirror: !overButton(e.clientX, e.clientY),
      };
    };
    const onPointerMove = (e: PointerEvent) => {
      const d = dragTr, s = sh;
      if (!d || !s) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      d.x = e.clientX; d.y = e.clientY;
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 5) d.moved = true;
      if (d.moved && d.mirror) {
        /* 复刻本体拖拽：yaw -= dx*.005 / pitch += dy*.004 / userT = 6 */
        s.yaw -= dx * .005;
        s.pitch += dy * .004;
        s.userT = 6;
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      const d0 = downPt;
      downPt = null; dragTr = null;
      if (!d0) return;
      const moved =
        Math.abs(e.clientX - d0.x) + Math.abs(e.clientY - d0.y);
      if (moved > 6) return;
      const row = rowAt(e.clientX, e.clientY);
      if (row) { fireSelect(row); return; }
      const hr = host.getBoundingClientRect();
      fireSelect(sectorAt(e.clientX - hr.left, e.clientY - hr.top));
    };
    const onWheel = (e: WheelEvent) => {
      const s = sh;
      if (!s || overButton(e.clientX, e.clientY)) return;
      /* 复刻本体滚轮缩放：zoom = clamp(zoom*exp(deltaY*.0012), .55, 1.6) */
      s.zoom = clampN(s.zoom * Math.exp(e.deltaY * .0012), .55, 1.6);
    };
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      dead = true;
      window.removeEventListener("storage", onStorage);
      offBus();
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("wheel", onWheel);
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
