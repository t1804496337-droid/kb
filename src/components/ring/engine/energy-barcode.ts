/**
 * 能量条码环重定义（方案 §2.1 诚实编码）：72 段 × 6 lane 的径向
 * 直方图——桶 b = 近 6 小时第 b 个 5 分钟桶（derive.barcodeBuckets），
 * lane l 点亮 iff bucketCount[b] > l。零事件桶整段留空，环上没有
 * 一格是装饰编的。数据更新时整层重建（低频，成本可忽略）。
 */
import * as THREE from "three";
import { LINE_FRAG, LINE_VERT } from "../shaders/lines";

export type EnergyBarcode = { group: THREE.Group; dispose: () => void };

const R0 = 1.965; // 设计半径 324px（内圈条码带）
const LANE_STEP = 0.04;
const MAX_LANE = 6;

export function buildEnergyBarcode(buckets: number[]): EnergyBarcode {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const mat = new THREE.ShaderMaterial({
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });
  disposables.push(mat);

  const maxCount = Math.max(1, ...buckets);
  const pos: number[] = [];
  const col: number[] = [];
  const alp: number[] = [];
  const c = new THREE.Color("#00f0ff");
  const SUB = 3; // 每 lane 弧分 3 小段近似弧线

  for (let b = 0; b < 72; b++) {
    const count = buckets[b] ?? 0;
    if (count <= 0) continue;
    const lanes = Math.min(MAX_LANE, count);
    const a0 = (b / 72) * Math.PI * 2;
    const a1 = ((b + 0.72) / 72) * Math.PI * 2;
    const alpha = 0.10 + 0.34 * (count / maxCount);
    for (let l = 0; l < lanes; l++) {
      const r = R0 + l * LANE_STEP;
      for (let sgm = 0; sgm < SUB; sgm++) {
        const t0 = a0 + ((a1 - a0) * sgm) / SUB;
        const t1 = a0 + ((a1 - a0) * (sgm + 1)) / SUB;
        pos.push(
          Math.cos(t0) * r,
          Math.sin(t0) * r,
          0,
          Math.cos(t1) * r,
          Math.sin(t1) * r,
          0,
        );
        col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        alp.push(alpha, alpha);
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(pos), 3),
  );
  g.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array(col), 3),
  );
  g.setAttribute(
    "aAlpha",
    new THREE.BufferAttribute(new Float32Array(alp), 1),
  );
  disposables.push(g);
  const lines = new THREE.LineSegments(g, mat);
  lines.frustumCulled = false;
  group.add(lines);

  return {
    group,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
