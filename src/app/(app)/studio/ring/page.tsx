/**
 * /studio/ring —— 神经星环作战大屏（第二主题 Surface，方案 Z 纯 URL）。
 * 门禁沿用全站 middleware（未登录跳 /login）；AppShell 对 /studio/
 * 前缀的透传使本页天然全屏，无需也不许改动那两处。
 * 页面本体为客户端舞台（ring-client 以 ssr:false 载入）。
 */
import RingClient from "@/components/ring/ring-client";

export const metadata = {
  title: "神经星环 · NEURAL RING",
};

export default function RingPage() {
  return <RingClient />;
}
