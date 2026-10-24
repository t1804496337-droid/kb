"use client";

/** 第二主题 · 执行日志（只读呈现，数据源见 meta.ts 登记）。 */
import ModPage from "./mod-page";
import { loadExecLog } from "./data";

export default function RingExecLog() {
  return <ModPage id="exec-log" load={loadExecLog} />;
}
