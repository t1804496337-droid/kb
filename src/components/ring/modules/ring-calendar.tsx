"use client";

/** 第二主题 · 日历表（只读呈现，数据源见 meta.ts 登记）。 */
import ModPage from "./mod-page";
import { loadCalendar } from "./data";

export default function RingCalendar() {
  return <ModPage id="calendar" load={loadCalendar} />;
}
