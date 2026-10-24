"use client";

/**
 * 第二主题子模块共用壳（定案三段式）：
 * 左栏 280px 模块导航 + 返回星环 / 中作业区 flex:1 独立滚动 /
 * 右详情栏 320px。样式走 CSS Module（styles/modules.module.css），
 * 不进 globals.css。壳本身不读不写任何数据。
 */

import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./styles/modules.module.css";
import { MODULES } from "./meta";

export default function RingModuleShell({
  active,
  cn,
  en,
  src,
  count,
  note,
  children,
  detail,
}: {
  /** 当前页 id（9 模块之一高亮；详情页传自身 id，不在导航中高亮）。 */
  active: string;
  cn: string;
  en: string;
  src: string;
  /** 头部计数；null = 读取中。 */
  count: number | null;
  /** 头部状态说明（种子兜底、键未落盘等）。 */
  note?: string;
  children: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <aside className={styles.nav}>
        <div className={styles.brand}>SECOND BRAIN OS · THEME 02</div>
        <div className={styles.brandTitle}>
          神经星环<span>NEURAL RING</span>
        </div>
        <div className={styles.navHead}>MODULES · 子模块</div>
        {MODULES.map((m) => (
          <Link
            key={m.id}
            href={`/studio/ring/${m.id}`}
            className={`${styles.navItem} ${m.id === active ? styles.navItemActive : ""}`}
          >
            {m.cn}
            <span className={styles.en}>{m.en}</span>
          </Link>
        ))}
        <div className={styles.navFoot}>
          <Link href="/studio/ring" className={styles.navBack}>
            ← 返回星环
          </Link>
          <Link href="/studio" className={styles.navBackSub}>
            回第一主题
          </Link>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.head}>
          <div>
            <span className={styles.headTitle}>{cn}</span>
            <span className={styles.headEn}>{en}</span>
          </div>
          <span className={styles.headMeta}>
            {src} · {count === null ? "读取中" : `${count} 条`}
          </span>
          <Link href="/studio" className={styles.cta}>
            回第一主题录入
          </Link>
          {note ? <div className={styles.headNote}>{note}</div> : null}
        </header>
        <div className={styles.center}>{children}</div>
      </main>

      <aside className={styles.detail}>{detail}</aside>
    </div>
  );
}
