"use client";

/** 第二主题 · 身体健康（只读呈现，数据源见 meta.ts 登记）。 */
import ModPage from "./mod-page";
import { loadHealth } from "./data";

export default function RingHealth() {
  return <ModPage id="health" load={loadHealth} />;
}
