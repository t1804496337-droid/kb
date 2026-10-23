/**
 * 星环客户端入口：Three.js 舞台禁止 SSR（方案 §3.3）——以
 * dynamic(ssr:false) 在客户端整体载入 ring-surface；本文件是
 * Client Component，满足 Next 16 对 ssr:false 的宿主约束。
 */
"use client";

import dynamic from "next/dynamic";

const RingSurface = dynamic(() => import("./ring-surface"), { ssr: false });

export default function RingClient() {
  return <RingSurface />;
}
