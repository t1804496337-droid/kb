"use client";

/**
 * 第二主题子模块共用壳（定案三段式）：
 * 左栏 280px 模块导航 + 返回星环 / 中作业区 flex:1 独立滚动 /
 * 右详情栏 320px。样式走普通样式表 + rm- 前缀类名（styles/modules.css），
 * 不进 globals.css。壳本身不读不写任何数据。
 */

import Link from "next/link";
import type { ReactNode } from "react";
import "./styles/modules.css";
import { MODULES } from "./meta";
import { ThemeSwitcher } from "../../theme-switcher";

export default function RingModuleShell({
  active,
  cn,
  en,
  src,
  count,
  note,
  status,
  statusOk,
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
  /** 左栏底部状态行（可选）：不传则不渲染，其余模块页零变化。 */
  status?: string;
  /** 状态行绿色修饰（如保存成功）。 */
  statusOk?: boolean;
  children: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className={"rm-shell"}>
      <aside className={"rm-nav"}>
        <div className={"rm-brand"}>SECOND BRAIN OS · THEME 02</div>
        <div className={"rm-brandTitle"}>
          神经星环<span>NEURAL RING</span>
        </div>
        <div className={"rm-navHead"}>MODULES · 子模块</div>
        {MODULES.map((m, i) => (
          <Link
            key={m.id}
            href={`/studio/ring/${m.id}`}
            className={`${"rm-navItem"} ${m.id === active ? "rm-navItemActive" : ""}`}
          >
            <span className={"rm-navLine1"}>
              <span className={"rm-navIdx"}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className={"rm-navCn"}>{m.cn}</span>
            </span>
            <span className={"rm-en"}>{m.en}</span>
          </Link>
        ))}
        <div className={"rm-navFoot"}>
          <Link href="/studio/ring" className={"rm-navBack"}>
            ← 返回星环
          </Link>
          <ThemeSwitcher active="ring" />
          {status ? (
            <div
              className={`rm-navStatus${statusOk ? " rm-navStatusOk" : ""}`}
            >
              {status}
            </div>
          ) : null}
        </div>
      </aside>

      <main className={"rm-main"}>
        <header className={"rm-head"}>
          <div>
            <span className={"rm-headTitle"}>{cn}</span>
            <span className={"rm-headEn"}>{en}</span>
          </div>
          <span className={"rm-headMeta"}>
            {src} · {count === null ? "读取中" : `${count} 条`}
          </span>
          {note ? <div className={"rm-headNote"}>{note}</div> : null}
        </header>
        <div className={"rm-center"}>{children}</div>
      </main>

      <aside className={"rm-detail"}>{detail}</aside>
    </div>
  );
}
