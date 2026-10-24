"use client";

/** 第二主题 · 数据库（只读呈现，数据源见 meta.ts 登记）。 */
import ModPage from "./mod-page";
import { loadDatabase } from "./data";

export default function RingDatabase() {
  return <ModPage id="database" load={loadDatabase} />;
}
