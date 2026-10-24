"use client";

/** 第二主题 · 灵感池（只读呈现，数据源见 meta.ts 登记）。 */
import ModPage from "./mod-page";
import { loadInspiration } from "./data";

export default function RingInspiration() {
  return <ModPage id="inspiration" load={loadInspiration} />;
}
