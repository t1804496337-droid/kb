"use client";

/** 第二主题 · 快照登记册（只读呈现，数据源见 meta.ts 登记）。 */
import ModPage from "./mod-page";
import { loadSnapshot } from "./data";

export default function RingSnapshot() {
  return <ModPage id="snapshot" load={loadSnapshot} />;
}
