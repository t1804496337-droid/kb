"use client";

/**
 * 主题切换器（P3 定案）：分段胶囊 [平面 FLAT | 星环 RING]。
 * 点击另一侧 → localStorage 写 studio_theme_v1（UI 偏好键）后
 * router.push 对应路由（/studio 或 /studio/ring）。不做自动重定向：
 * 任何页面挂载时都不读该键跳转，切换只由用户点击触发。
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./theme-switcher.css";

export type ThemeKey = "flat" | "ring";

const ROUTES: Record<ThemeKey, string> = {
  flat: "/studio",
  ring: "/studio/ring",
};

export function ThemeSwitcher({
  active,
  variant = "inline",
}: {
  active: ThemeKey;
  /** inline = 随父容器排版；overlay = fixed 右上角操作区悬浮（星环首页用）。 */
  variant?: "inline" | "overlay";
}) {
  const router = useRouter();
  /* overlay 定位（2026-10-24 修复：旧版 fixed 顶中正压住模板中央
   * .cap「最近一次脉冲」仪表区）：改为贴 .tools 工具条同行左邻。
   * 模板 board 按 bs = min((vw-32)/1920, vh/1080) 缩放，.tools 位于
   * board 右 24px、顶 22px，实测宽约 131px（1728 宽屏量测）；故
   * top = 22×bs、right = 16（.fit 侧边距）+ (24 + 131 + 20 安全隙)×bs。
   * 纯 CSS 表达不了 min() 跨轴，故用 resize 监听实算；CSS 默认值
   * 按 1920 宽屏给（top 22 / right 188），水合后一帧内校正。 */
  const [overlayPos, setOverlayPos] = useState<{
    top: number;
    right: number;
  } | null>(null);
  useEffect(() => {
    if (variant !== "overlay") return;
    const calc = () => {
      const bs = Math.min(
        (window.innerWidth - 32) / 1920,
        window.innerHeight / 1080,
      );
      setOverlayPos({ top: Math.round(22 * bs), right: Math.round(16 + 175 * bs) });
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [variant]);
  const go = (t: ThemeKey) => {
    if (t === active) return;
    try {
      localStorage.setItem("studio_theme_v1", t);
    } catch {
      /* 偏好键写不进也不挡切换 */
    }
    router.push(ROUTES[t]);
  };
  return (
    <div
      className={`ts-root${variant === "overlay" ? " ts-overlay" : ""}`}
      style={
        variant === "overlay" && overlayPos
          ? { top: overlayPos.top, right: overlayPos.right, left: "auto", transform: "none" }
          : undefined
      }
      role="group"
      aria-label="主题切换"
    >
      <button
        type="button"
        data-testid="theme-to-flat"
        className={`ts-seg${active === "flat" ? " ts-segActive" : ""}`}
        aria-pressed={active === "flat"}
        onClick={() => go("flat")}
      >
        平面<span className="ts-en">FLAT</span>
      </button>
      <button
        type="button"
        data-testid="theme-to-ring"
        className={`ts-seg${active === "ring" ? " ts-segActive" : ""}`}
        aria-pressed={active === "ring"}
        onClick={() => go("ring")}
      >
        星环<span className="ts-en">RING</span>
      </button>
    </div>
  );
}

export default ThemeSwitcher;
