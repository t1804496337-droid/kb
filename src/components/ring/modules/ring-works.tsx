"use client";

/** 第二主题 · 作品库（只读呈现，数据源见 meta.ts 登记）。 */
import ModPage from "./mod-page";
import { loadWorks } from "./data";

export default function RingWorks() {
  return <ModPage id="works" load={loadWorks} />;
}
