"use client";

/** 第二主题 · 健康同步（只读呈现，数据源见 meta.ts 登记）。 */
import ModPage from "./mod-page";
import { loadHealthSync } from "./data";

export default function RingHealthSync() {
  return <ModPage id="health-sync" load={loadHealthSync} />;
}
