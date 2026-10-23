/**
 * 拾取（方案 §3.1 #12）：Raycaster 对 13 个命中球（环位 r0.30 /
 * HUB r0.52，均满足 44px 命中半径下限）求交；坐标来自团心常量，
 * 与渲染同源。命中球挂在舞台根组下（随根组偏移一起动）。
 */
import * as THREE from "three";
import { HUB_CENTER, clusterCenter } from "./neuron-field";

export type Picking = {
  /** ndc → 环位序号（-1 = HUB），空 → null */
  pick: (ndc: THREE.Vector2) => number | null;
  dispose: () => void;
};

export function buildPicking(
  parent: THREE.Object3D,
  camera: THREE.Camera,
): Picking {
  const raycaster = new THREE.Raycaster();
  const targets: THREE.Mesh[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const mat = new THREE.MeshBasicMaterial({ visible: false });

  const addSphere = (center: THREE.Vector3, r: number, slotIdx: number) => {
    const g = new THREE.SphereGeometry(r, 12, 8);
    geos.push(g);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.copy(center);
    mesh.userData.slotIdx = slotIdx;
    mesh.frustumCulled = false;
    parent.add(mesh);
    targets.push(mesh);
  };

  addSphere(HUB_CENTER, 0.52, -1);
  for (let i = 0; i < 12; i++) addSphere(clusterCenter(i), 0.30, i);

  return {
    pick: (ndc) => {
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length === 0) return null;
      return hits[0].object.userData.slotIdx as number;
    },
    dispose: () => {
      for (const g of geos) g.dispose();
      mat.dispose();
      for (const t of targets) t.removeFromParent();
    },
  };
}
