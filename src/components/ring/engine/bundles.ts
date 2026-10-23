/**
 * 突触束 + 信号池（方案 §3.1 #4）：
 *  - 12 条二次贝塞尔束 HUB → 各环位（每束 7 股、控制点外推），
 *    静态底亮；束是拓扑通道，本身不携带计数。
 *  - 信号池 300 点：只有真实事件才发光——挂载时按执行日志逐条
 *    播种（新旧交错排 t），运行中由 bus 真实事件触发 spawn；
 *    绝不设环境假脉冲（方案 §0.2 真实性纪律）。
 */
import * as THREE from "three";
import { LINE_FRAG, LINE_VERT } from "../shaders/lines";
import { POINT_FRAG, POINT_VERT } from "../shaders/points";
import { HUB_CENTER, clusterCenter } from "./neuron-field";

const STRANDS = 7;
const SEGS = 18;
const POOL = 300;

export type BundlesLayer = {
  group: THREE.Group;
  curves: THREE.QuadraticBezierCurve3[][];
  spawn: (slotIdx: number, t0?: number) => void;
  update: (dt: number, t: number, scale: number) => void;
  dispose: () => void;
};

export function buildBundles(): BundlesLayer {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];

  const lineMat = new THREE.ShaderMaterial({
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });
  disposables.push(lineMat);

  const curves: THREE.QuadraticBezierCurve3[][] = [];
  const positions: number[] = [];
  const colors: number[] = [];
  const alphas: number[] = [];
  const cHub = new THREE.Color("#00f0ff");
  const cMid = new THREE.Color("#8fd8ff");

  for (let s = 0; s < 12; s++) {
    const target = clusterCenter(s);
    const dir = target.clone().sub(HUB_CENTER);
    const perp = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
    const slotCurves: THREE.QuadraticBezierCurve3[] = [];
    for (let k = 0; k < STRANDS; k++) {
      const off = (k - (STRANDS - 1) / 2) * 0.028;
      const bulge = (0.10 + (k % 3) * 0.035) * (s % 2 === 0 ? 1 : -1);
      const mid = HUB_CENTER.clone()
        .add(target)
        .multiplyScalar(0.5)
        .add(perp.clone().multiplyScalar(off * 3));
      mid.z += bulge + (k % 2 === 0 ? 0.02 : -0.02);
      const start = HUB_CENTER.clone().add(perp.clone().multiplyScalar(off));
      const end = target
        .clone()
        .add(perp.clone().multiplyScalar(off * 0.6))
        .add(dir.clone().normalize().multiplyScalar(-0.16));
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      slotCurves.push(curve);
      const pts = curve.getPoints(SEGS);
      for (let i = 0; i < SEGS; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        const fadeA = Math.sin((i / SEGS) * Math.PI) * 0.5 + 0.5;
        const fadeB = Math.sin(((i + 1) / SEGS) * Math.PI) * 0.5 + 0.5;
        const c = cHub.clone().lerp(cMid, i / SEGS);
        colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
        alphas.push(0.05 * fadeA + 0.02, 0.05 * fadeB + 0.02);
      }
    }
    curves.push(slotCurves);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(positions), 3),
  );
  geo.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array(colors), 3),
  );
  geo.setAttribute(
    "aAlpha",
    new THREE.BufferAttribute(new Float32Array(alphas), 1),
  );
  const lines = new THREE.LineSegments(geo, lineMat);
  lines.frustumCulled = false;
  group.add(lines);
  disposables.push(geo);

  /* 信号池 */
  const sigPos = new Float32Array(POOL * 3);
  const sigCol = new Float32Array(POOL * 3);
  const sigAlp = new Float32Array(POOL);
  const sigSiz = new Float32Array(POOL);
  const sigColC = new THREE.Color("#aef4ff");
  for (let i = 0; i < POOL; i++) {
    sigPos[i * 3 + 2] = -50; // 停泊在画外
    sigCol[i * 3] = sigColC.r;
    sigCol[i * 3 + 1] = sigColC.g;
    sigCol[i * 3 + 2] = sigColC.b;
    sigSiz[i] = 3.2;
  }
  const sigGeo = new THREE.BufferGeometry();
  sigGeo.setAttribute("position", new THREE.BufferAttribute(sigPos, 3));
  sigGeo.setAttribute("color", new THREE.BufferAttribute(sigCol, 3));
  sigGeo.setAttribute("aAlpha", new THREE.BufferAttribute(sigAlp, 1));
  sigGeo.setAttribute("aSize", new THREE.BufferAttribute(sigSiz, 1));
  const sigMat = new THREE.ShaderMaterial({
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 1 },
      uDim: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });
  const sigPoints = new THREE.Points(sigGeo, sigMat);
  sigPoints.frustumCulled = false;
  group.add(sigPoints);
  disposables.push(sigGeo, sigMat);

  type Sig = { slot: number; strand: number; t: number; speed: number; live: boolean };
  const pool: Sig[] = Array.from({ length: POOL }, () => ({
    slot: 0,
    strand: 0,
    t: 0,
    speed: 0.3,
    live: false,
  }));
  let cursor = 0;

  const spawn = (slotIdx: number, t0 = 0) => {
    if (slotIdx < 0 || slotIdx > 11) return;
    const sig = pool[cursor];
    cursor = (cursor + 1) % POOL;
    sig.slot = slotIdx;
    sig.strand = Math.floor(Math.random() * STRANDS);
    sig.t = t0;
    sig.speed = 0.22 + Math.random() * 0.15;
    sig.live = true;
  };

  const tmp = new THREE.Vector3();
  const update = (dt: number, t: number, scale: number) => {
    sigMat.uniforms.uTime.value = t;
    sigMat.uniforms.uScale.value = scale;
    let dirty = false;
    for (let i = 0; i < POOL; i++) {
      const sig = pool[i];
      if (!sig.live) continue;
      dirty = true;
      sig.t += sig.speed * dt;
      if (sig.t >= 1) {
        sig.live = false;
        sigAlp[i] = 0;
        sigPos[i * 3 + 2] = -50;
        continue;
      }
      curves[sig.slot][sig.strand].getPoint(sig.t, tmp);
      sigPos[i * 3] = tmp.x;
      sigPos[i * 3 + 1] = tmp.y;
      sigPos[i * 3 + 2] = tmp.z;
      sigAlp[i] = Math.sin(sig.t * Math.PI) * 0.9;
    }
    if (dirty) {
      sigGeo.attributes.position.needsUpdate = true;
      sigGeo.attributes.aAlpha.needsUpdate = true;
    }
  };

  return {
    group,
    curves,
    spawn,
    update,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
