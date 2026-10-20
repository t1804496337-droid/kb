"use client";

import Link from "next/link";
import {
  Search,
  Pencil,
  Calendar,
  Building2,
  Wallet,
  PieChart,
  BarChart3,
  ArrowUpRight,
} from "lucide-react";
import { TiltCard } from "@/components/ui/tilt-card";
import { Odometer } from "@/components/ui/odometer";
import { openCommandPalette } from "@/components/layout/command-palette";

/** Wealth-dashboard layout · KB content · top-aligned glass grid */
export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Action bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2 px-1">
        <button
          type="button"
          onClick={() => openCommandPalette()}
          className="glass flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-accent"
          aria-label="搜索"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="glass flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-accent"
          aria-label="编辑"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <span className="glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-foreground/90">
          <Calendar className="h-3.5 w-3.5 text-accent" />
          本周 · 本地预览
        </span>
        <Link
          href="/kb"
          className="glass-pill ml-auto rounded-full px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10"
        >
          + 打开知识库
        </Link>
        <Link
          href="/tickets"
          className="glass-pill rounded-full px-3 py-1.5 text-xs font-medium text-foreground/90 hover:bg-white/5"
        >
          创建报告
        </Link>
      </div>

      {/* Top-aligned glass card grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-4 md:items-start">
        {/* Spending → 笔记分布 */}
        <TiltCard className="rounded-[22px] p-5 md:col-span-3">
          <p className="text-sm text-muted">笔记分布</p>
          <div className="mt-4 space-y-3">
            <BarRow label="情报库" pct={70} />
            <BarRow label="skills" pct={50} />
            <BarRow label="inbox" pct={30} />
          </div>
          <p className="mt-5 text-2xl font-semibold tracking-tight">
            <Odometer value={128} />{" "}
            <span className="text-base font-normal text-muted">篇笔记</span>
          </p>
        </TiltCard>

        {/* Income → 本周新增 */}
        <TiltCard className="rounded-[22px] p-5 md:col-span-3">
          <p className="text-sm text-muted">本周新增</p>
          <div className="mt-4 flex h-24 items-end gap-2 px-1">
            {[40, 72, 55].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-md bg-gradient-to-t from-accent-2 to-accent"
                style={{ height: `${h}%`, opacity: 0.75 + i * 0.1 }}
              />
            ))}
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight">
            <Odometer value={12} />{" "}
            <span className="text-sm font-normal text-accent">
              +18% vs 上周
            </span>
          </p>
        </TiltCard>

        {/* Portfolio → 仓库结构 */}
        <TiltCard className="rounded-[22px] p-5 md:col-span-3">
          <p className="text-sm text-muted">仓库结构</p>
          <div className="mt-5 seg-bar">
            <div className="bg-accent" style={{ width: "55%" }} />
            <div className="bg-accent-2" style={{ width: "30%" }} />
            <div className="bg-white/25" style={{ width: "15%" }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-accent" />Markdown 55%</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-accent-2" />配置 30%</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-white/40" />其它 15%</span>
          </div>
          <p className="mt-4 text-xl font-semibold text-accent">
            +12.8%{" "}
            <span className="text-sm font-normal text-muted">同步健康</span>
          </p>
        </TiltCard>

        {/* Tall right — Wealth index → KB Health */}
        <TiltCard className="row-span-2 rounded-[22px] p-5 md:col-span-3 md:row-span-2">
          <div className="mb-4 flex items-center justify-between gap-1">
            {[Building2, Wallet, PieChart, BarChart3].map((Icon, i) => (
              <span
                key={i}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-muted"
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
            ))}
          </div>
          <div className="ring-wrap">
            <div className="ring-inner text-accent">
              <Odometer value={68} />%
            </div>
          </div>
          <p className="mt-5 text-center text-sm font-medium text-foreground">
            Balanced KB &amp; Workflows
          </p>
          <p className="mt-1 text-center text-xs text-muted">
            知识库健康指数 · 本地 stub
          </p>
          <Link
            href="/kb"
            className="mt-6 flex items-center justify-center gap-1 text-xs text-accent hover:underline"
          >
            查看知识库 <ArrowUpRight className="h-3 w-3" />
          </Link>
        </TiltCard>

        {/* Wealth score → 完成度 */}
        <TiltCard className="rounded-[22px] p-5 md:col-span-4">
          <p className="text-sm text-muted">完成度</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            <Odometer value={87} />{" "}
            <span className="text-lg font-medium text-accent">Strong</span>
          </p>
          <div className="score-blocks mt-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className={`score-block ${i < 9 ? "on" : ""}`} />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">决策 D-01…D-09 已通过 · 本地预览</p>
        </TiltCard>

        {/* Cash flow → 进出 */}
        <TiltCard className="rounded-[22px] p-5 md:col-span-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-muted">本周流转</p>
            <p className="text-lg font-semibold">
              <Odometer value={73} />{" "}
              <span className="text-sm text-accent">Healthy</span>
            </p>
          </div>
          <div className="mt-4 space-y-3">
            <FlowRow label="In · 新增" value="12" pct={72} />
            <FlowRow label="Out · 归档" value="5" pct={40} />
          </div>
        </TiltCard>
      </div>
    </div>
  );
}

function BarRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-foreground/90">{label}</span>
        <span className="text-muted">{pct}%</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FlowRow({
  label,
  value,
  pct,
}: {
  label: string;
  value: string;
  pct: number;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
