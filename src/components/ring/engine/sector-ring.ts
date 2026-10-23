/**
 * 扇区文字环（方案 §3.1 #9）：
 *  - 12 环位名牌：Canvas 纹理平面，位于 r2.86 扇区、切向排布，
 *    文字 = SLOT_DEFS 英文代号（本站真实环位名，非装饰文案）。
 *  - 极坐标文字带：r3.14 的圆柱贴图，滚动播报真实执行日志行
 *    （execLineText 口径）；日志为空时带面只写「暂无执行日志」。
 */
import * as THREE from "three";
import { SLOT_DEFS } from "../data/surfaces";
import { execLineText } from "../data/derive";
import type { ExecLogItem } from "../data/types";

export type SectorRing = {
  group: THREE.Group;
  update: (dt: number) => void;
  dispose: () => void;
};

const FONT =
  '600 44px "SF Mono","Cascadia Code",Consolas,"Roboto Mono",monospace';

function namePlate(text: string): THREE.Texture {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 72;
  const g = cv.getContext("2d")!;
  g.clearRect(0, 0, 512, 72);
  g.font = FONT;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = "rgba(0,240,255,.8)";
  g.shadowBlur = 10;
  g.fillStyle = "rgba(190,240,255,.92)";
  g.fillText(text, 256, 38);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

export function buildSectorRing(execLog: ExecLogItem[]): SectorRing {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];

  /* 环位名牌：每块平面切向于其环位角 */
  for (let i = 0; i < 12; i++) {
    const tex = namePlate(SLOT_DEFS[i].en);
    disposables.push(tex);
    const m = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    disposables.push(m);
    const geo = new THREE.PlaneGeometry(0.62, 0.087);
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, m);
    const a = (-90 + i * 30) * (Math.PI / 180);
    mesh.position.set(Math.cos(a) * 2.60, Math.sin(a) * 2.60, 0.02);
    mesh.rotation.z = a - Math.PI / 2;
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  /* 极坐标文字带：圆柱侧面贴图，绕 Z 慢速滚动 */
  let band: THREE.Mesh | null = null;
  {
    const cv = document.createElement("canvas");
    cv.width = 4096;
    cv.height = 64;
    const g = cv.getContext("2d")!;
    g.clearRect(0, 0, 4096, 64);
    g.font =
      '28px "SF Mono","Cascadia Code",Consolas,"Roboto Mono",monospace';
    g.textBaseline = "middle";
    g.fillStyle = "rgba(140,215,255,.85)";
    const lines =
      execLog.length > 0
        ? execLog.map((it) => execLineText(it))
        : ["暂无执行日志"];
    let text = lines.join("　·　") + "　·　";
    while (g.measureText(text).width < 4000) text += text;
    g.fillText(text, 8, 34);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    disposables.push(tex);
    const geo = new THREE.CylinderGeometry(3.14, 3.14, 0.10, 96, 1, true);
    geo.rotateX(Math.PI / 2); // 圆柱轴 → Z，环面落回 XY 平面
    disposables.push(geo);
    const m = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      opacity: 0.55,
    });
    disposables.push(m);
    band = new THREE.Mesh(geo, m);
    band.frustumCulled = false;
    group.add(band);
  }

  return {
    group,
    update: (dt) => {
      if (band) band.rotation.z -= dt * 0.01;
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
