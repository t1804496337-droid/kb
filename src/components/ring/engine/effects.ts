/**
 * 后期辉光（方案 §3.1 #10）：UnrealBloomPass(512², .62, .42, .30)——
 * three 0.147 examples/jsm 的 ESM 引入（与 three 本体同版本本地包，
 * 方案裁定⑥：npm + ESM、严禁 CDN）。性能降档可整体关闭（直通渲染）。
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";

export type Effects = {
  render: () => void;
  setSize: (w: number, h: number) => void;
  setBloomEnabled: (on: boolean) => void;
  bloomEnabled: () => boolean;
  dispose: () => void;
};

export function makeEffects(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): Effects {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.62, 0.42, 0.3);
  composer.addPass(renderPass);
  composer.addPass(bloom);
  let enabled = true;

  return {
    render: () => {
      if (enabled) composer.render();
      else renderer.render(scene, camera);
    },
    setSize: (w, h) => {
      composer.setSize(w, h);
    },
    setBloomEnabled: (on) => {
      enabled = on;
    },
    bloomEnabled: () => enabled,
    dispose: () => {
      renderPass.dispose();
      bloom.dispose();
      composer.dispose();
    },
  };
}
