/**
 * /studio/ring —— 神经星环作战大屏（第二主题 Surface，方案 Z 纯 URL）。
 * 门禁沿用全站 middleware（未登录跳 /login）；AppShell 对 /studio/
 * 前缀的透传使本页天然全屏，无需也不许改动那两处。
 * 页面本体为最终版星环（P1 落地）：ring/final/NeuralRing 以 Shadow DOM
 * 隔离挂载、只读消费同源数据（挂载逻辑全在客户端 effect 内，SSR 安全）。
 * 旧 S0 舞台（ring-client / ring-surface 及 engine/hud/data）保留在仓内
 * 不再挂载，归档分支 archive/ring-s0-20261023 另有留底。
 */
import NeuralRing from "@/components/ring/final/NeuralRing";

export const metadata = {
  title: "神经星环 · NEURAL RING",
};

export default function RingPage() {
  return <NeuralRing />;
}
