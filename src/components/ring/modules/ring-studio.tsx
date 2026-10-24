"use client";

/** 第二主题 · 创作空间（只读呈现，数据源见 meta.ts 登记）。 */
import ModPage from "./mod-page";
import { loadStudio } from "./data";

export default function RingStudio() {
  return <ModPage id="studio" load={loadStudio} />;
}
