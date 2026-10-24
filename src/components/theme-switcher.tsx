"use client";

/**
 * 主题切换器（P3 定案）：分段胶囊 [平面 FLAT | 星环 RING]。
 * 点击另一侧 → localStorage 写 studio_theme_v1（UI 偏好键）后
 * router.push 对应路由（/studio 或 /studio/ring）。不做自动重定向：
 * 任何页面挂载时都不读该键跳转，切换只由用户点击触发。
 */

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
  /** inline = 随父容器排版；overlay = fixed 顶中悬浮（星环首页用）。 */
  variant?: "inline" | "overlay";
}) {
  const router = useRouter();
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
