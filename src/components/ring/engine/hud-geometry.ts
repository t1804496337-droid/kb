/**
 * HUD 几何（方案 §3.1 #8）：主环 Ø5.9 世界单位（设计 972px）、
 * 内圈、3° 刻度环（30° 大刻）、r1.76 内虚线环。纯几何表现层。
 */
import * as THREE from "three";
import { LINE_FRAG, LINE_VERT } from "../shaders/lines";

export type HudGeometry = { group: THREE.Group; dispose: () => void };

export function buildHudGeometry(): HudGeometry {
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

  const circle = (
    r: number,
    color: string,
    alpha: number,
    z = 0,
    seg = 160,
  ): THREE.LineLoop => {
    const pos = new Float32Array(seg * 3);
    const col = new Float32Array(seg * 3);
    const alp = new Float32Array(seg);
    const c = new THREE.Color(color);
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r;
      pos[i * 3 + 2] = z;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
      alp[i] = alpha;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(alp, 1));
    disposables.push(g);
    const loop = new THREE.LineLoop(g, mat);
    loop.frustumCulled = false;
    return loop;
  };

  group.add(circle(2.95, "#00f0ff", 0.30));
  group.add(circle(2.72, "#00f0ff", 0.10));
  group.add(circle(2.36, "#8fd8ff", 0.07));

  /* 刻度环：每 3° 一刻，30° 大刻（对齐 12 环位） */
  {
    const pos: number[] = [];
    const col: number[] = [];
    const alp: number[] = [];
    const c = new THREE.Color("#00f0ff");
    for (let d = 0; d < 360; d += 3) {
      const big = d % 30 === 0;
      const a = (d * Math.PI) / 180;
      const r1 = 2.86;
      const r2 = r1 + (big ? 0.10 : 0.045);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      pos.push(ca * r1, sa * r1, 0, ca * r2, sa * r2, 0);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      const al = big ? 0.42 : 0.15;
      alp.push(al, al);
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
    const ticks = new THREE.LineSegments(g, mat);
    ticks.frustumCulled = false;
    group.add(ticks);
  }

  /* 内虚线环 r1.76（LineDashedMaterial 独立材质） */
  {
    const seg = 128;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 1.76, Math.sin(a) * 1.76, 0));
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const m = new THREE.LineDashedMaterial({
      color: new THREE.Color("#00f0ff"),
      dashSize: 0.07,
      gapSize: 0.05,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    });
    const line = new THREE.Line(g, m);
    line.computeLineDistances();
    line.frustumCulled = false;
    group.add(line);
    disposables.push(g, m);
  }

  return {
    group,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
