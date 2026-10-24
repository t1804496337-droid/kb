/* 一次性加载 three r147 UMD + 4 个 postprocessing + 2 个 shader。
 * 与原版 agent-display.html 第 6446-6448 行的依赖清单完全一致，
 * 只是把 CDN 换成本地 /ring/vendor（离线可跑、版本锁死）。
 * 只向 document.head 追加 <script>，不碰任何样式。 */

const BASE = "/ring/vendor/three@0.147.0/";

const FILES = [
  "build/three.min.js",
  "examples/js/shaders/CopyShader.js",
  "examples/js/shaders/LuminosityHighPassShader.js",
  "examples/js/postprocessing/EffectComposer.js",
  "examples/js/postprocessing/RenderPass.js",
  "examples/js/postprocessing/ShaderPass.js",
  "examples/js/postprocessing/UnrealBloomPass.js",
];

let pending: Promise<void> | null = null;

function loadOne(src: string): Promise<void> {
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.onload = () => resolve();
    // 原版 onerror 也是 resolve（缺依赖时宁可少跑，不阻塞）
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}

export function ensureThree(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as unknown as { THREE?: unknown }).THREE) return Promise.resolve();
  if (pending) return pending;
  pending = FILES.reduce<Promise<void>>((p, f) => p.then(() => loadOne(BASE + f)), Promise.resolve());
  return pending;
}
