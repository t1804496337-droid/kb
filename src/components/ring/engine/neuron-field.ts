/**
 * 神经团点云（方案 §3.1 #1）：13 团 = 中心 HUB + 12 环位。
 * 几何沿参考仓库同构布局——环位按钟面 30° 等分、半径 1.1–1.22、
 * z 向 ±0.14–0.40 交替；点数按真实计数微调（计数为 0 的环位仍在，
 * 它是数据面不是数据量）。随机源为固定种子 LCG，构图可复现。
 * 技能库团内另叠 13 个技能标记点（8 冰蓝 GROKBOT / 5 品红 LUNA，
 * 见 SKILL_DOT_COLORS），颜色常量集中在此，待用户拍案后一键切换。
 */
import * as THREE from "three";
import { LINE_FRAG, LINE_VERT } from "../shaders/lines";
import { POINT_FRAG, POINT_VERT } from "../shaders/points";
import type { SlotData } from "../data/types";

/** 技能点阵配色（暂行口径，用户未最终拍案——集中一处便于切换）。 */
export const SKILL_DOT_COLORS: Record<string, string> = {
  grokbot: "#8fd8ff", // 冰蓝
  luna: "#ff5fc8", // 品红
};

export const HUB_CENTER = new THREE.Vector3(0, 0, 0);

/** 环位中心（与样机同构图：-90° 起、顺时针 30° 一位）。 */
export const clusterCenter = (slotIdx: number): THREE.Vector3 => {
  const a = (-90 + slotIdx * 30) * (Math.PI / 180);
  const r = 1.1 + (slotIdx % 3) * 0.06;
  const z = (slotIdx % 2 === 0 ? 1 : -1) * (0.14 + (slotIdx % 3) * 0.1);
  return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z);
};

/* 确定性伪随机（固定种子 → 每次构图一致，与样机同纪律） */
const mulberry = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const PALETTE = ["#00f0ff", "#8fd8ff", "#bef0ff", "#37c8e8"].map(
  (c) => new THREE.Color(c),
);

export type ClusterHandle = {
  slotIdx: number; // -1 = HUB
  center: THREE.Vector3;
  points: THREE.Points;
  mat: THREE.ShaderMaterial;
  localPositions: Float32Array; // 供 links.ts 建近邻边
};

const makePointMaterial = (): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
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

