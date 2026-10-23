/**
 * 连边层（方案 §3.1 #3）：
 *  - 团内近邻边：空间哈希（CELL 0.09 世界单位 ≈ 参考口径按本站团
 *    半径缩放），每点最多连 K=3 条、maxD 0.115；亮度随该团 activity
 *    （真实活性），计数为 0 的团边更暗——边的存在只表达拓扑。
 *  - 远程细丝：全域短段 6000 条（方案预算口径，性能降档时先砍此类
 *    表现层），无数据语义。
 */
import * as THREE from "three";
import { LINE_FRAG, LINE_VERT } from "../shaders/lines";
import type { ClusterHandle } from "./neuron-field";
import type { SlotData } from "../data/types";

const CYAN = new THREE.Color("#00f0ff");
const ICE = new THREE.Color("#8fd8ff");

const makeLineMaterial = (): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });

const mulberry = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export type LinksLayer = {
  group: THREE.Group;
  dispose: () => void;
};

export function buildLinks(
  clusters: ClusterHandle[],
  hub: ClusterHandle,
  slots: SlotData[],
): LinksLayer {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const mat = makeLineMaterial();
  disposables.push(mat);

  const positions: number[] = [];
  const colors: number[] = [];
  const alphas: number[] = [];

  const pushSeg = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Color,
    alpha: number,
  ) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    alphas.push(alpha, alpha * 0.6);
  };

  const CELL = 0.09;
  const MAXD2 = 0.115 * 0.115;
  const K = 3;

  const linkCluster = (
    handle: ClusterHandle,
    activity: number,
    baseAlpha: number,
  ) => {
    const p = handle.localPositions;
    const n = p.length / 3;
    const grid = new Map<string, number[]>();
    const keyOf = (x: number, y: number, z: number) =>
      `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
    for (let i = 0; i < n; i++) {
      const k = keyOf(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      const arr = grid.get(k);
      if (arr) arr.push(i);
      else grid.set(k, [i]);
    }
    const va = new THREE.Vector3();
    const vb = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      va.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      let linked = 0;
      const cx = Math.floor(va.x / CELL);
      const cy = Math.floor(va.y / CELL);
      const cz = Math.floor(va.z / CELL);
      outer: for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const arr = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
            if (!arr) continue;
            for (const j of arr) {
              if (j <= i) continue;
              vb.set(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]);
              if (va.distanceToSquared(vb) < MAXD2) {
                pushSeg(va, vb, CYAN, baseAlpha * (0.4 + activity * 0.6));
                linked++;
                if (linked >= K) break outer;
              }
            }
          }
        }
      }
    }
  };

  linkCluster(hub, 0.95, 0.13);
  for (const c of clusters) {
    const sd = slots[c.slotIdx];
    linkCluster(c, sd?.activity ?? 0.3, 0.10);
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
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  group.add(lines);
  disposables.push(geo);

  /* 远程细丝：表现层，无数据语义 */
  {
    const rnd = mulberry(777);
    const fp: number[] = [];
    const fc: number[] = [];
    const fa: number[] = [];
    for (let i = 0; i < 6000; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 0.4 + Math.pow(rnd(), 0.7) * 2.3;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * 0.92;
      const z = (rnd() - 0.5) * 1.1 - 0.3;
      const la = rnd() * Math.PI * 2;
      const len = 0.03 + rnd() * 0.09;
      fp.push(x, y, z, x + Math.cos(la) * len, y + Math.sin(la) * len, z);
      const c = rnd() < 0.5 ? CYAN : ICE;
      fc.push(c.r, c.g, c.b, c.r, c.g, c.b);
      const al = 0.02 + rnd() * 0.035;
      fa.push(al, al);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(fp), 3),
    );
    fg.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(fc), 3),
    );
    fg.setAttribute(
      "aAlpha",
      new THREE.BufferAttribute(new Float32Array(fa), 1),
    );
    const fl = new THREE.LineSegments(fg, mat);
    fl.frustumCulled = false;
    group.add(fl);
    disposables.push(fg);
  }

  return {
    group,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
