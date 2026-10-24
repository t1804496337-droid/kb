"use client";

/** 第二主题 · 技能库（只读呈现，数据源见 meta.ts 登记）。 */
import ModPage from "./mod-page";
import { loadSkills } from "./data";

export default function RingSkills() {
  return <ModPage id="skills" load={loadSkills} />;
}