/* uDim 为聚焦压暗系数，与 points 着色器声明一致。 */
const blob = (
  rnd: () => number,
  center: THREE.Vector3,
  n: number,
  sigma: number,
  activity: number,
  sizeMul: number,
): { geo: THREE.BufferGeometry; local: Float32Array } => {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const alp = new Float32Array(n);
  const siz = new Float32Array(n);
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
  for (let i = 0; i < n; i++) {
    let x = gauss() * sigma * 2.2;
    let y = gauss() * sigma * 2.2;
    const z = gauss() * sigma * 1.1;
    const r = Math.hypot(x, y);
    const maxR = sigma * 2.6;
    if (r > maxR) {
      x *= maxR / r;
      y *= maxR / r;
    }
    pos[i * 3] = center.x + x;
    pos[i * 3 + 1] = center.y + y;
    pos[i * 3 + 2] = center.z + z;
    const c = PALETTE[Math.floor(rnd() * PALETTE.length)];
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
    alp[i] = activity * (0.22 + rnd() * 0.68);
    siz[i] = (1.1 + rnd() * 1.9) * sizeMul;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aAlpha", new THREE.BufferAttribute(alp, 1));
  geo.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
  return { geo, local: pos };
};

export type NeuronField = {
  group: THREE.Group;
  clusters: ClusterHandle[];
  hub: ClusterHandle;
  skillsDots: THREE.Points | null;
  setFocus: (slotIdx: number | null) => void;
  update: (t: number, scale: number) => void;
  dispose: () => void;
};

export function buildNeuronField(
  slots: SlotData[],
  skillGroups: { agentId: string; skills: unknown[] }[],
): NeuronField {
  const rnd = mulberry(20261023);
  const group = new THREE.Group();
  const clusters: ClusterHandle[] = [];
  const disposables: { dispose: () => void }[] = [];

  /* 背景灰质：4200 点大盘（参考口径），低明度、无数据语义 */
  let bgMat: THREE.ShaderMaterial | null = null;
  {
    const n = 4200;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const alp = new Float32Array(n);
    const siz = new Float32Array(n);
    const gray = new THREE.Color("#8cbede");
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.pow(rnd(), 0.6) * 3.9;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r * 0.92;
      pos[i * 3 + 2] = (rnd() - 0.5) * 1.2 - 0.4;
      col[i * 3] = gray.r;
      col[i * 3 + 1] = gray.g;
      col[i * 3 + 2] = gray.b;
      alp[i] = 0.03 + rnd() * 0.09;
      siz[i] = rnd() < 0.08 ? 2 : 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(alp, 1));
    geo.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
    const mat = makePointMaterial();
    bgMat = mat;
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    group.add(pts);
    disposables.push(geo, mat);
  }

  /* HUB 中心核：620 点 */
  const hubMat = makePointMaterial();
  const hubBlob = blob(rnd, HUB_CENTER, 620, 0.085, 0.95, 1.25);
  const hubPoints = new THREE.Points(hubBlob.geo, hubMat);
  hubPoints.frustumCulled = false;
  group.add(hubPoints);
  disposables.push(hubBlob.geo, hubMat);
  const hub: ClusterHandle = {
    slotIdx: -1,
    center: HUB_CENTER,
    points: hubPoints,
    mat: hubMat,
    localPositions: hubBlob.local,
  };

  /* 团边界圈（样机同款细圈，标示团域） */
  const circleMat = new THREE.ShaderMaterial({
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
    uniforms: {},
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });
  disposables.push(circleMat);
  const addBoundary = (center: THREE.Vector3, radius: number, alpha: number) => {
    const seg = 64;
    const pos = new Float32Array(seg * 3);
    const col = new Float32Array(seg * 3);
    const alp = new Float32Array(seg);
    const c = new THREE.Color("#00f0ff");
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pos[i * 3] = center.x + Math.cos(a) * radius;
      pos[i * 3 + 1] = center.y + Math.sin(a) * radius;
      pos[i * 3 + 2] = center.z;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
      alp[i] = alpha;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(alp, 1));
    const loop = new THREE.LineLoop(g, circleMat);
    loop.frustumCulled = false;
    group.add(loop);
    disposables.push(g);
  };
  addBoundary(HUB_CENTER, 0.33, 0.35);
  addBoundary(HUB_CENTER, 0.385, 0.14);

  /* 12 环位团：点数按计数微调（140–440），明暗由 activity 驱动 */
  for (let i = 0; i < 12; i++) {
    const center = clusterCenter(i);
    const sd = slots[i];
    const n = Math.round(150 + 290 * (sd ? sd.ratio : 0));
    const mat = makePointMaterial();
    const b = blob(rnd, center, n, 0.062, sd?.activity ?? 0.3, 1);
    const pts = new THREE.Points(b.geo, mat);
    pts.frustumCulled = false;
    group.add(pts);
    disposables.push(b.geo, mat);
    addBoundary(center, 0.20, 0.10);
    clusters.push({
      slotIdx: i,
      center,
      points: pts,
      mat,
      localPositions: b.local,
    });
  }

  /* 技能库团内点阵：真实技能逐个成点（组内顺序 = skills-sync 原序，
   * grokbot 在前、luna 在后，与样机 8 冰蓝 / 5 品红排布一致）。
   * 排布：前 12 个环绕、其余收中心——纯几何排布，颜色按 agent。 */
  let skillsDots: THREE.Points | null = null;
  {
    const flat: { agentId: string }[] = [];
    for (const g of skillGroups) {
      for (let k = 0; k < g.skills.length; k++) {
        flat.push({ agentId: g.agentId });
      }
    }
    if (flat.length > 0) {
      const center = clusterCenter(1);
      const n = flat.length;
      const pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      const alp = new Float32Array(n);
      const siz = new Float32Array(n);
      flat.forEach((s, k) => {
        let x: number, y: number;
        if (n <= 12 || k < 12) {
          const ringN = Math.min(n, 12);
          const a = (k / ringN) * Math.PI * 2 - Math.PI / 2;
          x = center.x + Math.cos(a) * 0.082;
          y = center.y + Math.sin(a) * 0.082;
        } else {
          x = center.x;
          y = center.y;
        }
        pos[k * 3] = x;
        pos[k * 3 + 1] = y;
        pos[k * 3 + 2] = center.z + 0.01;
        const c = new THREE.Color(SKILL_DOT_COLORS[s.agentId] ?? "#8fd8ff");
        col[k * 3] = c.r;
        col[k * 3 + 1] = c.g;
        col[k * 3 + 2] = c.b;
        alp[k] = 0.95;
        siz[k] = 3.4;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      geo.setAttribute("aAlpha", new THREE.BufferAttribute(alp, 1));
      geo.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
      const mat = makePointMaterial();
      skillsDots = new THREE.Points(geo, mat);
      skillsDots.frustumCulled = false;
      group.add(skillsDots);
      disposables.push(geo, mat);
    }
  }

  const realClusters = clusters.filter((c) => c.slotIdx >= 0);

  return {
    group,
    clusters: realClusters,
    hub,
    skillsDots,
    setFocus: (slotIdx) => {
      for (const c of realClusters) {
        const target =
          slotIdx === null ? 1 : c.slotIdx === slotIdx ? 1.25 : 0.22;
        (c.mat.uniforms as Record<string, { value: number }>).uDim.value =
          target;
      }
      (hub.mat.uniforms as Record<string, { value: number }>).uDim.value =
        slotIdx === null ? 1 : 0.55;
    },
    update: (t, scale) => {
      for (const c of [...realClusters, hub]) {
        c.mat.uniforms.uTime.value = t;
        c.mat.uniforms.uScale.value = scale;
      }
      if (bgMat) {
        bgMat.uniforms.uTime.value = t;
        bgMat.uniforms.uScale.value = scale;
      }
      if (skillsDots) {
        const m = skillsDots.material as THREE.ShaderMaterial;
        m.uniforms.uTime.value = t;
        m.uniforms.uScale.value = scale;
      }
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
