/**
 * 舞台总控（方案 §3.1 #11 构造器口径）：相机架 + 拟合 + 渲染循环 +
 * 性能治理 + 拾取事件。相机口径以方案 §2.1 为准：FOV 38°、
 * 环 Ø972 设计 px（min(1080×0.9, 1920−900)）、舞台中心 (960, 526)、
 * EL 漂移 0.20±0.12 rad、AZ ±0.42 rad；拟合距离由可见世界高反解，
 * 中心纵偏经根组 yOff 实现（等价 setViewOffset 的构图平移）。
 */
import * as THREE from "three";
import { buildNeuronField, type NeuronField } from "./neuron-field";
import { buildLinks, type LinksLayer } from "./links";
import { buildBundles, type BundlesLayer } from "./bundles";
import { buildHudGeometry, type HudGeometry } from "./hud-geometry";
import { buildEnergyBarcode, type EnergyBarcode } from "./energy-barcode";
import { buildSectorRing, type SectorRing } from "./sector-ring";
import { buildPicking, type Picking } from "./picking";
import { makeEffects, type Effects } from "./effects";
import { barcodeBuckets, slotIndexOfLogItem } from "../data/derive";
import type { RingData } from "../data/types";

export type ViewMode = "orbit" | "front" | "tilt" | "close";

export type StageEvents = {
  onFps: (fps: number, dpr: number, bloom: boolean) => void;
  onHover: (slotIdx: number | null, x: number, y: number) => void;
  onPick: (slotIdx: number | null) => void;
};

const DPR_TIERS = [1.75, 1.25, 1.0, 0.75];

export class RingStage {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private root = new THREE.Group();
  private effects: Effects;
  private picking: Picking;
  private field: NeuronField | null = null;
  private links: LinksLayer | null = null;
  private bundles: BundlesLayer | null = null;
  private hudGeo: HudGeometry;
  private barcode: EnergyBarcode | null = null;
  private sector: SectorRing | null = null;

  private raf = 0;
  private lastTs = 0;
  private startTs = performance.now();
  private disposed = false;
  private ro: ResizeObserver | null = null;
  private cssW = 0;
  private cssH = 0;
  private baseDist = 9.5;
  private tier = 0;

  private mode: ViewMode = "orbit";
  private cur = { az: 0, el: 0.23, distMul: 1 };
  private userZoom = 1;
  private holdUntil = 0;

  private pointerNdc = new THREE.Vector2();
  private pointerClient = { x: 0, y: 0 };
  private pointerDirty = false;
  private hoverSlot: number | null = null;
  private downPos: { x: number; y: number } | null = null;
  private dragging = false;
  private focusSlot: number | null = null;

