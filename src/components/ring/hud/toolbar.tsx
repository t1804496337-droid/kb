/**
 * 顶栏工具条：四档视角（环绕/正视/斜看/贴近）+ 回工作台 + 全屏。
 * 本期纯 URL 方案（裁定⑤）——不做顶栏主题开关（方案 P 不做）。
 */
import Link from "next/link";
import styles from "../styles/board.module.css";
import type { ViewMode } from "../engine/stage";

const MODES: { id: ViewMode; label: string }[] = [
  { id: "orbit", label: "环绕" },
  { id: "front", label: "正视" },
  { id: "tilt", label: "斜看" },
  { id: "close", label: "贴近" },
];

export function Toolbar({
  mode,
  onMode,
  onFullscreen,
}: {
  mode: ViewMode;
  onMode: (m: ViewMode) => void;
  onFullscreen: () => void;
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.seg} role="group" aria-label="视角">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`${styles.tbtn} ${mode === m.id ? styles.on : ""}`}
            onClick={() => onMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <Link className={styles.tbtn} href="/studio">
        工作台
      </Link>
      <button type="button" className={styles.tbtn} onClick={onFullscreen}>
        全屏
      </button>
    </div>
  );
}
