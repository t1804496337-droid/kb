"use client";

/**
 * /studio/ring 页面层：承载最终版星环，并接住 NeuralRing 抛出的
 * 环位点击（face id）做路由下钻。映射口径（用户定夺纪律）：
 * 8 个模块面 → 对应子模块路由；HUB 中心 → 创作空间；snapshot /
 * exec-log / health-sync → 同壳只读详情页；decision → 第一主题
 * 落地页决策栈（不设子模块）；CRAWLER 是巡检探针，不下钻。
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import NeuralRing from "@/components/ring/final/NeuralRing";
import { ThemeSwitcher } from "@/components/theme-switcher";

const FACE_ROUTES: Record<string, string> = {
  HUB: "/studio/ring/studio",
  SKILLS: "/studio/ring/skills",
  WORKS: "/studio/ring/works",
  DB: "/studio/ring/database",
  FINANCE: "/studio/ring/finance",
  SNAPSHOT: "/studio/ring/snapshot",
  SYNC: "/studio/ring/health-sync",
  DECISION: "/studio",
  INSPIRE: "/studio/ring/inspiration",
  ONTOLOGY: "/studio/ring/ontology",
  CALENDAR: "/studio/ring/calendar",
  HEALTH: "/studio/ring/health",
  LOG: "/studio/ring/exec-log",
};

export default function RingHome() {
  const router = useRouter();
  const onSelect = useCallback(
    (face: string) => {
      const target = FACE_ROUTES[face];
      if (target) router.push(target);
    },
    [router],
  );
  return (
    <>
      <NeuralRing onSelect={onSelect} />
      <ThemeSwitcher active="ring" variant="overlay" />
    </>
  );
}