  private frames = 0;
  private fpsAccumT = 0;
  private lowStreak = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private events: StageEvents,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(new THREE.Color("#03050a"), 1);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
    this.scene.add(this.root);
    this.hudGeo = buildHudGeometry();
    this.root.add(this.hudGeo.group);
    this.effects = makeEffects(this.renderer, this.scene, this.camera);
    this.picking = buildPicking(this.root, this.camera);

    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });

    const parent = canvas.parentElement ?? canvas;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(parent);
    this.resize();
    this.lastTs = performance.now();
    const loop = (ts: number) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      this.frame(ts);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /* ── 数据挂载：重建数据相关层（HUD 几何为静态层不重建） ── */
  setData(data: RingData) {
    this.field?.dispose();
    this.links?.dispose();
    this.bundles?.dispose();
    this.barcode?.dispose();
    this.sector?.dispose();
    if (this.field) this.root.remove(this.field.group);
    if (this.links) this.root.remove(this.links.group);
    if (this.bundles) this.root.remove(this.bundles.group);
    if (this.barcode) this.root.remove(this.barcode.group);
    if (this.sector) this.root.remove(this.sector.group);

    this.field = buildNeuronField(data.slots, data.skillGroups);
    this.root.add(this.field.group);
    this.links = buildLinks(this.field.clusters, this.field.hub, data.slots);
    this.root.add(this.links.group);
    this.bundles = buildBundles();
    this.root.add(this.bundles.group);
    this.barcode = buildEnergyBarcode(
      barcodeBuckets(data.execLog, Date.now()),
    );
    this.root.add(this.barcode.group);
    this.sector = buildSectorRing(data.execLog);
    this.root.add(this.sector.group);
    this.field.setFocus(this.focusSlot);

    /* 信号播种：执行日志逐条一发，t 按新旧交错铺开——全部来自
     * 真实日志条目，无一条环境脉冲（方案 §0.2）。 */
    const mapped = data.execLog
      .map((it) => slotIndexOfLogItem(it))
      .filter((s): s is number => s !== null);
    mapped.forEach((slot, k) => {
      const t0 = mapped.length <= 1 ? 0.4 : (k + 1) / (mapped.length + 1);
      this.bundles?.spawn(slot, t0 * 0.9);
    });
  }

  spawnSignal(slotIdx: number) {
    this.bundles?.spawn(slotIdx, 0);
  }

  setViewMode(mode: ViewMode) {
    this.mode = mode;
  }

  setFocus(slotIdx: number | null) {
    this.focusSlot = slotIdx;
    this.field?.setFocus(slotIdx);
  }

  /* ── 尺寸与拟合 ── */
  private resize() {
    const parent = this.canvas.parentElement ?? this.canvas;
    const w = parent.clientWidth || window.innerWidth;
    const h = parent.clientHeight || window.innerHeight;
    if (w === 0 || h === 0) return;
    this.cssW = w;
    this.cssH = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.applyTier();
    this.renderer.setSize(w, h, false);
    this.effects.setSize(w, h);

    const s = Math.min(w / 1920, h / 1080);
    const pxPerUnit = (972 * s) / 5.9;
    const visH = h / pxPerUnit;
    this.baseDist = visH / 2 / Math.tan((19 * Math.PI) / 180);
    const cy = (h - 1080 * s) / 2 + 526 * s;
    this.root.position.y = (0.5 - cy / h) * visH;
  }

  private applyTier() {
    const cap = DPR_TIERS[this.tier];
    const pr = Math.min(window.devicePixelRatio || 1, cap);
    this.renderer.setPixelRatio(pr);
    this.effects.setBloomEnabled(this.tier < 3);
    if (this.cssW > 0) this.renderer.setSize(this.cssW, this.cssH, false);
  }

  private pixelRatio(): number {
    return this.renderer.getPixelRatio();
  }

  /* ── 指针 ── */
  private setNdc(e: PointerEvent | WheelEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -(((e.clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.pointerClient = { x: e.clientX, y: e.clientY };
  }

  private onPointerMove = (e: PointerEvent) => {
    this.setNdc(e);
    this.pointerDirty = true;
    if (this.dragging && this.downPos) {
      const dx = e.clientX - this.downPos.x;
      const dy = e.clientY - this.downPos.y;
      this.cur.az += dx * 0.005;
      this.cur.el = THREE.MathUtils.clamp(this.cur.el + dy * 0.004, -0.12, 1.25);
      this.downPos = { x: e.clientX, y: e.clientY };
      this.holdUntil = performance.now() + 6000;
    }
  };

  private onPointerDown = (e: PointerEvent) => {
    this.downPos = { x: e.clientX, y: e.clientY };
    this.dragging = true;
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onPointerUp = (e: PointerEvent) => {
    const wasDrag =
      this.downPos !== null &&
      Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y) > 6;
    this.dragging = false;
    this.downPos = null;
    if (!wasDrag) {
      this.setNdc(e);
      const hit = this.picking.pick(this.pointerNdc);
      this.events.onPick(hit);
    }
  };

  private onPointerLeave = () => {
    this.dragging = false;
    if (this.hoverSlot !== null) {
      this.hoverSlot = null;
      this.events.onHover(null, 0, 0);
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.userZoom = THREE.MathUtils.clamp(
      this.userZoom * Math.exp(e.deltaY * 0.001),
      0.55,
      1.7,
    );
    this.holdUntil = performance.now() + 6000;
  };

  /* ── 主循环 ── */
  private frame(ts: number) {
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000 || 0.016);
    this.lastTs = ts;
    const t = (ts - this.startTs) / 1000;
    const now = performance.now();
    const holding = now < this.holdUntil;

    /* 相机目标（四档视角口径见方案 §3.1 #11） */
    let dAz = this.cur.az;
    let dEl = this.cur.el;
    let dMul = 1;
    switch (this.mode) {
      case "orbit":
        if (!holding) {
          dAz = 0.42 * Math.sin(t * 0.07);
          dEl = 0.2 + 0.12 * Math.sin(t * 0.051);
        }
        dMul = 1;
        break;
      case "front":
        dAz = 0;
        dEl = 0.03;
        dMul = 1;
        break;
      case "tilt":
        dAz = 0.5;
        dEl = 0.62;
        dMul = 1.05;
        break;
      case "close":
        dAz = 0.15;
        dEl = 0.18;
        dMul = 0.55;
        break;
    }
    const k = 1 - Math.exp(-dt * 2.6);
    if (!this.dragging) {
      this.cur.az += (dAz - this.cur.az) * k;
      this.cur.el += (dEl - this.cur.el) * k;
    }
    this.cur.distMul += (dMul - this.cur.distMul) * k;

    const dist = this.baseDist * this.cur.distMul * this.userZoom;
    const cy = this.root.position.y;
    const ce = Math.cos(this.cur.el);
    this.camera.position.set(
      Math.sin(this.cur.az) * ce * dist,
      cy + Math.sin(this.cur.el) * dist,
      Math.cos(this.cur.az) * ce * dist,
    );
    this.camera.lookAt(0, cy, 0);

    const pr = this.pixelRatio();
    this.field?.update(t, pr);
    this.bundles?.update(dt, t, pr);
    this.sector?.update(dt);

    if (this.pointerDirty && !this.dragging) {
      this.pointerDirty = false;
      const hit = this.picking.pick(this.pointerNdc);
      if (hit !== this.hoverSlot) {
        this.hoverSlot = hit;
        this.events.onHover(hit, this.pointerClient.x, this.pointerClient.y);
      }
    }

    this.effects.render();

    /* FPS 采样与性能治理：连续 3 秒 <30fps 逐级降档 */
    this.frames++;
    this.fpsAccumT += dt;
    if (this.fpsAccumT >= 1) {
      const fps = Math.round(this.frames / this.fpsAccumT);
      this.events.onFps(fps, this.pixelRatio(), this.tier < 3);
      if (fps < 30) {
        this.lowStreak++;
        if (this.lowStreak >= 3 && this.tier < DPR_TIERS.length - 1) {
          this.tier++;
          this.lowStreak = 0;
          this.applyTier();
          if (this.cssW > 0) this.effects.setSize(this.cssW, this.cssH);
        }
      } else {
        this.lowStreak = 0;
      }
      this.frames = 0;
      this.fpsAccumT = 0;
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.field?.dispose();
    this.links?.dispose();
    this.bundles?.dispose();
    this.barcode?.dispose();
    this.sector?.dispose();
    this.hudGeo.dispose();
    this.picking.dispose();
    this.effects.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
